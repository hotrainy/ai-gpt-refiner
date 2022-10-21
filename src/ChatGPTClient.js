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
            }