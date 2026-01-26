import { ok, badRequest, forbidden, serverError } from "../_utils/response";
import { readJson } from "../_utils/validate";
import { db, one } from "../_utils/db";
import { hashPassword } from "../_utils/crypto";

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
    return serverError(`Error en setup (reqId=${reqId})`);
  }
}
