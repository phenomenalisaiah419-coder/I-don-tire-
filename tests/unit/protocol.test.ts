/**
 * AI protocol tests — EditPlan schema, generation gating, source-policy
 * enforcement, correction diffs (spec §4/§5/§17).
 *
 * Run: npx tsx tests/unit/protocol.test.ts
 */

import { v4 as uuidv4 } from 'uuid';
import {
  EditPlanSchema,
  EditConstraintsSchema,
  validatePlanAgainstConstraints,
  isGenerationTool,
  ToolExecutor,
  ToolContext,
  EditPlan,
} from '../../packages/ai/src';
import { createEmptyProject, createTrack } from '../../packages/core/src';

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) { failed++; console.error(`  FAIL: ${msg}`); } else { passed++; console.log(`  OK: ${msg}`); }
}

const constraints = EditConstraintsSchema.parse({});
const M1 = '11111111-1111-4111-8111-111111111111';

function makePlan(toolCalls: Array<{ tool: string; arguments: Record<string, unknown> }>): EditPlan {
  return EditPlanSchema.parse({
    id: uuidv4(),
    intent: 'test',
    constraints,
    steps: [{ id: uuidv4(), description: 'step', toolCalls }],
    confidence: 0.9,
    requiresUserApproval: false,
    createdAt: new Date().toISOString(),
  });
}

console.log('== Plan schema & constraint validation ==');
{
  assert(constraints.useOnlyUserFootage === true && constraints.allowGeneration === false,
    'defaults are safe: user footage only, no generation');

  const editPlan = makePlan([
    { tool: 'place_clip', arguments: { mediaId: M1, trackType: 'video', timelineStartMs: 0 } },
  ]);
  assert(validatePlanAgainstConstraints(editPlan).length === 0, 'pure editing plan passes validation');

  const genPlan = makePlan([{ tool: 'generate_video', arguments: { prompt: 'city', durationMs: 5000 } }]);
  const errors = validatePlanAgainstConstraints(genPlan);
  assert(errors.length >= 2, 'generation under default constraints is blocked twice (generation + user-only)');
  assert(isGenerationTool('generate_video') && !isGenerationTool('place_clip'), 'generation tools classified');

  const allowed = makePlan([{ tool: 'generate_video', arguments: { prompt: 'city', durationMs: 5000 } }]);
  allowed.constraints = { ...constraints, allowGeneration: true, useOnlyUserFootage: false };
  assert(validatePlanAgainstConstraints(allowed).length === 0, 'generation passes only when explicitly authorized');

  const schemaBad = EditPlanSchema.safeParse({ id: 'not-a-uuid' });
  assert(!schemaBad.success, 'malformed plan rejected by schema');
}

console.log('== ToolExecutor: plan → events ==');
{
  const project = createEmptyProject('t');
  const ctx: ToolContext = {
    videoTrackIds: [project.tracks[0].id],
    audioTrackIds: [project.tracks[1].id],
    overlayTrackIds: [],
    mediaDurations: { [M1]: 8000 },
  };
  const executor = new ToolExecutor(ctx);
  const plan = makePlan([
    { tool: 'place_clip', arguments: { mediaId: M1, trackType: 'video', timelineStartMs: 0, sourceInMs: 0, sourceOutMs: 3000 } },
    { tool: 'add_transition', arguments: { clipId: 'self', side: 'out', transitionId: 'crossfade', durationMs: 500 } },
  ]);
  const events = executor.executePlan(plan);
  assert(events.some(e => e.type === 'CLIP_ADDED'), 'place_clip produces CLIP_ADDED');
  const clipAdded = events.find(e => e.type === 'CLIP_ADDED');
  assert(clipAdded?.type === 'CLIP_ADDED' && clipAdded.clip.sourceOutMs === 3000, 'placed clip respects source range');

  // generation tools blocked at execution level too (defense in depth)
  const genPlan = makePlan([{ tool: 'generate_video', arguments: { prompt: 'x', durationMs: 1000 } }]);
  let threw = false;
  try { executor.executePlan(genPlan); } catch { threw = true; }
  assert(threw, 'executor refuses generation tools when constraints forbid them (hard constraint, spec §5)');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
