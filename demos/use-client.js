// eslint-disable-next-line no-unused-vars
import { KeyvFile } from 'keyv-file';
// import { ChatGPTClient } from '@waylaidwanderer/chatgpt-api';
import { ChatGPTClient } from '../index.js';

const clientOptions = {
    // (Optional) Support for a reverse proxy for the completions endpoint (private API server).
    // Warning: This will expose your `openaiApiKey` to a third party. Consider the risks before using this.
    // reverseProxyUrl: 'https://chatgpt.hato.ai/completions',
    // (Optional) Parameters as described in https://platform.openai.com/docs/api-reference/completions
    // (Optional) to use Azure OpenAI API, set `azure` to true and `reverseProxyUrl` to your completion endpoint:
    // azure: true,
    // reverseProxyUrl: 'https://{your-resource-name}.openai.azure.com/openai/deployments/{deployment-id}/chat/completions?api-version={api-version}',
    modelOptions: {
        // You can override the model name and any other parameters here, like so:
        model: 'gpt-3.5-turbo',
        // I'm overriding the temperature to 0 here for demonstration purposes, but you shouldn't need to override this
        // for normal usage.
        temperature: 0,
        // Set max_tokens here to override the default max_tokens of 1000 for the completion.
        // max_tokens: 1000,
    },
    // (Optional) Davinci models have a max context length of 4097 tokens, but you may need to change this for other models.
    // maxContextTokens: 4097,
    // (Optional) You might want to lower this to save money if using a paid model like `text-davinci-003`.
    // Earlier messages will be dropped until the prompt is within the limit.
    //