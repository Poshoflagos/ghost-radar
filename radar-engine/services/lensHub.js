// radar-engine/services/lensHub.js
// Tiny shared channel: collectors announce new tokens, Ghost Lens listens.
import { EventEmitter } from 'node:events';

export const lensHub = new EventEmitter();
lensHub.setMaxListeners(20);