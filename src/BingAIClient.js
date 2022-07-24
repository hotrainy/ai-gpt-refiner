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
                consol