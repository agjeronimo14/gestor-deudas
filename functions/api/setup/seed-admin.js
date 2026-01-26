import { ok, badRequest, forbidden, serverError, handleOptions, withCors } from "../_utils/response.js";
import { readJson } from "../_utils/validate.js";
import { db, one } from "../_utils/db.js";
import { hashPassword } from "../_utils/crypto.js";

function getProvidedKey(req) {
  const url = new URL(req.url);
  return (
    req.headers.get("X-Setup-Key") ??
    url.searchParams.get("setup_key") ??
    ""
  )
    .toString()
    .trim();
}

function getEnvKey(ctx) {
  const k = (ctx.env?.SETUP_KEY ?? "").toString().trim();
  return k || null;
}

function isDebug(ctx) {
  const expected = (ctx.env?.DEBUG_KEY ?? "").toString().trim();
  const provided = (ctx.request.headers.get("X-Debug-Key") ?? "").toString().trim();
  return expected && provided && expected === provided;
}

export async function onRequestOptions(ctx) {
  return handleOptions(ctx.request);
}

export async function onRequestPost(ctx) {
  const reqId = (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(16).slice(2));
  try {
    const envKey = getEnvKey(ctx);
    if (!envKey) return forbidden("Setup no configurado (falta SETUP_KEY)");

    const given = getProvidedKey(ctx.request);
    if (!given) return forbidden("Setup key requerida");
    if (given !== envKey) return forbidden("Setup key inválida");

    const body = await readJson(ctx.request);
    const username = (body?.username ?? "admin").toString().trim().toLowerCase();
    const password = (body?.password ?? "Admin123!").toString();

    if (username.length < 3) return badRequest("Username inválido");
    if (password.length < 6) return badRequest("Password inválida");

    const password_hash = await hashPassword(password, 120000);

    const d1 = db(ctx);
    const existing = await one(
      d1
        .prepare("SELECT id, username FROM users WHERE username=? LIMIT 1")
        .bind(username)
    );

    if (existing) {
      await d1
        .prepare(
          "UPDATE users SET password_hash=?, role='ADMIN', is_active=1 WHERE username=?"
        )
        .bind(password_hash, username)
        .run();
      return ok({ updated: true, username });
    }

    await d1
      .prepare(
        "INSERT INTO users (username,password_hash,role,is_active) VALUES (?,?, 'ADMIN', 1)"
      )
      .bind(username, password_hash)
      .run();

    return ok({ created: true, username });
  } catch (err) {
    console.error("seed-admin error", reqId, err);
    if (isDebug(ctx)) {
      return serverError({
        ok: false,
        error: "Error en setup",
        reqId,
        detail: String(err?.message ?? err),
        stack: err?.stack || null,
      });
    }
    return serverError(`Error en setup (reqId=${reqId})`);
  }
}
