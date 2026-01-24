import { db, one } from "./db.js";
import { randomToken } from "./crypto.js";

function parseCookies(req) {
  const h = req.headers.get("Cookie") || "";
  const out = {};
  for (const part of h.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (!k) continue;
    out[k] = decodeURIComponent(rest.join("=") || "");
  }
  return out;
}

function cookieBase(req) {
  const url = new URL(req.url);
  const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  return [
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    isLocal ? null : "Secure"
  ].filter(Boolean).join("; ");
}

export function setSessionCookie(req, sessionId, maxAgeSeconds) {
  return `session=${encodeURIComponent(sessionId)}; ${cookieBase(req)}; Max-Age=${maxAgeSeconds}`;
}

export function clearSessionCookie(req) {
  return `session=; ${cookieBase(req)}; Max-Age=0`;
}

export async function createSession(ctx, userId) {
  const sessionId = randomToken(32);
  const ttlSeconds = 60 * 60 * 24 * 30; // 30 días
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

  await db(ctx)
    .prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(sessionId, userId, expiresAt)
    .run();

  return { sessionId, ttlSeconds };
}

export async function destroySession(ctx, sessionId) {
  if (!sessionId) return;
  await db(ctx).prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
}

export async function getAuthUser(ctx) {
  const cookies = parseCookies(ctx.request);
  const sessionId = cookies.session;
  if (!sessionId) return null;

  const s = await one(
    db(ctx).prepare("SELECT id, user_id, expires_at FROM sessions WHERE id = ?").bind(sessionId)
  );
  if (!s) return null;

  const exp = Date.parse(s.expires_at);
  if (!Number.isFinite(exp) || exp <= Date.now()) {
    await destroySession(ctx, sessionId);
    return null;
  }

  const u = await one(
    db(ctx)
      .prepare("SELECT id, username, role, is_active FROM users WHERE id = ?")
      .bind(s.user_id)
  );
  if (!u || u.is_active !== 1) return null;

  return { ...u, sessionId };
}

export function requireAdmin(user) {
  if (!user) throw new Error("UNAUTHORIZED");
  if (user.role !== "ADMIN") throw new Error("FORBIDDEN");
  return user;
}
