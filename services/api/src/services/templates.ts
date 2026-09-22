/**
 * Phenova template catalog + apply → EditPlan-like structure for the engine.
 */

export interface TemplateDef {
  id: string;
  title: string;
  category: string;
  description: string;
  durationMs: number;
  tags: string[];
}

const TEMPLATES: TemplateDef[] = [
  {
    id: 'cinematic',
    title: 'Cinematic Present',
    category: 'For You',
    description: 'Slow dissolves, gentle Ken Burns, film grain',
    durationMs: 30000,
    tags: ['cinematic', 'kenburns'],
  },
  {
    id: 'birthday',
    title: 'Happy Birthday',
    category: 'Daily life',
    description: 'Upbeat cuts, text cards, warm grade',
    durationMs: 25000,
    tags: ['birthday', 'celebration'],
  },
  {
    id: 'wedding',
    title: 'Wedding Film',
    category: 'Pro',
    description: 'Soft transitions, romantic pacing',
    durationMs: 45000,
    tags: ['wedding'],
  },
  {
    id: 'travel',
    title: 'Travel Vlog',
    category: 'Daily life',
    description: 'Dynamic cuts, map-style energy',
    durationMs: 35000,
    tags: ['travel'],
  },
  {
    id: 'product',
    title: 'Product Ad',
    category: 'Pro',
    description: 'Punchy cuts, product focus',
    durationMs: 15000,
    tags: ['ads'],
  },
  {
    id: 'night_city',
    title: 'Night City',
    category: 'Cinematic',
    description: 'Moody grade, slow motion highlights',
    durationMs: 28000,
    tags: ['urban'],
  },
];

export function listTemplates(): TemplateDef[] {
  return TEMPLATES;
}

/** Build a minimal plan object the editor can apply (operations list). */
export function applyTemplate(templateId: string, mediaIds: string[]): Record<string, unknown> {
  const tpl = TEMPLATES.find((t) => t.id === templateId) || TEMPLATES[0];
  const ids = mediaIds.filter(Boolean);
  if (!ids.length) {
    // No media yet — return plan skeleton only (caller must import media first)
    return {
      id: `plan_${templateId}_${Date.now()}`,
      templateId,
      title: TEMPLATES.find((x) => x.id === templateId)?.title || templateId,
      steps: [],
      estimatedDurationMs: TEMPLATES.find((x) => x.id === templateId)?.durationMs || 30000,
      warning: 'No mediaIds provided — import media before applying clip placements',
    };
  }
  const clipDuration = Math.floor(tpl.durationMs / ids.length);
  const steps: Array<Record<string, unknown>> = [];

  let t = 0;
  for (let i = 0; i < ids.length; i++) {
    steps.push({
      op: 'place_clip',
      mediaId: ids[i],
      timelineStartMs: t,
      durationMs: clipDuration,
      transform: tpl.tags.includes('kenburns')
        ? { scaleFrom: 1.0, scaleTo: 1.12, easing: 'easeInOut' }
        : undefined,
    });
    if (i < ids.length - 1) {
      steps.push({
        op: 'transition',
        type: 'crossfade',
        durationMs: 500,
        atMs: t + clipDuration - 250,
      });
    }
    t += clipDuration - 250;
  }

  if (tpl.tags.includes('cinematic') || tpl.id === 'cinematic') {
    steps.push({ op: 'effect_global', effectId: 'film_grain', params: { amount: 0.25 } });
  }
  if (tpl.id === 'birthday') {
    steps.push({
      op: 'text',
      text: 'Happy Birthday',
      timelineStartMs: 0,
      durationMs: 3000,
    });
  }

  return {
    id: `plan_${tpl.id}_${Date.now()}`,
    templateId: tpl.id,
    title: tpl.title,
    steps,
    estimatedDurationMs: tpl.durationMs,
  };
}
