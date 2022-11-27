import './fetch-polyfill.js';
import crypto from 'crypto';
import Keyv from 'keyv';
import { encoding_for_model as encodingForModel, get_encoding as getEncoding } from '@dqbd/tiktoken';
import { fetchEventSource } from '@waylaidwanderer/fetch-event-source';
import { Agent, ProxyAgent } from 'undici';

const CHATGPT_MODEL = 'gpt-3.5-turbo';

const tokenizersCache = {};

export default class ChatGPTClient {
    constructor(
        apiKey,
        options = {},
        cacheOptions = {},
    ) {
        this.apiKey = apiKey;

        cacheOptions.namespace = cacheOptions.namespace || 'chatgpt';
        this.conversationsCache = new Keyv(cacheOptions);

        this.setOptions(options);
    }

    setOptions(options) {
        if (this.options && !this.options.replaceOptions) {
            // nested options aren't spread properly, so we need to do this manually
            this.options.modelOptions = {
                ...this.options.modelOptions,
                ...options.modelOptions,
            };
            delete options.modelOptions;
            // now we can merge options
            this.options = {
                ...this.options,
                ...options,
            };
        } else {
            this.options = options;
        }

        if (this.options.openaiApiKey) {
            this.apiKey = this.options.openaiApiKey;
        }

        const modelOptions = this.options.modelOptions || {};
        this.modelOptions = {
            ...modelOptions,
            // set some good defaults (check for undefined in some cases because they may be 0)
            model: modelOptions.model || CHATGPT_MODEL,
            temperature: typeof modelOptions.temperature === 'undefined' ? 0.8 : modelOptions.temperature,
            top_p: typeof modelOptions.top_p === 'undefined' ? 1 : modelOptions.top_p,
            presence_penalty: typeof modelOptions.presence_penalty === 'undefined' ? 1 : modelOptions.presence_penalty,
            stop: modelOptions.stop,
        };

        this.isChatGptModel = this.modelOptions.model.startsWith('gpt-');
        const { isChatGptModel } = this;
        this.isUnofficialChatGptModel = this.modelOptions.model.startsWith('text-chat') || this.modelOptions.model.startsWith('text-davinci-002-render');
        const { isUnofficialChatGptModel } = this;

        // Davinci models have a max context length of 4097 tokens.
        this.maxContextTokens = this.options.maxContextTokens || (isChatGptModel ? 4095 : 4097);
        // I decided to reserve 1024 tokens for the response.
        // The max prompt tokens is determined by the max context tokens minus the max response tokens.
        // Earlier messages will be dropped until the prompt is within the limit.
        this.maxResponseTokens = this.modelOptions.max_tokens || 1024;
        this.maxPromptTokens = this.options.maxPromptTokens || (this.maxContextTokens - this.maxResponseTokens);

        if (this.maxPromptTokens + this.maxResponseTokens > this.maxContextTokens) {
            throw new Error(`maxPromptTokens + max_tokens (${this.maxPromptTokens} + ${this.maxResponseTokens} = ${this.maxPromptTokens + this.maxResponseTokens}) must be less than or equal to maxContextTokens (${this.maxContextTokens})`);
        }

        this.userLabel = this.options.userLabel || 'User';
        this.chatGptLabel = this.options.chatGptLabel || 'ChatGPT';

        if (isChatGptModel) {
            // Use these faux tokens to help the AI understand the context since we are building the chat log ourselves.
            // Trying to use "<|im_start|>" causes the AI to still generate "<" or "<|" at the end sometimes for some reason,
            // without tripping the stop sequences, so I'm using "||>" instead.
            this.startToken = '||>';
            this.endToken = '';
            this.gptEncoder = this.constructor.getTokenizer('cl100k_base');
        } else if (isUnofficialChatGptModel) {
            this.startToken = '<|im_start|>';
            this.endToken = '<|im_end|>';
            this.gptEncoder = this.constructor.getTokenizer('text-davinci-003', true, {
                '<|im_start|>': 100264,
                '<|im_end|>': 100265,
            });
        } else {
            // Previously I was trying to use "<|endoftext|>" but there seems to be some bug with OpenAI's token counting
            // system that causes only the first "<|endoftext|>" to be counted as 1 token, and the rest are not treated
            // as a single token. So we're using this instead.
            this.startToken = '||>';
            this.endToken = '';
            try {
                this.gptEncoder = this.constructor.getTokenizer(this.modelOptions.model, true);
            } catch {
                this.gptEncoder = this.constructor.getTokenizer('text-davinci-003', true);
            }
        }

        if (!this.modelOptions.stop) {
            const stopTokens = [this.startToken];
            if (this.endToken && this.endToken !== this.startToken) {
                stopTokens.push(this.endToken);
            }
            stopTokens.push(`\n${this.userLabel}:`);
            stopTokens.push('<|diff_marker|>');
            // I chose not to do one for `chatGptLabel` because I've never seen it happen
            this.modelOptions.stop = stopTokens;
        }

        if (this.options.reverseProxyUrl) {
            this.completionsUrl = this.options.reverseProxyUrl;
        } else if (isChatGptModel) {
            this.completionsUrl = 'https://api.openai.com/v1/chat/completions';
        } else {
            this.completionsUrl = 'https://api.openai.com/v1/completions';
        }

        return this;
    }

    static getTokenizer(encoding, isModelName = false, extendSpecialTokens = {}) {
        if (tokenizersCache[encoding]) {
            return tokenizersCache[encoding];
        }
        let tokenizer;
        if (isModelName) {
            tokenizer = encodingForModel(encoding, extendSpecialTokens);
        } else {
            tokenizer = getEncoding(encoding, extendSpecialTokens);
        }
        tokenizersCache[encoding] = tokenizer;
        return tokenizer;
    }

    async getCompletion(input, onProgress, abortController = null) {
        if (!abortController) {
            abortController = new AbortController();
        }
        const modelOptions = { ...this.modelOptions };
        if (typeof onProgress === 'function') {
            modelOptions.stream = true;
        }
        if (this.isChatGptModel) {
            modelOptions.messages = input;
        } else {
            modelOptions.prompt = input;
        }
        const { debug } = this.options;
        const url = this.completionsUrl;
        if (debug) {
            console.debug();
            console.debug(url);
            console.debug(modelOptions);
            console.debug();
        }
        const opts = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(modelOptions),
            dispatcher: new Agent({
                bodyTimeout: 0,
                headersTimeout: 0,
            }),
        };

        if (this.apiKey && this.options.azure && this.options.reverseProxyUrl) {
            opts.headers['api-key'] = this.apiKey;
        } else if (this.apiKey) {
            opts.headers.Authorization = `Bearer ${this.apiKey}`;
        }

        if (this.options.headers) {
            opts.headers = { ...opts.headers, ...this.options.headers };
        }

        if (this.options.proxy) {
            opts.dispatcher = new ProxyAgent(this.options.proxy);
        }

        if (modelOptions.stream) {
            // eslint-disable-next-line no-async-promise-executor
            return new Promise(async (resolve, reject) => {
                try {
                    let done = false;
                    await fetchEventSource(url, {
                        ...opts,
                        signal: abortController.signal,
                        async onopen(response) {
                            if (response.status === 200) {
                                return;
                            }
                            if (debug) {
                                console.debug(response);
                            }
                            let error;
                            try {
                                const body = await response.text();
                                error = new Error(`Failed to send message. HTTP ${response.status} - ${body}`);
                                error.status = response.status;
                                error.json = JSON.parse(body);
                            } catch {
                                error = error || new Error(`Failed to send message. HTTP ${response.status}`);
                            }
                            throw error;
                        },
                        onclose() {
                            if (debug) {
                                console.debug('Server closed the connection unexpectedly, returning...');
                            }
                            // workaround for private API not sending [DONE] event
                            if (!done) {
                                onProgress('[DONE]');
                                abortController.abort();
                                resolve();
                            }
                        },
                        onerror(err) {
                            if (debug) {
                                console.debug(err);
                            }
                            // rethrow to stop the operation
                            throw err;
                        },
                        onmessage(message) {
                            if (debug) {
                                console.debug(message);
                            }
                            if (!message.data || message.event === 'ping') {
                                return;
                            }
                            if (message.data === '[DONE]') {
                                onProgress('[DONE]');
                                abortController.abort();
                                resolve();
                                done = true;
                                return;
                            }
                            onProgress(JSON.parse(message.data));
                        },
                    });
                } catch (err) {
                    reject(err);
                }
            });
        }
        const response = await fetch(
            url,
            {
                ...opts,
                signal: abortController.signal,
            },
        );
        if (response.status !== 200) {
            const body = await response.text();
            const error = new Error(`Failed to send message. HTTP ${response.status} - ${body}`);
            error.status = response.status;
            try {
                error.json = JSON.parse(body);
            } catch {
                error.body = body;
            }
            throw error;
        }
        return response.json();
    }

    async generateTitle(userMessage, botMessage) {
        const instructionsPayload = {
            role: 'system',
            content: `Write an extremely concise subtitle for this conversation with no more than a few words. All words should be capitalized. Exclude punctuation.

||>Message:
${userMessage.message}
||>Response:
${botMessage.message}

||>Title:`,
        };

        cons