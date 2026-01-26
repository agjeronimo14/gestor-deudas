import { ok, serverError, withCors, handleOptions } from "../_utils/response.js";
import { db, one, all } from "../_utils/db.js";

export async function onRequest(ctx) {
  const opt = handleOptions(ctx.request);
  if (opt) return opt;

  const reqId = (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : `req_${Date.now()}`;
  try {
    const hasAtob = typeof atob === "function";
    const hasBtoa = typeof btoa === "function";
    const hasCryptoSubtle = !!(globalThis.crypto && crypto.subtle);
    const setupKeyStr = String(ctx.env?.SETUP_KEY || "");
    const setupKeyPresent = setupKeyStr.trim().length > 0;
    const setupKeyLen = setupKeyStr.length;
    const hasDBBinding = !!ctx.env?.DB;

    const c = await one(db(ctx).prepare("SELECT COUNT(*) as n FROM users"));
    const admin = await one(
      db(ctx).prepare(
        "SELECT id, username, role, is_active, length(password_hash) as len, substr(password_hash,1,25) as pref FROM users WHERE username='admin' COLLATE NOCASE"
      )
    );
    const sampleUsers = await all(
      db(ctx).prepare(
        "SELECT id, username, role, is_active, length(username) as ulen, hex(username) as uhex, length(password_hash) as hlen, substr(password_hash,1,15) as hpref FROM users ORDER BY id LIMIT 5"
      )
    );

    return withCors(ctx.request, ok({
      reqId,
      runtime: "pages-functions",
      pages: {
        branch: ctx.env?.CF_PAGES_BRANCH || null,
        commit: ctx.env?.CF_PAGES_COMMIT_SHA || null,
        url: ctx.env?.CF_PAGES_URL || null,
        project: ctx.env?.CF_PAGES_PROJECT_NAME || null,
      },
      hasAtob,
      hasBtoa,
      hasCryptoSubtle,
      setupKeyPresent,
      setupKeyLen,
      hasDBBinding,
      usersCount: Number(c?.n || 0),
      admin: admin ? {
        id: Number(admin.id),
        username: admin.username,
        role: admin.role,
        is_active: Number(admin.is_active),
        len: Number(admin.len),
        pref: admin.pref
      } : null,
      sampleUsers
    }));
  } catch (e) {
    console.log("[debug/env]", reqId, e?.message || e);
    return withCors(ctx.request, serverError("debug error"));
  }
}
