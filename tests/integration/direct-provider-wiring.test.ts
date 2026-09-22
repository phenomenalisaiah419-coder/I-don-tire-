import assert from 'node:assert/strict';
import { PhenovaEditor } from '../../packages/engine/src/editor';
import { DirectProviderClient } from '../../packages/ai/src/ifec-platform';

const client = new DirectProviderClient('test-key', { baseUrl: 'http://127.0.0.1:9' });
const editor = new PhenovaEditor('Direct provider wiring');
editor.setProviderClient(client);
assert.equal(editor.hasAI, true);
console.log('PASS direct provider wiring');
