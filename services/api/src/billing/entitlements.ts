/**
 * Entitlements & quota engine (spec §12).
 *
 * All rules are enforced SERVER-SIDE. Prices and limits are configurable
 * through the plan_config table — never hardcoded as the source of truth;
 * the constants below are only the shipped defaults.
 *
 *   Premium: 15 clips, 5 min/clip or one video ≤ 2h, 1080p, no daily edit
 *            restriction, unlimited corrections.
 *   Free:    first month — 1 Pro edit/day (first 3 days 1080p, then 720p);
 *            after first month — 2 Basic edits/day at 720p.
 *   Free Basic limits: 5 clips, 5 min/clip, or one video ≤ 30 min.
 *   Free completed edit: up to 5 accepted corrections (infra retries free).
 *   Quotas reset at 00:00 UTC using SERVER time.
 *   Only ACCEPTED distinct edit jobs consume quota: pre-acceptance
 *   validation failures and automatic infrastructure retries do not;
 *   same-state rerenders do not; a user-requested new edit does.
 */

import { DataStore } from '../db';
import { ApiError } from '../auth';

export interface PlanLimits {
  maxClips: number;
  maxClipDurationMs: number;
  maxSingleVideoMs: number;
  maxExportHeight: number;
  proEditsPerDay: number | null;   // null = unlimited
  basicEditsPerDay: number | null;
  maxCorrectionsPerEdit: number | null; // null = unlimited
}

export const DEFAULT_PRICING = {
  currencyLocal: 'NGN',
  tiers: {
    '3day': { local: 1500, usd: 1 },
    monthly: { local: 15000, usd: 10 },
    yearly: { local: 90000, usd: null },
  },
};

const PREMIUM_LIMITS: PlanLimits = {
  maxClips: 15,
  maxClipDurationMs: 5 * 60_000,
  maxSingleVideoMs: 2 * 3600_000,
  maxExportHeight: 1080,
  proEditsPerDay: null,
  basicEditsPerDay: null,
  maxCorrectionsPerEdit: null,
};

const FREE_PRO_LIMITS: PlanLimits = {
  ...PREMIUM_LIMITS, // Pro edit days use pro limits during first month
  proEditsPerDay: 1,
  basicEditsPerDay: 0,
  maxCorrectionsPerEdit: 5,
};

const FREE_BASIC_LIMITS: PlanLimits = {
  maxClips: 5,
  maxClipDurationMs: 5 * 60_000,
  maxSingleVideoMs: 30 * 60_000,
  maxExportHeight: 720,
  proEditsPerDay: 0,
  basicEditsPerDay: 2,
  maxCorrectionsPerEdit: 5,
};

const FIRST_MONTH_MS = 30 * 24 * 3600_000;
const FIRST_MONTH_FULL_RES_MS = 3 * 24 * 3600_000;

export function utcToday(now = new Date()): string {
  // Server-side 00:00 UTC reset (spec §12).
  return now.toISOString().slice(0, 10);
}

export class EntitlementService {
  constructor(private db: DataStore) {}

  getPlan(userId: string): 'free' | 'premium' {
    const sub = this.db.getSubscription(userId);
    if (!sub || sub.plan !== 'premium') return 'free';
    if (sub.status !== 'active') return 'free';
    if (sub.expires_at && sub.expires_at < new Date().toISOString()) return 'free';
    return 'premium';
  }

  /** Pricing is configurable server-side; falls back to shipped defaults. */
  getPricing(): typeof DEFAULT_PRICING {
    return (this.db.getPlanConfig('pricing') as typeof DEFAULT_PRICING) ?? DEFAULT_PRICING;
  }

  limitsFor(userId: string, accountCreatedAt: string, now = new Date()): { plan: 'free' | 'premium'; limits: PlanLimits; resolutionCap: number; freeTier: 'pro-window' | 'first-month' | 'basic' | null } {
    const plan = this.getPlan(userId);
    if (plan === 'premium') {
      return { plan, limits: PREMIUM_LIMITS, resolutionCap: 1080, freeTier: null };
    }
    const ageMs = now.getTime() - new Date(accountCreatedAt).getTime();
    if (ageMs < FIRST_MONTH_MS) {
      const cap = ageMs < FIRST_MONTH_FULL_RES_MS ? 1080 : 720;
      const limits: PlanLimits = { ...FREE_PRO_LIMITS, maxExportHeight: cap };
      return { plan, limits, resolutionCap: cap, freeTier: ageMs < FIRST_MONTH_FULL_RES_MS ? 'pro-window' : 'first-month' };
    }
    return { plan, limits: FREE_BASIC_LIMITS, resolutionCap: 720, freeTier: 'basic' };
  }

  /**
   * Check whether the user may start a NEW user-requested edit.
   * Returns the quota kind that will be consumed on acceptance.
   * Does NOT consume — consumption happens in consumeEdit() after the
   * edit job is accepted (spec §12).
   */
  checkNewEdit(userId: string, accountCreatedAt: string, now = new Date()): { allowed: boolean; quotaKind: 'pro' | 'basic' | null; reason?: string } {
    const { plan, limits } = this.limitsFor(userId, accountCreatedAt, now);
    if (plan === 'premium') return { allowed: true, quotaKind: null };

    const today = utcToday(now);
    const quota = this.db.getQuota(userId, today);
    if (limits.proEditsPerDay && quota.pro_edits_used < limits.proEditsPerDay) {
      return { allowed: true, quotaKind: 'pro' };
    }
    if (limits.basicEditsPerDay && quota.basic_edits_used < limits.basicEditsPerDay) {
      return { allowed: true, quotaKind: 'basic' };
    }
    return {
      allowed: false,
      quotaKind: null,
      reason: limits.proEditsPerDay
        ? 'Daily Pro edit already used on the Free plan. Upgrade to Premium for unlimited edits.'
        : 'Daily Basic edit limit reached (2/day). Quotas reset at 00:00 UTC. Upgrade to Premium for unlimited edits.',
    };
  }

  /** Consume quota after a distinct edit job is ACCEPTED. */
  consumeEdit(userId: string, kind: 'pro' | 'basic', now = new Date()): void {
    this.db.incrementQuota(userId, utcToday(now), kind);
  }

  /**
   * Enforce clip/duration constraints for an edit request against plan limits.
   */
  assertEditWithinLimits(
    userId: string,
    accountCreatedAt: string,
    clipCount: number,
    perClipDurationsMs: number[],
    now = new Date(),
  ): void {
    const { limits, plan } = this.limitsFor(userId, accountCreatedAt, now);
    const label = plan === 'premium' ? 'Premium' : 'Free';

    if (clipCount > limits.maxClips) {
      throw new ApiError(402, `${label} plan allows at most ${limits.maxClips} clips per edit (got ${clipCount})`, 'PLAN_LIMIT');
    }
    if (clipCount === 1) {
      if (perClipDurationsMs[0] > limits.maxSingleVideoMs) {
        throw new ApiError(402, `${label} plan allows a single video up to ${Math.round(limits.maxSingleVideoMs / 60000)} minutes`, 'PLAN_LIMIT');
      }
      return;
    }
    for (const d of perClipDurationsMs) {
      if (d > limits.maxClipDurationMs) {
        throw new ApiError(402, `${label} plan allows clips up to ${Math.round(limits.maxClipDurationMs / 60000)} minutes each`, 'PLAN_LIMIT');
      }
    }
  }

  /** Export resolution gate — honest refusal, not silent downscale. */
  assertExportResolution(userId: string, accountCreatedAt: string, height: number, now = new Date()): void {
    const { resolutionCap, plan } = this.limitsFor(userId, accountCreatedAt, now);
    if (height > resolutionCap) {
      throw new ApiError(
        402,
        `${height}p export requires ${resolutionCap >= 1080 ? 'a plan with higher resolution' : 'Premium (or the first-3-days 1080p window)'}. ` +
        `Your ${plan} plan currently exports up to ${resolutionCap}p.`,
        'PLAN_LIMIT',
      );
    }
  }

  /** Corrections: free completed edits allow 5 accepted corrections (§12). */
  assertCorrectionAllowed(userId: string, accountCreatedAt: string, editJobId: string, now = new Date()): void {
    const { plan, limits } = this.limitsFor(userId, accountCreatedAt, now);
    if (plan === 'premium' || limits.maxCorrectionsPerEdit === null) return;
    const row = this.db.getCorrections(editJobId);
    const used = row?.accepted_count ?? 0;
    if (used >= limits.maxCorrectionsPerEdit) {
      throw new ApiError(402, `Free plan allows ${limits.maxCorrectionsPerEdit} corrections per completed edit`, 'PLAN_LIMIT');
    }
  }

  recordAcceptedCorrection(editJobId: string, userId: string): number {
    return this.db.incrementCorrections(editJobId, userId);
  }

  /**
   * Activate premium after SERVER-SIDE payment verification (spec §12:
   * "Server-side payment verification is mandatory"). The verifier is
   * injected (Play Store / App Store / Stripe / Paystack adapters).
   */
  activatePremium(
    userId: string,
    tier: '3day' | 'monthly' | 'yearly',
    verification: { verified: boolean; reference: string },
  ): void {
    if (!verification.verified || !verification.reference) {
      throw new ApiError(402, 'Payment could not be verified server-side', 'PAYMENT_UNVERIFIED');
    }
    const days = tier === '3day' ? 3 : tier === 'monthly' ? 30 : 365;
    const started = new Date();
    const expires = new Date(started.getTime() + days * 24 * 3600_000);
    this.db.upsertSubscription({
      user_id: userId,
      plan: 'premium',
      status: 'active',
      started_at: started.toISOString(),
      expires_at: expires.toISOString(),
      verified_by: verification.reference,
    });
  }
}
