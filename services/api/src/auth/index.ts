/**
 * Authentication service (spec §12).
 *
 * - Email/password with bcrypt hashing
 * - Persistent sessions with opaque bearer tokens (hashed at rest)
 * - Secure logout (revocation) and account recovery architecture
 * - Rate-limited attempts to slow credential attacks
 */

import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { DataStore, UserRow } from '../db';
import { ServerConfig } from '../config';

export interface AuthTokens {
  token: string;
  expiresAt: string;
}

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

export class AuthService {
  private attempts = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private db: DataStore,
    private config: ServerConfig,
  ) {}

  private toPublic(u: UserRow): PublicUser {
    return { id: u.id, email: u.email, displayName: u.display_name, createdAt: u.created_at };
  }

  private checkRateLimit(key: string): void {
    const now = Date.now();
    const entry = this.attempts.get(key);
    if (entry && entry.resetAt > now && entry.count >= 10) {
      throw new ApiError(429, 'Too many attempts. Try again later.');
    }
    if (!entry || entry.resetAt <= now) {
      this.attempts.set(key, { count: 1, resetAt: now + 60_000 });
    } else {
      entry.count++;
    }
  }

  async register(email: string, password: string, displayName?: string): Promise<{ user: PublicUser; tokens: AuthTokens }> {
    const cleanEmail = String(email ?? '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new ApiError(400, 'A valid email address is required');
    }
    if (typeof password !== 'string' || password.length < 8) {
      throw new ApiError(400, 'Password must be at least 8 characters');
    }
    if (this.db.getUserByEmail(cleanEmail)) {
      throw new ApiError(409, 'An account with this email already exists');
    }
    const user: UserRow = {
      id: uuidv4(),
      email: cleanEmail,
      password_hash: await bcrypt.hash(password, this.config.bcryptRounds),
      display_name: (displayName ?? '').slice(0, 80),
      created_at: new Date().toISOString(),
      deleted_at: null,
    };
    this.db.createUser(user);
    // Every account starts on the free plan (server-owned entitlement).
    this.db.upsertSubscription({
      user_id: user.id,
      plan: 'free',
      status: 'active',
      started_at: new Date().toISOString(),
      expires_at: null,
      verified_by: 'system:default-free',
    });
    const tokens = this.createSession(user.id);
    return { user: this.toPublic(user), tokens };
  }

  async login(email: string, password: string): Promise<{ user: PublicUser; tokens: AuthTokens }> {
    const cleanEmail = String(email ?? '').trim().toLowerCase();
    this.checkRateLimit(`login:${cleanEmail}`);
    const user = this.db.getUserByEmail(cleanEmail);
    if (!user) throw new ApiError(401, 'Invalid email or password');
    const ok = await bcrypt.compare(String(password ?? ''), user.password_hash);
    if (!ok) throw new ApiError(401, 'Invalid email or password');
    return { user: this.toPublic(user), tokens: this.createSession(user.id) };
  }

  /** Account recovery architecture: issue a single-use reset token. */
  async requestPasswordReset(email: string): Promise<{ issued: boolean }> {
    const cleanEmail = String(email ?? '').trim().toLowerCase();
    this.checkRateLimit(`reset:${cleanEmail}`);
    // Always return success to avoid account enumeration.
    const user = this.db.getUserByEmail(cleanEmail);
    if (!user) return { issued: true };
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hash(token);
    // Stored as a short-lived session tagged via id prefix; mail delivery is
    // environment-specific (SMTP/provider notify), hooked via onResetToken callback.
    this.db.createSession({
      id: `reset:${uuidv4()}`,
      user_id: user.id,
      token_hash: tokenHash,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
      revoked_at: null,
    });
    this.onResetToken?.(user, token);
    return { issued: true };
  }

  /** Delivery hook – wire to your mailer in production. */
  onResetToken?: (user: UserRow, token: string) => void;

  async resetPassword(token: string, newPassword: string): Promise<void> {
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      throw new ApiError(400, 'Password must be at least 8 characters');
    }
    const session = this.db.getSessionByTokenHash(this.hash(String(token ?? '')));
    if (!session || !session.id.startsWith('reset:')) throw new ApiError(400, 'Invalid or expired reset token');
    if (session.expires_at < new Date().toISOString()) throw new ApiError(400, 'Invalid or expired reset token');
    const hash = await bcrypt.hash(newPassword, this.config.bcryptRounds);
    // rotate password + revoke everything
    const user = this.db.getUser(session.user_id);
    if (!user) throw new ApiError(400, 'Invalid or expired reset token');
    (this.db as any).db?.prepare?.('UPDATE users SET password_hash = ? WHERE id = ?')?.run(hash, user.id);
    this.db.revokeAllSessions(user.id);
  }

  logout(token: string): void {
    this.db.revokeSession(this.hash(token));
  }

  authenticate(authorizationHeader: string | undefined): PublicUser {
    if (!authorizationHeader?.startsWith('Bearer ')) {
      throw new ApiError(401, 'Authentication required');
    }
    const token = authorizationHeader.slice('Bearer '.length).trim();
    const session = this.db.getSessionByTokenHash(this.hash(token));
    if (!session || session.id.startsWith('reset:')) throw new ApiError(401, 'Invalid session');
    if (session.expires_at < new Date().toISOString()) throw new ApiError(401, 'Session expired');
    const user = this.db.getUser(session.user_id);
    if (!user) throw new ApiError(401, 'Account not found');
    return this.toPublic(user);
  }

  private createSession(userId: string): AuthTokens {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + this.config.sessionTtlHours * 3600_000).toISOString();
    this.db.createSession({
      id: uuidv4(),
      user_id: userId,
      token_hash: this.hash(token),
      created_at: new Date().toISOString(),
      expires_at: expiresAt,
      revoked_at: null,
    });
    return { token, expiresAt };
  }

  private hash(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}
