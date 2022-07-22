// eslint-disable-next-line no-unused-vars
import { KeyvFile } from 'keyv-file';
// import { ChatGPTClient } from '@waylaidwanderer/chatgpt-api';
import { ChatGPTClient } from '../index.js';

const clientOptions = {
    // (Optional) Support for a reverse proxy for the completions endpoint (private API server).
    // Warning: This will expose your `openaiApiKey` to a third party. Consider the risks before using this.
    // reverseProxyUrl: 'https://chatgpt.hato.ai/completions',
    // (Optional) Parameters as described in https://platform.openai.com/docs/api-reference/completions
    // (Optional) to use Azure OpenAI API, set `azure` to