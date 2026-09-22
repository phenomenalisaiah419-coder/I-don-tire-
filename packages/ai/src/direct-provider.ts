/**
 * PHENOVA-native direct provider surface (canonical barrel).
 *
 * This module is the single public entry point for direct-provider
 * configuration. It previously contained only `export * from './ifec'`,
 * which duplicated names already exported from `./ifec-platform` and made the
 * module an orphan (nothing imported it). It now re-exports the concrete,
 * IFEC-free implementations with explicit named exports so there are no
 * duplicate-export collisions.
 *
 * There is no IFEC server dependency and no mock. A real provider API key is
 * required; without one, construction throws.
 */

// Concrete OpenAI-compatible client + ordered multi-provider failover.
export {
  DirectProviderClient,
  DirectProviderFailover,
  createDirectProviderClientFromEnv,
  createDirectProviderFailoverFromEnv,
  createOpenRouterProviderClientFromEnv,
  type DirectProviderOptions,
} from './ifec-platform';

// Adapter that turns any planEdit-capable client into the orchestrator's ModelRouter.
export { DirectProviderModelRouter } from './ifec';

// The structural client interface (distinct name to avoid colliding with the class above).
export type { DirectProviderClient as DirectProviderClientInterface } from './ifec';

// Capability-level routing across providers.
export {
  CapabilityRouter,
  type CapabilityProvider,
  type CapabilityAttempt,
  type CapabilityRouterOptions,
  type PhenovaCapability,
} from './capability-router';
