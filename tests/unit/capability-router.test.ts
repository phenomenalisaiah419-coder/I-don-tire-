import assert from 'node:assert/strict';
import { CapabilityRouter, CapabilityProvider } from '../../packages/ai/src/capability-router';

(async () => {

const provider = (id: string, fail: boolean): CapabilityProvider => ({
  id,
  capabilities: ['edit-plan', 'video-generation'],
  async execute() {
    if (fail) throw new Error(`${id} unavailable`);
    return { provider: id };
  },
});

const router = new CapabilityRouter([provider('primary', true), provider('fallback', false)]);
assert.deepEqual(router.configuredProviders('edit-plan'), ['primary', 'fallback']);
const failures: string[] = [];
const result = await router.execute<{ provider: string }>('edit-plan', {}, {
  onFailure: (attempt) => failures.push(attempt.providerId),
});
assert.equal(result.provider, 'fallback');
assert.deepEqual(failures, ['primary']);
assert.deepEqual(router.configuredProviders('image-generation'), []);
console.log('capability-router.test.ts passed');

})().catch(e => { console.error(e); process.exit(1); });
