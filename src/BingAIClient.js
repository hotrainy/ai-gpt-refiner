import './fetch-polyfill.js';
import crypto from 'crypto';
import WebSocket from 'ws';
import Keyv from 'keyv';
import { Agent, ProxyAgent } from 'undici';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { BingImageCreator } from '@timefox/bic-sydney';

/**
