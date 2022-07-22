// Run the server first with `npm run server`
import { fetchEventSource } from '@waylaidwanderer/fetch-event-source';

const opts = {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({
        message: 'Hello',
        // Set strea