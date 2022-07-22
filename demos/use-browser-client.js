
// import { ChatGPTBrowserClient } from '@waylaidwanderer/chatgpt-api';
import { ChatGPTBrowserClient } from '../index.js';

const clientOptions = {
    // (Optional) Support for a reverse proxy for the completions endpoint (private API server).
    // Warning: This will expose your access token to a third party. Consider the risks before using this.
    reverseProxyUrl: 'https://bypass.churchless.tech/api/conversation',