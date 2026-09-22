from contextlib import asynccontextmanager
from fastapi import FastAPI
from .db import init_db
from .routes import project_render, timeline, render_jobs, editplan_render_pipeline, unified_project_renderer, transition_aware_compositor, integrated_project_renderer, project_renderer, timeline_transition_renderer, timeline_transition_chain, overlap_transition_renderer, advanced_multivideo_compositor, multivideo_compositor, render_graph_executor, timeline_render_graph, multitrack_renderer, av_timeline, audio_engine, validated_pipeline, canonical_executor, combined_transform_render, position_keyframe_render, transform_keyframe_render, keyframe_render, transition_render,  compositing,  visual_effects,  caption_render,  captions,  transcript_sync,  rendered_versions,  versioned_execution,  corrections,  director,  creative,  analysis,  audio,  auth, projects, media, edit_plans, jobs, ai, intelligence
from .routes import owner_access, owner_entitlement, premium_entitlements, premium_policy
from .routes import audio_beat_analysis
from .capability_registry import list_capabilities
from .media_engine import ensure_ffmpeg
from .services.render_worker import RenderWorkerSupervisor


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    supervisor = RenderWorkerSupervisor()
    supervisor.start()
    try:
        yield
    finally:
        supervisor.stop()


app = FastAPI(
    title="PHENOVA API",
    version="0.2.0",
    description="Hardened Competitive Edition foundation — real media, validated Edit Plans, provider-neutral AI interfaces",
    lifespan=lifespan,
)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(projects.router, prefix="/api/v1/projects", tags=["projects"])
app.include_router(media.router, prefix="/api/v1/media", tags=["media"])
app.include_router(edit_plans.router, prefix="/api/v1/edit-plans", tags=["edit-plans"])
app.include_router(jobs.router, prefix="/api/v1/jobs", tags=["jobs"])
app.include_router(ai.router, prefix="/api/v1/ai", tags=["ai"])
app.include_router(intelligence.router, prefix="/api/v1/intelligence", tags=["intelligence"])


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "phenova-api",
        "version": "0.2.0",
        "ffmpeg": ensure_ffmpeg(),
    }


@app.get("/api/v1/capabilities")
def capabilities():
    return {"capabilities": list_capabilities(), "ffmpeg_available": ensure_ffmpeg()}

app.include_router(audio.router, prefix="/api/v1/audio", tags=["audio"])

app.include_router(analysis.router, prefix="/api/v1/analysis", tags=["analysis"])

app.include_router(creative.router, prefix="/api/v1/creative", tags=["creative-intelligence"])

app.include_router(director.router, prefix="/api/v1/director", tags=["ai-director"])

app.include_router(corrections.router, prefix="/api/v1/corrections", tags=["corrections"])

app.include_router(versioned_execution.router, prefix="/api/v1/versions", tags=["versioned-execution"])

app.include_router(rendered_versions.router, prefix="/api/v1/rendered-versions", tags=["rendered-versions"])

app.include_router(timeline.router, prefix="/api/v1/timeline", tags=["timeline"])

app.include_router(transcript_sync.router, prefix="/api/v1/transcript-sync", tags=["transcript-sync"])

app.include_router(captions.router, prefix="/api/v1/captions", tags=["captions"])

app.include_router(caption_render.router, prefix="/api/v1/caption-render", tags=["caption-render"])

app.include_router(visual_effects.router, prefix="/api/v1/effects", tags=["visual-effects"])

app.include_router(compositing.router, prefix="/api/v1/compositing", tags=["compositing"])

app.include_router(transition_render.router, prefix="/api/v1/render-effects", tags=["render-effects"])
app.include_router(keyframe_render.router, prefix="/api/v1/keyframe-render", tags=["keyframe-render"])
app.include_router(transform_keyframe_render.router, prefix="/api/v1/transform-keyframes", tags=["transform-keyframes"])
app.include_router(position_keyframe_render.router, prefix="/api/v1/position-keyframes", tags=["position-keyframes"])
app.include_router(combined_transform_render.router, prefix="/api/v1/combined-transform", tags=["combined-transform"])

app.include_router(canonical_executor.router, prefix="/api/v1/executor", tags=["canonical-executor"])

app.include_router(validated_pipeline.router, prefix="/api/v1/pipeline", tags=["validated-pipeline"])

app.include_router(audio_engine.router, prefix="/api/v1/audio-engine", tags=["audio-engine"])

app.include_router(av_timeline.router, prefix="/api/v1/av-timeline", tags=["av-timeline"])

app.include_router(multitrack_renderer.router, prefix="/api/v1/multitrack", tags=["multitrack"])

app.include_router(timeline_render_graph.router, prefix="/api/v1/render-graph", tags=["render-graph"])

app.include_router(render_graph_executor.router, prefix="/api/v1/render-graph-executor", tags=["render-graph-execution"])

app.include_router(multivideo_compositor.router, prefix="/api/v1/multivideo", tags=["multivideo"])

app.include_router(advanced_multivideo_compositor.router, prefix="/api/v1/advanced-compositor", tags=["advanced-compositor"])

app.include_router(overlap_transition_renderer.router, prefix="/api/v1/overlap-transition", tags=["overlap-transition"])

app.include_router(timeline_transition_chain.router, prefix="/api/v1/timeline-transitions", tags=["timeline-transitions"])

app.include_router(timeline_transition_renderer.router, prefix="/api/v1/timeline-transition-render", tags=["timeline-transition-renderer"])

app.include_router(project_renderer.router, prefix="/api/v1/project-render", tags=["project-render"])

app.include_router(integrated_project_renderer.router, prefix="/api/v1/integrated-render", tags=["integrated-render"])

app.include_router(transition_aware_compositor.router, prefix="/api/v1/transition-aware", tags=["transition-aware"])

app.include_router(unified_project_renderer.router, prefix="/api/v1/render", tags=["unified-render"])

app.include_router(editplan_render_pipeline.router, prefix="/api/v1/edit-plan", tags=["edit-plan-render"])

app.include_router(render_jobs.router, prefix="/api/v1/render-jobs", tags=["render-jobs"])

app.include_router(project_render.router, prefix="/api/v1/projects-render", tags=["project-render"])

# Newly wired in this pass — these route files existed in the codebase but were
# never registered on the app, so their endpoints (owner setup/auth, owner and
# premium entitlement checks, premium policy/edit gating) were unreachable.
app.include_router(owner_access.router, prefix="/api/v1/owner-access", tags=["owner-access"])
app.include_router(owner_entitlement.router, prefix="/api/v1/owner-entitlement", tags=["owner-entitlement"])
app.include_router(premium_entitlements.router, prefix="/api/v1/premium-entitlements", tags=["premium-entitlements"])
app.include_router(premium_policy.router, prefix="/api/v1/premium-policy", tags=["premium-policy"])

# New in the merged master build — ported from the DeepSeek submission (see
# MASTER_BUILD_NOTES.md). Optional: degrades to a clear 503 if librosa isn't installed.
app.include_router(audio_beat_analysis.router, prefix="/api/v1/audio-beat-analysis", tags=["audio-beat-analysis"])
