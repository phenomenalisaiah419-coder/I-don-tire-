/**
 * Phenova Edit Engine – high-level façade
 *
 * This is what the Flutter client and the AI layer talk to.
 * It owns a ProjectState and exposes clean methods for both
 * manual editing and AI-driven editing.
 *
 * AI features REQUIRE a real direct provider client. There is no mock.
 */

import {
  ProjectState,
  Project,
  TimelineEvent,
  createEmptyProject,
  applyEvent,
  undo as coreUndo,
  redo as coreRedo,
  MediaAsset,
  UUID,
  Milliseconds,
  Track,
  createTrack,
  createClip,
} from '@phenova/core';
import {
  AIOrchestrator,
  EditPlan,
  EditConstraints,
  ToolExecutor,
  ToolContext,
  DirectProviderModelRouter,
  DirectProviderClient,
  PHENOVA_SYSTEM_PROMPT,
} from '@phenova/ai';
import { assertSupported } from '@phenova/core';
import * as coreOps from '@phenova/core';

export class PhenovaEditor {
  private state: ProjectState;
  private orchestrator: AIOrchestrator | null = null;
  private providerClient: DirectProviderClient | null = null;

  /**
   * Load an existing canonical project (e.g. from durable server storage)
   * instead of starting fresh. Used by the API server for server-side
   * plan application.
   */
  static fromProject(project: Project, providerClient?: DirectProviderClient): PhenovaEditor {
    const editor = new PhenovaEditor(project.meta.name, providerClient);
    editor.state = {
      project: structuredClone(project),
      events: [{ type: 'PROJECT_CREATED', project: structuredClone(project), timestamp: new Date().toISOString() }],
      currentIndex: 0,
      namedVersions: [],
    };
    return editor;
  }

  constructor(projectName = 'Untitled', providerClient?: DirectProviderClient) {
    const project = createEmptyProject(projectName);
    this.state = {
      project,
      events: [],
      currentIndex: -1,
      namedVersions: [],
    };

    if (providerClient) {
      this.setProviderClient(providerClient);
    }

    // Seed with PROJECT_CREATED
    this.dispatch({
      type: 'PROJECT_CREATED',
      project,
      timestamp: new Date().toISOString(),
    });
  }

  // -----------------------------------------------------------------------
  // State access
  // -----------------------------------------------------------------------

  get project(): Project {
    return this.state.project;
  }

  get historyLength(): number {
    return this.state.events.length;
  }

  get canUndo(): boolean {
    return this.state.currentIndex > 0;
  }

  get canRedo(): boolean {
    return this.state.currentIndex < this.state.events.length - 1;
  }

  get hasAI(): boolean {
    return this.orchestrator !== null;
  }

  /** Replace the entire project state (e.g. restore from durable storage). */
  loadProject(project: Project): void {
    this.state = {
      project: structuredClone(project),
      events: [{ type: 'PROJECT_CREATED', project: structuredClone(project), timestamp: new Date().toISOString() }],
      currentIndex: 0,
      namedVersions: [],
    };
  }



  /** Expose provider client for generation service */
  getDirectProviderClient(): DirectProviderClient | null {
    return this.providerClient;
  }

  // -----------------------------------------------------------------------
  // Manual editing API
  // -----------------------------------------------------------------------

  addMedia(media: MediaAsset): void {
    this.dispatch({
      type: 'MEDIA_ADDED',
      media,
      timestamp: new Date().toISOString(),
    });
  }

  addTrack(type: Track['type'], name: string): UUID {
    const order = this.state.project.tracks.length;
    const track = createTrack(type, name, order);
    this.dispatch({
      type: 'TRACK_ADDED',
      track,
      timestamp: new Date().toISOString(),
    });
    return track.id;
  }

  addClip(
    mediaId: UUID,
    trackId: UUID,
    timelineStartMs: Milliseconds,
    sourceInMs: Milliseconds,
    sourceOutMs: Milliseconds
  ): UUID {
    const clip = createClip(mediaId, trackId, timelineStartMs, sourceInMs, sourceOutMs);
    this.dispatch({
      type: 'CLIP_ADDED',
      clip,
      timestamp: new Date().toISOString(),
    });
    return clip.id;
  }

  trimClip(
    clipId: UUID,
    sourceInMs: Milliseconds,
    sourceOutMs: Milliseconds,
    timelineStartMs: Milliseconds
  ): void {
    this.dispatch({
      type: 'CLIP_TRIMMED',
      clipId,
      sourceInMs,
      sourceOutMs,
      timelineStartMs,
      timestamp: new Date().toISOString(),
    });
  }

  setClipSpeed(clipId: UUID, speed: number, reverse = false): void {
    this.dispatch({
      type: 'CLIP_UPDATED',
      clipId,
      changes: { speed, reverse },
      timestamp: new Date().toISOString(),
    });
  }

  moveClip(clipId: UUID, newTrackId: UUID, newStartMs: Milliseconds): void {
    this.dispatch({
      type: 'CLIP_MOVED',
      clipId,
      newTrackId,
      newStartMs,
      timestamp: new Date().toISOString(),
    });
  }

  removeClip(clipId: UUID): void {
    this.dispatch({
      type: 'CLIP_REMOVED',
      clipId,
      timestamp: new Date().toISOString(),
    });
  }

  // -----------------------------------------------------------------------
  // Extended manual editing (spec §3)
  // -----------------------------------------------------------------------

  splitClip(clipId: UUID, atTimelineMs: Milliseconds): void {
    for (const e of coreOps.splitClip(this.state.project, clipId, atTimelineMs)) this.dispatch(e);
  }

  mergeClips(clipIdA: UUID, clipIdB: UUID): void {
    for (const e of coreOps.mergeClips(this.state.project, clipIdA, clipIdB)) this.dispatch(e);
  }

  reorderClip(clipId: UUID, newStartMs: Milliseconds): void {
    for (const e of coreOps.reorderClip(this.state.project, clipId, newStartMs)) this.dispatch(e);
  }

  rippleDeleteClip(clipId: UUID): void {
    for (const e of coreOps.rippleDeleteClip(this.state.project, clipId)) this.dispatch(e);
  }

  insertFreezeFrame(clipId: UUID, atTimelineMs: Milliseconds, durationMs: Milliseconds): void {
    for (const e of coreOps.insertFreezeFrame(this.state.project, clipId, atTimelineMs, durationMs)) this.dispatch(e);
  }

  addTransition(clipId: UUID, side: 'in' | 'out', transition: import('@phenova/core').TransitionInstance | null): void {
    this.dispatch({ type: 'TRANSITION_SET', clipId, side, transition, timestamp: new Date().toISOString() });
  }

  addEffect(clipId: UUID, effect: import('@phenova/core').EffectInstance): void {
    // Only registry-supported effects may be added (spec §10/§19)
    assertSupported(effect.effectId, 'server');
    this.dispatch({ type: 'EFFECT_ADDED', clipId, effect, timestamp: new Date().toISOString() });
  }

  removeEffect(clipId: UUID, effectId: UUID): void {
    this.dispatch({ type: 'EFFECT_REMOVED', clipId, effectId, timestamp: new Date().toISOString() });
  }

  addKeyframe(clipId: UUID, keyframe: import('@phenova/core').Keyframe): void {
    this.dispatch({ type: 'KEYFRAME_ADDED', clipId, keyframe, timestamp: new Date().toISOString() });
  }

  setVolume(clipId: UUID, volume: number): void {
    if (volume < 0 || volume > 2) throw new Error('Volume must be 0..2');
    this.dispatch({ type: 'CLIP_UPDATED', clipId, changes: { volume }, timestamp: new Date().toISOString() });
  }


  setMuted(clipId: UUID, muted: boolean): void {
    this.dispatch({ type: 'CLIP_UPDATED', clipId, changes: { muted }, timestamp: new Date().toISOString() });
  }

  /** HTTP-friendly aliases used by engine-server routes */
  reverseClip(clipId: UUID): void {
    const clip = this.findClip(clipId);
    this.setClipSpeed(clipId, clip?.speed ?? 1, !(clip?.reverse ?? false));
  }

  applyEffect(clipId: UUID, effectId: string, params: Record<string, unknown> = {}): void {
    const id = `${effectId}_${Date.now()}`;
    this.addEffect(clipId, {
      id,
      effectId,
      enabled: true,
      params,
      keyframes: [],
    } as any);
  }

  applyTransition(clipId: UUID, transitionId: string, durationMs = 500, side: 'in' | 'out' = 'out'): void {
    this.addTransition(clipId, side, {
      id: `${transitionId}_${Date.now()}`,
      transitionId,
      durationMs,
      params: {},
      easing: 'easeInOut',
    } as any);
  }

  setMask(clipId: UUID, maskType: string, params: Record<string, unknown> = {}): void {
    this.applyEffect(clipId, `mask_${maskType}`, params);
  }

  async trackMotion(clipId: UUID): Promise<unknown> {
    // Bake motion track via render package when available; store marker effect
    this.applyEffect(clipId, 'motion_track', { status: 'requested' });
    return { clipId, status: 'requested' };
  }

  async removeBackground(clipId: UUID): Promise<void> {
    this.applyEffect(clipId, 'background_remove', { status: 'requested' });
  }

  addTextOverlay(text: string, timelineStartMs = 0, durationMs = 3000): void {
    // Prefer text track
    let textTrack = this.state.project.tracks.find((t) => t.type === 'text');
    if (!textTrack) {
      const id = this.addTrack('text', 'Text 1');
      textTrack = this.state.project.tracks.find((t) => t.id === id);
    }
    this.addCaption({
      id: `cap_${Date.now()}`,
      text,
      startMs: timelineStartMs,
      endMs: timelineStartMs + durationMs,
      style: { fontSize: 48, color: '#FFFFFF' },
    } as any);
  }

  async autoCaptions(mediaId?: string): Promise<unknown> {
    return { status: 'requested', mediaId, note: 'Wire ASR provider for production captions' };
  }

  private findClip(clipId: UUID): import('@phenova/core').Clip | undefined {
    for (const t of this.state.project.tracks) {
      const c = t.clips.find((x) => x.id === clipId);
      if (c) return c;
    }
    return undefined;
  }


  addCaption(caption: import('@phenova/core').Caption): void {
    this.dispatch({ type: 'CAPTION_ADDED', caption, timestamp: new Date().toISOString() });
  }

  addMarker(marker: import('@phenova/core').Marker): void {
    this.dispatch({ type: 'MARKER_ADDED', marker, timestamp: new Date().toISOString() });
  }

  /** Set project-level source/generation policy (spec §5 – hard constraint). */
  setPolicy(policy: NonNullable<Project['policy']>): void {
    const project = structuredClone(this.state.project);
    project.policy = policy;
    this.dispatch({ type: 'PROJECT_RESTORED', project, fromVersion: project.meta.version, timestamp: new Date().toISOString() });
  }

  // -----------------------------------------------------------------------
  // AI Editing API – requires real direct provider client
  // -----------------------------------------------------------------------

  /**
   * “Take these clips and make me a 30-second cinematic edit”
   * Throws if no real provider client has been set.
   */
  async aiEdit(
    instruction: string,
    mediaIds: UUID[],
    constraints: Partial<EditConstraints> = {}
  ): Promise<EditPlan> {
    this.assertAI();
    return this.orchestrator!.createEditPlan(
      instruction,
      this.state.project,
      mediaIds,
      constraints
    );
  }

  /**
   * Apply an accepted plan to the timeline.
   */
  applyPlan(plan: EditPlan): void {
    const ctx = this.buildToolContext();
    const executor = new ToolExecutor(ctx);
    const events = executor.executePlan(plan);
    for (const event of events) {
      this.dispatch(event);
    }
  }

  /**
   * Correction loop: “make the transitions smoother”
   */
  async aiCorrect(previousPlan: EditPlan, instruction: string): Promise<EditPlan> {
    this.assertAI();
    return this.orchestrator!.correctPlan(
      { previousPlanId: previousPlan.id, instruction },
      previousPlan,
      this.state.project
    );
  }

  /**
   * One-shot: plan + apply
   */
  async aiEditAndApply(
    instruction: string,
    mediaIds: UUID[],
    constraints: Partial<EditConstraints> = {}
  ): Promise<EditPlan> {
    const plan = await this.aiEdit(instruction, mediaIds, constraints);
    this.applyPlan(plan);
    return plan;
  }

  // -----------------------------------------------------------------------
  // Undo / Redo / Versions
  // -----------------------------------------------------------------------

  undo(): void {
    this.state = coreUndo(this.state);
  }

  redo(): void {
    this.state = coreRedo(this.state);
  }

  nameVersion(name: string): void {
    this.dispatch({
      type: 'VERSION_NAMED',
      name,
      eventIndex: this.state.currentIndex,
      timestamp: new Date().toISOString(),
    });
  }

  // -----------------------------------------------------------------------
  // Direct provider – REAL ONLY
  // -----------------------------------------------------------------------

  /**
   * Supply your real direct provider client.
   * Until this is called, all AI methods throw.
   */
  setProviderClient(client: DirectProviderClient): void {
    if (!client) {
      throw new Error('DirectProviderClient is required. No mock is provided.');
    }
    this.providerClient = client;
    const router = new DirectProviderModelRouter(client, PHENOVA_SYSTEM_PROMPT);
    this.orchestrator = new AIOrchestrator(router);
  }

  /** Backward-compatible alias for older integrations. */
  setDirectProviderClient(client: DirectProviderClient): void {
    this.setProviderClient(client);
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  private assertAI(): void {
    if (!this.orchestrator || !this.providerClient) {
      throw new Error(
        'AI features require a real direct provider client. Call editor.setDirectProviderClient(yourClient) first. No mock is available.'
      );
    }
  }

  private dispatch(event: TimelineEvent): void {
    this.state = applyEvent(this.state, event);
  }

  private buildToolContext(): ToolContext {
    const videoTrackIds = this.state.project.tracks
      .filter(t => t.type === 'video')
      .map(t => t.id);
    const audioTrackIds = this.state.project.tracks
      .filter(t => t.type === 'audio')
      .map(t => t.id);
    const overlayTrackIds = this.state.project.tracks
      .filter(t => t.type === 'overlay' || t.type === 'text')
      .map(t => t.id);

    const mediaDurations: Record<UUID, Milliseconds> = {};
    for (const [id, media] of Object.entries(this.state.project.media)) {
      mediaDurations[id] = media.durationMs;
    }

    return { videoTrackIds, audioTrackIds, overlayTrackIds, mediaDurations };
  }
}
