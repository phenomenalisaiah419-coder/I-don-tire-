/**
 * Server configuration (spec §13/§15).
 * Separate dev/staging/prod environments; secrets server-side only;
 * no development URLs in production.
 */

export type Env = 'development' | 'staging' | 'production';

export interface ServerConfig {
  env: Env;
  port: number;
  databasePath: string;          // sqlite file in dev; DATABASE_URL in prod (see db/migrations)
  dataDir: string;               // media/object storage root
  jwtSecret: string;
  sessionTtlHours: number;
  bcryptRounds: number;
  maxUploadBytes: number;
  uploadChunkBytes: number;
  freeStorageBytes: number;
  premiumStorageBytes: number;
  providerApiKey?: string;
  providerBaseUrl?: string;
  pexelsApiKey?: string;
  pixabayApiKey?: string;
  renderWorkDir: string;
  ffmpegPath: string;
  ffprobePath: string;
  corsOrigins: string[];
  rateLimitPerMinute: number;
}

function required(name: string, env: Env): string {
  const v = process.env[name];
  if (!v) {
    if (env === 'production') {
      throw new Error(`Missing required environment variable ${name} in production`);
    }
    return '';
  }
  return v;
}

export function loadConfig(): ServerConfig {
  const env = (process.env.PHENOVA_ENV ?? 'development') as Env;
  if (!['development', 'staging', 'production'].includes(env)) {
    throw new Error(`Invalid PHENOVA_ENV "${env}"`);
  }

  const jwtSecret = process.env.PHENOVA_JWT_SECRET ?? '';
  if (env === 'production' && jwtSecret.length < 32) {
    throw new Error('PHENOVA_JWT_SECRET must be set and at least 32 chars in production');
  }

  const dataDir = process.env.PHENOVA_DATA_DIR ?? `${process.cwd()}/.phenova-data`;

  return {
    env,
    port: Number(process.env.PHENOVA_API_PORT ?? 8788),
    databasePath: process.env.PHENOVA_DB_PATH ?? `${dataDir}/phenova.db`,
    dataDir,
    jwtSecret: jwtSecret || 'dev-only-insecure-secret-change-me',
    sessionTtlHours: Number(process.env.PHENOVA_SESSION_TTL_HOURS ?? 720),
    bcryptRounds: 12,
    maxUploadBytes: Number(process.env.PHENOVA_MAX_UPLOAD_BYTES ?? 4 * 1024 * 1024 * 1024), // 4GB
    uploadChunkBytes: Number(process.env.PHENOVA_UPLOAD_CHUNK_BYTES ?? 8 * 1024 * 1024),     // 8MB
    freeStorageBytes: Number(process.env.PHENOVA_FREE_STORAGE_BYTES ?? 2 * 1024 * 1024 * 1024),
    premiumStorageBytes: Number(process.env.PHENOVA_PREMIUM_STORAGE_BYTES ?? 100 * 1024 * 1024 * 1024),
    providerApiKey: process.env.PHENOVA_PROVIDER_API_KEY,
    providerBaseUrl: process.env.PHENOVA_PROVIDER_BASE_URL,
    pexelsApiKey: process.env.PEXELS_API_KEY,
    pixabayApiKey: process.env.PIXABAY_API_KEY,
    renderWorkDir: process.env.PHENOVA_RENDER_WORKDIR ?? `${dataDir}/render`,
    ffmpegPath: process.env.FFMPEG_PATH ?? 'ffmpeg',
    ffprobePath: process.env.FFPROBE_PATH ?? 'ffprobe',
    corsOrigins: (process.env.PHENOVA_CORS_ORIGINS ?? '*').split(',').map(s => s.trim()),
    rateLimitPerMinute: Number(process.env.PHENOVA_RATE_LIMIT_PER_MINUTE ?? 120),
  };
}

/** spec §14: production API must use HTTPS – enforced at deploy layer; warn here. */
export function assertProductionSafety(cfg: ServerConfig): string[] {
  const warnings: string[] = [];
  if (cfg.env === 'production') {
    if (cfg.jwtSecret.includes('dev-only')) warnings.push('Insecure JWT secret in production');
    if (cfg.corsOrigins.includes('*')) warnings.push('Wildcard CORS in production');
    if (!cfg.databasePath) warnings.push('No durable database configured');
  }
  return warnings;
}
