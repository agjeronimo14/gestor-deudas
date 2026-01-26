import { ok, serverError, withCors, handleOptions } from "../_utils/response.js";
import { db, one } from "../_utils/db.js";

export async function onRequest(ctx) {
  const opt = handleOptions(ctx.request);
  if (opt) return opt;

  const reqId = crypto.randomUUID();
  try {
    const hasAtob = typeof atob === "function";
    const hasBtoa = typeof btoa === "function";
    const hasCryptoSubtle = !!(globalThis.crypto && crypto.subtle);
    const setupKeyPresent = !!(ctx.env?.SETUP_KEY && String(ctx.env.SETUP_KEY).trim().length > 0);

    const c = await one(db(ctx).prepare("SELECT COUNT(*) as n FROM users"));
    const admin = await one(db(ctx).prepare("SELECT id, is_active, length(password_hash) as len, substr(password_hash,1,25) as pref FROM users WHERE username='admin'"));

    return withCors(ctx.request, ok({
      runtime: "pages-functions",
      hasAtob,
      hasBtoa,
      hasCryptoSubtle,
      setupKeyPresent,
      usersCount: Number(c?.n || 0),
      admin: admin ? { id: Number(admin.id), is_active: Number(admin.is_active), len: Number(admin.len), pref: admin.pref } : null
    }));
  } catch (e) {
    console.log("[debug/env]", reqId, e?.message || e);
    return withCors(ctx.request, serverError("debug error"));
  }
}
