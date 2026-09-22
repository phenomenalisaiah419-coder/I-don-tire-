# PHENOVA API Reference

Base: `/` (production: HTTPS only). Auth: `Authorization: Bearer <token>`
from register/login. All errors: `{ "error": string, "code?": string }`
with appropriate HTTP status.

## Auth
| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/v1/auth/register` | `{email, password, displayName?}` | 201 `{user, tokens}`; 400 invalid; 409 duplicate |
| POST | `/v1/auth/login` | `{email, password}` | 200 `{user, tokens}`; 401 bad credentials; 429 throttled |
| POST | `/v1/auth/logout` | – | revokes the presented session |
| POST | `/v1/auth/password-reset/request` | `{email}` | always 200 (no account enumeration) |
| POST | `/v1/auth/password-reset/confirm` | `{token, password}` | rotates password, revokes all sessions |

## Account / billing
| Method | Path | Notes |
|---|---|---|
| GET | `/v1/me` | user, plan, resolutionCap, limits, server pricing, storage usage, today's quota |
| POST | `/v1/billing/subscribe` | `{tier: 3day\|monthly\|yearly, paymentReference}` — requires a server-verified payment reference (402 otherwise) |

## Projects (canonical state)
| Method | Path | Notes |
|---|---|---|
| GET | `/v1/projects` | list (summary) |
| POST | `/v1/projects` | `{name, settings?}` → `{project}` with explicit generation policy |
| GET / PUT / PATCH / DELETE | `/v1/projects/{id}` | PUT validates full canonical state (schema + referential integrity); DELETE soft-deletes |
| POST | `/v1/projects/{id}/restore` | restore soft-deleted project |
| POST | `/v1/projects/{id}/ai-edit` | `{instruction, mediaIds?, constraints?}` → `{plan, project, quotaKind}`; 402 quota/plan limits; 503 no AI provider (quota untouched) |
| POST | `/v1/projects/{id}/ai-correct` | `{previousPlan, instruction, editJobId?}` — targeted corrections, unrelated ops untouched; free plan: 5 accepted per edit |
| POST | `/v1/projects/{id}/export` | `{width?, height?, fps?, quality?, codec?}` → 202 `{job}`; 402 when resolution exceeds plan cap |

## Uploads (chunked / resumable)
| Method | Path | Notes |
|---|---|---|
| POST | `/v1/uploads` | `{filename, totalBytes}` → `{uploadId, chunkBytes}`; 402 storage quota; 413 max size |
| PUT | `/v1/uploads/{id}/chunks/{n}` | raw chunk bytes; idempotent per index |
| POST | `/v1/uploads/{id}/complete` | assembles, magic-byte validates, probes, registers → `{mediaId, probe, sha256}`; 400 content invalid |
| DELETE | `/v1/uploads/{id}` | abort + cleanup |

## Media
`GET /v1/media` (list with provenance + analysis), `GET /v1/media/{id}`
(ownership-enforced). Every asset carries `source` (`user` / `licensed`
/ `generated`) with full provenance metadata.

## Acquisition (licensed providers only)
`GET /v1/acquisition/search?q=&type=video|image` → results with license
name/URL/attribution; `POST /v1/acquisition/import` `{item, projectId?}`
→ downloads from provider CDN (host allow-list), validates, stores under
quota, registers with rights metadata. 503 when no provider keys — never
scrapes arbitrary sites.

## Generation (explicit, policy-gated)
`POST /v1/generate/video|image` `{prompt, durationMs?, aspectRatio?,
style?, projectId?}` → 202 `{job}`. 403 `POLICY_BLOCKED` when the
project's canonical policy forbids generation ("do not generate" is a
hard execution constraint). Provider absence → job fails honestly.

## Jobs
`GET /v1/jobs`, `GET /v1/jobs/{id}`, `POST /v1/jobs/{id}/cancel`,
`POST /v1/jobs/{id}/retry`, `GET /v1/jobs/{id}/download` (completed
exports). States: `queued → processing → completed | failed | cancelled`.
Progress is real (parsed from FFmpeg). Infra retries are automatic and
never consume user quota.

## Capabilities
`GET /v1/capabilities?kind=&platform=` — the versioned registry. Only
`status: "supported"` entries are returned by filtered queries; anything
else is honestly unavailable everywhere in the product.
