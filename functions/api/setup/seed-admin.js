import { ok, badRequest, forbidden, serverError, withCors, handleOptions } from "../_utils/response.js";
import { db } from "../_utils/db.js";
import { readJson, reqString } from "../_utils/validate.js";
import { hashPassword } from "../_utils/crypto.js";

// Endpoint de emergencia para sembrar/resetear el admin.
// Seguridad: requiere header X-Setup-Key que coincida con env.SETUP_KEY.
export async function onRequest(ctx) {
  const opt = handleOptions(ctx.request);
  if (opt) return opt;

  const reqId = (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : `setup_${Date.now()}`;
  try {
    if (ctx.request.method !== "POST") return withCors(ctx.request, badRequest("Método inválido"));

    // Trim to avoid hidden whitespace/newlines in env vars or copied headers
    const setupKey = (ctx.env?.SETUP_KEY || "").trim();

    // Soportamos el setup key en:
    // - Header: X-Setup-Key
    // - Query: ...?setup_key=...
    // - Body: { setup_key: "..." }
    const url = new URL(ctx.request.url);
    const givenHeader = (ctx.request.headers.get("X-Setup-Key") || "").trim();
    const givenQuery = (url.searchParams.get("setup_key") || url.searchParams.get("key") || "").trim();

    // Leemos JSON (si existe) para permitir setup_key en body
    const body = await readJson(ctx.request);
    if (!body) return withCors(ctx.request, badRequest("JSON inválido"));
    const givenBody = String(body.setup_key ?? body.setupKey ?? "").trim();

    const given = givenHeader || givenQuery || givenBody;
    if (!setupKey) return withCors(ctx.request, forbidden("Setup no configurado"));
    if (!given || given !== setupKey) return withCors(ctx.request, forbidden("Setup key inválida"));

    const username = reqString(body.username || "admin", "username", { min: 3, max: 40 }).toLowerCase();
    const password = reqString(body.password, "password", { min: 6, max: 200 });

    const ph = await hashPassword(password);

    // Primero intentamos UPDATE (si existe)
    const upd = await db(ctx)
      .prepare(
        "UPDATE users SET password_hash=?, role='ADMIN', is_active=1, updated_at=datetime('now') WHERE username=? COLLATE NOCASE"
      )
      .bind(ph, username)
      .run();

    if ((upd?.meta?.changes || 0) === 0) {
      // Si no existía, insertamos
      await db(ctx)
        .prepare("INSERT INTO users (username, password_hash, role, is_active) VALUES (?, ?, 'ADMIN', 1)")
        .bind(username, ph)
        .run();
    }

    return withCors(ctx.request, ok({ username }));
  } catch (e) {
    console.error("[setup/seed-admin] reqId=", reqId, e);
    // Nota: serverError() no serializa detalles. Dejamos el reqId en el mensaje
    // para que puedas correlacionar con los logs de Cloudflare.
    return withCors(ctx.request, serverError(`Error en setup (reqId: ${reqId})`));
  }
}
