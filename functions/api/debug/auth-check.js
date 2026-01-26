import { ok, badRequest, forbidden, serverError } from "../_utils/response";
import { readJson } from "../_utils/validate";
import { db, one } from "../_utils/db";
import { verifyPassword } from "../_utils/crypto";

function isDebugAllowed(ctx) {
  const envKey = (ctx.env?.DEBUG_KEY ?? "").toString().trim();
  if (!envKey) return false;
  const url = new URL(ctx.request.url);
  const given = (
    ctx.request.headers.get("X-Debug-Key") ??
    url.searchParams.get("debug_key") ??
    ""
  ).toString().trim();
  return !!given && given === envKey;
}

export async function onRequestPost(ctx) {
  try {
    if (!isDebugAllowed(ctx)) return forbidden("Debug key requerida");

    const body = await readJson(ctx.request);
    const username = (body.username ?? "").toString().trim().toLowerCase();
    const password = (body.password ?? "").toString();
    if (!username) return badRequest("Falta username");
    if (!password) return badRequest("Falta password");

    const d1 = db(ctx);
    const user = await one(
      d1.prepare(
        "SELECT id, username, role, is_active, password_hash FROM users WHERE username=? LIMIT 1"
      ).bind(username)
    );

    if (!user) {
      return ok({ userFound: false });
    }

    const stored = (user.password_hash ?? user.passwordHash ?? "").toString().trim();
    const passOk = await verifyPassword(password, stored);

    return ok({
      userFound: true,
      id: user.id,
      username: user.username,
      role: user.role,
      is_active: user.is_active,
      storedLen: stored.length,
      storedPrefix: stored.slice(0, 18),
      storedParts: stored.split("$").length,
      passOk,
    });
  } catch (err) {
    console.error("debug/auth-check error", err);
    return serverError("debug/auth-check falló");
  }
}
