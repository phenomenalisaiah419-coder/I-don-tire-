/**
 * PHENOVA capability router.
 *
 * Routes each capability to an ordered list of direct providers. Providers are
 * attempted in order; failures are isolated per capability. No external
 * orchestration server is required.
 */

export type PhenovaCapability =
  | 'edit-plan'
  | 'media-understanding'
  | 'video-generation'
  | 'image-generation';

export interface CapabilityProvider {
  id: string;
  capabilities: readonly PhenovaCapability[];
  execute<T>(capability: PhenovaCapability, request: unknown): Promise<T>;
}

export interface CapabilityAttempt {
  providerId: string;
  error: unknown;
}

export interface CapabilityRouterOptions {
  timeoutMs?: number;
}

export class CapabilityRouter {
  private readonly providers = new Map<PhenovaCapability, CapabilityProvider[]>();
  private readonly timeoutMs?: number;

  constructor(providers: readonly CapabilityProvider[], options: CapabilityRouterOptions = {}) {
    this.timeoutMs = options.timeoutMs;
    const seen = new Set<string>();

    for (const provider of providers) {
      if (!provider.id.trim()) throw new Error('Provider id cannot be empty');
      if (seen.has(provider.id)) throw new Error(`Duplicate direct provider id: ${provider.id}`);
      seen.add(provider.id);

      for (const capability of provider.capabilities) {
        const list = this.providers.get(capability) ?? [];
        list.push(provider);
        this.providers.set(capability, list);
      }
    }
  }

  configuredProviders(capability: PhenovaCapability): readonly string[] {
    return (this.providers.get(capability) ?? []).map((provider) => provider.id);
  }

  async execute<T>(
    capability: PhenovaCapability,
    request: unknown,
    options: { onFailure?: (attempt: CapabilityAttempt) => void } = {},
  ): Promise<T> {
    const providers = this.providers.get(capability) ?? [];
    if (providers.length === 0) {
      throw new Error(`No direct PHENOVA provider configured for ${capability}`);
    }

    let lastError: unknown;
    for (const provider of providers) {
      try {
        const operation = provider.execute<T>(capability, request);
        return await (this.timeoutMs && this.timeoutMs > 0
          ? this.withTimeout(operation, this.timeoutMs, provider.id)
          : operation);
      } catch (error) {
        lastError = error;
        options.onFailure?.({ providerId: provider.id, error });
      }
    }

    throw new Error(
      `All direct PHENOVA providers failed for ${capability}: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`,
    );
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, providerId: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`Provider ${providerId} timed out after ${timeoutMs}ms`)), timeoutMs);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
