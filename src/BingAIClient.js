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