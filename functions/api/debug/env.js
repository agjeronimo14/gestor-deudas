import { ok, forbidden, serverError } from "../_utils/response";
import { db, one } from "../_utils/db";

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
    const d1 = db(ctx);
    const runtime = "pages-functions";

    const safe = {
      runtime,
      hasAtob: typeof atob === "function",
      hasBtoa: typeof btoa === "function",
      hasSubtle: !!globalThis.crypto?.subtle,
      hasDB: !!d1,
      hasSetupKey: !!(ctx.env?.SETUP_KEY ?? "").toString().trim(),
      hasDebugKey: !!(ctx.env?.DEBUG_KEY ?? "").toString().trim()
    };

    if (!isDebugAllowed(ctx)) {
      return ok(safe);
    }

    const usersCount = await one(d1.prepare("SELECT COUNT(*) AS c FROM users"));
    const admin = await one(
      d1
        .prepare(
          "SELECT id, username, role, is_active, substr(password_hash,1,20) AS ph_prefix, length(password_hash) AS ph_len FROM users WHERE role='ADMIN' OR role='admin' LIMIT 1"
        )
        .bind()
    );

    return ok({
      ...safe,
      usersCount: usersCount?.c ?? null,
      admin: admin ?? null,
      host: new URL(ctx.request.url).host
    });
  } catch (err) {
    console.error("debug/env error", err);
    return serverError("debug/env falló");
  }
}
