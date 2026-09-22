/**
 * Timeline engine unit tests — event application, undo/redo, split/merge,
 * reorder, ripple delete, freeze frames, policy schema validation.
 *
 * Run: npx tsx tests/unit/timeline.test.ts
 */

import {
  createEmptyProject,
  createClip,
  applyEvent,
  applyEvents,
  undo,
  redo,
  ProjectState,
  TimelineEvent,
  MediaAsset,
  splitClip,
  mergeClips,
  reorderClip,
  rippleDeleteClip,
  insertFreezeFrame,
  validateProject,
  VersionStore,
  AIEditLog,
  CAPABILITIES,
  assertSupported,
  isSupported,
  listAvailable,
} from '../../packages/core/src';

let passed = 0;
let failed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) { failed++; console.error(`  FAIL: ${msg}`); }
  else { passed++; console.log(`  OK: ${msg}`); }
}
function assertThrows(fn: () => void, msg: string) {
  try { fn(); failed++; console.error(`  FAIL (no throw): ${msg}`); }
  catch { passed++; console.log(`  OK: ${msg}`); }
}

function freshState(): ProjectState {
  const project = createEmptyProject('Test');
  return applyEvent(
    { project, events: [], currentIndex: -1, namedVersions: [] },
    { type: 'PROJECT_CREATED', project, timestamp: new Date().toISOString() }
  );
}

function media(id: string, durationMs = 10_000): MediaAsset {
  return {
    id,
    source: { kind: 'user', localPath: `/tmp/${id}.mp4` },
    type: 'video',
    durationMs,
    width: 1920,
    height: 1080,
    fps: 30,
    path: `/tmp/${id}.mp4`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

const M1 = '11111111-1111-4111-8111-111111111111';
const M2 = '22222222-2222-4222-8222-222222222222';

console.log('== Timeline core ==');
{
  let state = freshState();
  const trackId = state.project.tracks[0].id;

  state = applyEvent(state, { type: 'MEDIA_ADDED', media: media(M1), timestamp: new Date().toISOString() });
  assert(!!state.project.media[M1], 'media added to project');

  const clip = createClip(M1, trackId, 0, 1000, 6000);
  state = applyEvent(state, { type: 'CLIP_ADDED', clip, timestamp: new Date().toISOString() });
  assert(state.project.tracks[0].clips.length === 1, 'clip added');
  assert(state.project.settings.durationMs === 5000, 'duration derived from clip (speed 1)');

  // speed affects derived duration
  state = applyEvent(state, { type: 'CLIP_UPDATED', clipId: clip.id, changes: { speed: 2 }, timestamp: new Date().toISOString() });
  assert(state.project.settings.durationMs === 2500, '2x speed halves timeline duration');

  // undo/redo
  const before = state.project.settings.durationMs;
  const undone = undo(state);
  assert(undone.project.settings.durationMs === 5000, 'undo restores pre-speed duration');
  const redone = redo(undone);
  assert(redone.project.settings.durationMs === before, 'redo re-applies speed change');

  // media removal cascades to clips
  state = applyEvent(state, { type: 'MEDIA_REMOVED', mediaId: M1, timestamp: new Date().toISOString() });
  assert(state.project.tracks[0].clips.length === 0, 'removing media removes referencing clips');
  assert(state.project.settings.durationMs === 0, 'duration collapses after removal');
}

console.log('== Operations: split / merge / reorder / ripple / freeze ==');
{
  let state = freshState();
  const track = state.project.tracks[0];
  state = applyEvent(state, { type: 'MEDIA_ADDED', media: media(M1, 10_000), timestamp: new Date().toISOString() });
  state = applyEvent(state, { type: 'MEDIA_ADDED', media: media(M2, 4_000), timestamp: new Date().toISOString() });

  const clipA = createClip(M1, track.id, 0, 0, 10_000);
  state = applyEvent(state, { type: 'CLIP_ADDED', clip: clipA, timestamp: new Date().toISOString() });

  // split at 4s → two clips [0..4s][4s..10s]
  let events = splitClip(state.project, clipA.id, 4000);
  state = applyEvents(state, events);
  const clips = state.project.tracks[0].clips;
  assert(clips.length === 2, 'split produces two clips');
  assert(clips[0].sourceOutMs === 4000 && clips[1].sourceInMs === 4000, 'split divides source range at split point');
  assert(clips[1].timelineStartMs === 4000, 'second half starts at split time');
  assertThrows(() => splitClip(state.project, clipA.id, 0), 'split at boundary throws');

  // merge back
  events = mergeClips(state.project, clips[0].id, clips[1].id);
  state = applyEvents(state, events);
  assert(state.project.tracks[0].clips.length === 1, 'merge restores single clip');
  assert(state.project.tracks[0].clips[0].sourceOutMs === 10_000, 'merged clip spans full source');

  // different-media merge rejected
  const clipB = createClip(M2, track.id, 10_000, 0, 4000);
  state = applyEvent(state, { type: 'CLIP_ADDED', clip: clipB, timestamp: new Date().toISOString() });
  assertThrows(() => mergeClips(state.project, state.project.tracks[0].clips[0].id, clipB.id), 'cross-media merge throws');

  // reorder: move M2 clip to position 0 → M1 clip shifts right
  events = reorderClip(state.project, clipB.id, 0);
  state = applyEvents(state, events);
  const ordered = state.project.tracks[0].clips;
  const bNow = ordered.find(c => c.mediaId === M2)!;
  const aNow = ordered.find(c => c.mediaId === M1)!;
  assert(bNow.timelineStartMs === 0, 'reordered clip moves to requested start');
  assert(aNow.timelineStartMs === 4000, 'preceding clip shifts right past moved clip');

  // ripple delete the first clip → second closes the gap
  events = rippleDeleteClip(state.project, bNow.id);
  state = applyEvents(state, events);
  const remaining = state.project.tracks[0].clips;
  assert(remaining.length === 1 && remaining[0].mediaId === M1, 'ripple delete removes target');
  assert(remaining[0].timelineStartMs === 0, 'ripple delete closes the gap');

  // freeze frame insertion
  events = insertFreezeFrame(state.project, remaining[0].id, 5000, 2000);
  state = applyEvents(state, events);
  const afterFreeze = state.project.tracks[0].clips;
  const freeze = afterFreeze.find(c => c.freezeFrameMs);
  assert(!!freeze && freeze.freezeFrameMs === 2000, 'freeze frame segment inserted');
  assert(state.project.settings.durationMs === 12_000, 'freeze extends timeline duration');
}

console.log('== Canonical schema validation ==');
{
  const state = freshState();
  const valid = validateProject(JSON.parse(JSON.stringify(state.project)));
  assert(valid.meta.name === 'Test', 'valid project passes schema validation');
  assert(validateProject({ ...state.project, policy: { sources: 'user-only', allowGeneration: false } }).policy?.sources === 'user-only',
    'project policy represented in canonical state (spec §5)');

  const bad = JSON.parse(JSON.stringify(state.project));
  bad.settings.width = -5;
  assertThrows(() => validateProject(bad), 'negative dimensions rejected');

  const dangling = JSON.parse(JSON.stringify(state.project));
  dangling.tracks[0].clips = [createClip('99999999-9999-4999-8999-999999999999', dangling.tracks[0].id, 0, 0, 1000)];
  assertThrows(() => validateProject(dangling), 'clip referencing missing media rejected');
}

console.log('== Version store & AI edit log ==');
{
  const store = new VersionStore({ retention: 3 });
  const p = createEmptyProject('v');
  for (let i = 0; i < 5; i++) {
    p.meta.version = i + 1;
    store.snapshot(p, { from: 0, to: i }, 'manual');
  }
  assert(store.size === 3, 'retention prunes to configured limit');
  assert(store.latest?.version === 5, 'latest version retained');
  assert(store.get(1) === undefined && store.get(2) === undefined, 'oldest versions pruned');

  store.pin(3);
  store.snapshot(p, { from: 0, to: 5 }, 'manual');
  assert(store.get(3) !== undefined, 'pinned version never pruned');

  const log = new AIEditLog();
  const entry = log.record({ planId: 'p1', intent: 'make it cinematic', version: 5, summary: 'placed 3 clips', affectedClipIds: ['a'] });
  log.setStatus(entry.id, 'accepted');
  assert(log.list()[0].status === 'accepted', 'AI log entries are reviewable (accept/reject)');
}

console.log('== Capability registry ==');
{
  assert(isSupported('gaussian_blur', 'server'), 'registered effect supported on server');
  assert(!isSupported('background_removal', 'server'), 'unshipped ML capability NOT available (no fake capability, spec §19)');
  assertThrows(() => assertSupported('background_removal', 'server'), 'assertSupported throws on unavailable capability');
  assertThrows(() => assertSupported('nonexistent', 'server'), 'assertSupported throws on unknown capability');
  const effects = listAvailable('effect', 'server');
  assert(effects.length > 0 && effects.every(e => e.status === 'supported'), 'UI-visible effect list only contains supported entries');
  assert(CAPABILITIES.some(c => c.id === 'export_4k' && c.constraints.length > 0), '4K export carries honest constraints');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
