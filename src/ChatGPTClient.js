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
            // I chose not to do 