/**
 * @phenova/ai public surface.
 *
 * All direct-provider entry points are funnelled through `./direct-provider`
 * so there is exactly one canonical provider barrel and no duplicate names.
 */

export * from './protocol';
export * from './orchestrator';
export * from './tools';
export * from './stock';
export * from './generation';

// Canonical direct-provider barrel (client, failover, env factories, router adapter).
export * from './direct-provider';
