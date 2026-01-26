import { json, badRequest, unauthorized, serverError } from "../_utils/response.js";
import { handleOptions, withCors } from "../_utils/auth.js";
import { db } from "../_utils/db.js";
import { verifyPassword } from "../_utils/crypto.js";

// Debug endpoint to diagnose auth issues.
// Protect it with an env var DEBUG_KEY and header X-Debug-Key.
export async function onRequest(ctx) {
  const opt = handleOptions(ctx.request);
  if (opt) return opt;

  try {
    const debugKey = String(ctx.env?.DEBUG_KEY || "").trim();
    if (!debugKey) {
      return withCors(ctx.request, unauthorized("DEBUG_KEY no configurada"));
    }

    const provided = String(ctx.request.headers.get("X-Debug-Key") || "").trim();
    if (provided !== debugKey) {
      return withCors(ctx.request, unauthorized("Debug key inválida"));
    }

    let body = null;
    try {
      body = await ctx.request.json();
    } catch {
      body = null;
    }

    const username = String(body?.username || "").trim();
    const password = String(body?.password || "");
    if (!username || !password) {
      return withCors(ctx.request, badRequest("username y password requeridos"));
    }

    const d = db(ctx);
    const user = await d
      .prepare("SELECT id, username, role, is_active, password_hash FROM users WHERE username=?")
      .bind(username.toLowerCase())
      .first();

    if (!user) {
      return withCors(ctx.request, json({ ok: true, userFound: false }));
    }

    const hash = String(user.password_hash || "");
    let verifyOk = false;
    let err = null;
    try {
      verifyOk = await verifyPassword(password, hash);
    } catch (e) {
      err = String(e?.message || e);
    }

    return withCors(
      ctx.request,
      json({
        ok: true,
        userFound: true,
        id: user.id,
        username: user.username,
        role: user.role,
        is_active: user.is_active,
        hashPrefix: hash.slice(0, 20),
        hashLen: hash.length,
        verifyOk,
        verifyError: err,
      })
    );
  } catch (e) {
    return withCors(ctx.request, serverError("Error debug auth-check"));
  }
}
