import { ok, forbidden, serverError } from "../_utils/response";
import { db, all, one } from "../_utils/db";

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

export async function onRequestGet(ctx) {
  try {
    if (!isDebugAllowed(ctx)) return forbidden("Debug key requerida");

    const d1 = db(ctx);
    const usersSchema = await all(d1.prepare("PRAGMA table_info(users)"));
    const sessionsSchema = await all(d1.prepare("PRAGMA table_info(sessions)"));

    const users = await all(
      d1.prepare(
        "SELECT id, username, role, is_active, length(password_hash) AS ph_len, substr(password_hash,1,20) AS ph_prefix FROM users ORDER BY id LIMIT 20"
      )
    );

    const counts = {
      users: (await one(d1.prepare("SELECT COUNT(*) AS c FROM users")))?.c ?? null,
      sessions: (await one(d1.prepare("SELECT COUNT(*) AS c FROM sessions")))?.c ?? null
    };

    return ok({ counts, usersSchema, sessionsSchema, users });
  } catch (err) {
    console.error("debug/db error", err);
    return serverError("debug/db falló");
  }
}
