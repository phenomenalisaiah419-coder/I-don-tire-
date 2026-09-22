import assert from 'node:assert/strict';
import { CapabilityRouter, type CapabilityProvider } from '../../packages/ai/src/capability-router.ts';

(async () => {

const provider = (id: string, result: unknown, delay = 0): CapabilityProvider => ({
  id,
  capabilities: ['edit-plan'],
  async execute() {
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    if (result instanceof Error) throw result;
    return result;
  },
});

assert.throws(() => new CapabilityRouter([provider('same', 1), provider('same', 2)]), /Duplicate/);

const failures: string[] = [];
const router = new CapabilityRouter([provider('slow', 1, 50), provider('backup', 2)], { timeoutMs: 5 });
const result = await router.execute('edit-plan', {}, { onFailure: (attempt) => failures.push(attempt.providerId) });
assert.equal(result, 2);
assert.deepEqual(failures, ['slow']);
console.log('capability-router hardening tests passed');

})().catch(e => { console.error(e); process.exit(1); });
