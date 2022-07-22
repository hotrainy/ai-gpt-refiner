// Run the server first with `npm run server`
import { fetchEventSource } from '@waylaidwanderer/fetch-event-source';

const opts = {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({
        message: 'Hello',
        // Set stream to true to receive each token as it is generated.
        stream: true,
    }),
};

try {
    let reply = '';
    const controller = new AbortController();
    await fetchEventSource('http://localhost:3001/conversation', {
        ...opts,
        signal: controller.signal,
        onopen(response) {
            if (response.status === 200) {
                return;
            }
            throw new Error(`Failed to send message. HTTP ${response.status} - ${response.statusText}`);
        },
        onclose() {
            throw new Error('Failed to send message. Server closed the connection unexpectedly.');
        },
        onerror(err) {
            throw err;
        },
        onmessage(message) {
    