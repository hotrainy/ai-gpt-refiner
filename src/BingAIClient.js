import './fetch-polyfill.js';
import crypto from 'crypto';
import WebSocket from 'ws';
import Keyv from 'keyv';
import { Agent, ProxyAgent } from 'undici';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { BingImageCreator } from '@timefox/bic-sydney';

/**
 * https://stackoverflow.com/a/58326357
 * @param {number} size
 */
const genRanHex = size => [...Array(size)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');

export default class BingAIClient {
    constructor(options) {
        if (options.keyv) {
            if (!options.keyv.namespace) {
                console.warn('The given Keyv object has no namespace. This is a bad idea if you share a database.');
            }
            this.conversationsCache = options.keyv;
        } else {
            const cacheOptions = options.cache || {};
            cacheOptions.namespace = cacheOptions.namespace || 'bing';
            this.conversationsCache = new Keyv(cacheOptions);
        }

        this.setOptions(options);
    }

    setOptions(options) {
        // don't allow overriding cache options for consistency with other clients
        delete options.cache;
        if (this.options && !this.options.replaceOptions) {
            this.options = {
                ...this.options,
                ...options,
            };
        } else {
            this.options = {
                ...options,
                host: options.host || 'https://www.bing.com',
                xForwardedFor: this.constructor.getValidIPv4(options.xForwardedFor),
                features: {
                    genImage: options?.features?.genImage || false,
                },
            };
        }
        this.debug = this.options.debug;
        if (this.options.features.genImage) {
            this.bic = new BingImageCreator(this.options);
        }
    }

    static getValidIPv4(ip) {
        const match = !ip
            || ip.match(/^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(\/([0-9]|[1-2][0-9]|3[0-2]))?$/);
        if (match) {
            if (match[5]) {
                const mask = parseInt(match[5], 10);
                let [a, b, c, d] = ip.split('.').map(x => parseInt(x, 10));
                // eslint-disable-next-line no-bitwise
                const max = (1 << (32 - mask)) - 1;
                const rand = Math.floor(Math.random() * max);
                d += rand;
                c += Math.floor(d / 256);
                d %= 256;
                b += Math.floor(c / 256);
                c %= 256;
                a += Math.floor(b / 256);
                b %= 256;
                return `${a}.${b}.${c}.${d}`;
            }
            return ip;
        }
        return undefined;
    }

    async createNewConversation() {
        this.headers = {
            accept: 'application/json',
            'accept-language': 'en-US,en;q=0.9',
            'content-type': 'application/json',
            'sec-ch-ua': '"Microsoft Edge";v="113", "Chromium";v="113", "Not-A.Brand";v="24"',
            'sec-ch-ua-arch': '"x86"',
            'sec-ch-ua-bitness': '"64"',
            'sec-ch-ua-full-version': '"113.0.1774.50"',
            'sec-ch-ua-full-version-list': '"Microsoft Edge";v="113.0.1774.50", "Chromium";v="113.0.5672.127", "Not-A.Brand";v="24.0.0.0"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-model': '""',
            'sec-ch-ua-platform': '"Windows"',
            'sec-ch-ua-platform-version': '"15.0.0"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin',
            'sec-ms-gec': genRanHex(64).toUpperCase(),
            'sec-ms-gec-version': '1-115.0.1866.1',
            'x-ms-client-request-id': crypto.randomUUID(),
            'x-ms-useragent': 'azsdk-js-api-client-factory/1.0.0-beta.1 core-rest-pipeline/1.10.0 OS/Win32',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36 Edg/113.0.1774.50',
            cookie: this.options.cookies || (this.options.userToken ? `_U=${this.options.userToken}` : undefined),
            Referer: 'https://www.bing.com/search?q=Bing+AI&showconv=1',
            'Referrer-Policy': 'origin-when-cross-origin',
            // Workaround for request being blocked due to geolocation
            // 'x-forwarded-for': '1.1.1.1', // 1.1.1.1 seems to no longer work.
            ...(this.options.xForwardedFor ? { 'x-forwarded-for': this.options.xForwardedFor } : {}),
        };
        // filter undefined values
        this.headers = Object.fromEntries(Object.entries(this.headers).filter(([, value]) => value !== undefined));

        const fetchOptions = {
            headers: this.headers,
        };
        if (this.options.proxy) {
            fetchOptions.dispatcher = new ProxyAgent(this.options.proxy);
        } else {
            fetchOptions.dispatcher = new Agent({ connect: { timeout: 20_000 } });
        }
        const response = await fetch(`${this.options.host}/turing/conversation/create?bundleVersion=1.864.15`, fetchOptions);
        const body = await response.text();
        try {
            const res = JSON.parse(body);
            res.encryptedConversationSignature = response.headers.get('x-sydney-encryptedconversationsignature') ?? null;
            return res;
        } catch (err) {
            throw new Error(`/turing/conversation/create: failed to parse response body.\n${body}`);
        }
    }

    async createWebSocketConnection(encryptedConversationSignature) {
        return new Promise((resolve, reject) => {
            let agent;
            if (this.options.proxy) {
                agent = new HttpsProxyAgent(this.options.proxy);
            }

            const ws = new WebSocket(`wss://sydney.bing.com/sydney/ChatHub?sec_access_token=${encodeURIComponent(encryptedConversationSignature)}`, { agent, headers: this.headers });

            ws.on('error', err => reject(err));

            ws.on('open', () => {
                if (this.debug) {
                    console.debug('performing handshake');
                }
                ws.send('{"protocol":"json","version":1}');
            });

            ws.on('close', () => {
                if (this.debug) {
                    console.debug('disconnected');
                }
            });

            ws.on('message', (data) => {
                const objects = data.toString().split('');
                const messages = objects.map((object) => {
                    try {
                        return JSON.parse(object);
                    } catch (error) {
                        return object;
                    }
                }).filter(message => message);
                if (messages.length === 0) {
                    return;
                }
                if (typeof messages[0] === 'object' && Object.keys(messages[0]).length === 0) {
                    if (this.debug) {
                        console.debug('handshake established');
                    }
                    // ping
                    ws.bingPingInterval = setInterval(() => {
                        ws.send('{"type":6}');
                        // same message is sent back on/after 2nd time as a pong
                    }, 15 * 1000);
                    resolve(ws);
                    return;
                }
                if (this.debug) {
                    console.debug(JSON.stringify(messages));
                    console.debug();
                }
            });
        });
    }

    static cleanupWebSocketConnection(ws) {
        clearInterval(ws.bingPingInterval);
        ws.close();
        ws.removeAllListeners();
    }

    async sendMessage(
        message,
        opts = {},
    ) {
        if (opts.clientOpt