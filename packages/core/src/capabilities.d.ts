/**
 * Phenova Capability Registry
 *
 * Master Spec §10/§19: "Maintain a versioned capability registry listing
 * supported operations, constraints, platform support and test coverage.
 * Unsupported effects must not appear as available."
 *
 * The UI, the AI tool surface and the render layer ALL read from this
 * registry. A capability that is not registered as `supported` must never
 * be shown as available anywhere in the product.
 */
export type Platform = 'android' | 'ios' | 'server' | 'web';
export type CapabilityStatus = 'supported' | 'unavailable' | 'experimental';
export interface CapabilityEntry {
    /** Stable id used by clips/effects/transitions, e.g. "gaussian_blur" */
    id: string;
    kind: 'effect' | 'transition' | 'operation' | 'export' | 'audio' | 'generation' | 'acquisition';
    status: CapabilityStatus;
    platforms: Platform[];
    /** Human-readable constraints, e.g. "max 4K source", "audio media only" */
    constraints: string[];
    /** FFmpeg filter / implementation reference – empty when not renderable */
    implementation: string;
    /** Which automated suite covers this capability */
    testCoverage: string[];
    since: string;
}
export declare const CAPABILITY_REGISTRY_VERSION = "1.0.0";
export declare const CAPABILITIES: CapabilityEntry[];
export declare function getCapability(id: string): CapabilityEntry | undefined;
export declare function isSupported(id: string, platform: Platform): boolean;
export declare function listAvailable(kind: CapabilityEntry['kind'], platform: Platform): CapabilityEntry[];
/**
 * Guard used by engine + render layers. Throws on unsupported capability so
 * unsupported effects can never silently "succeed".
 */
export declare function assertSupported(id: string, platform: Platform): CapabilityEntry;
