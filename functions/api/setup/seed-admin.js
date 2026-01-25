import { ok, badRequest, forbidden, serverError, withCors, handleOptions } from "../_utils/response.js";
import { db } from "../_utils/db.js";
import { readJson, reqString } from "../_utils/validate.js";
import { hashPassword } from "../_utils/crypto.js";

// Endpoint de emergencia para sembrar/resetear el admin.
// Seguridad: requiere header X-Setup-Key que coincida con env.SETUP_KEY.
export async function onRequest(ctx) {
  const opt = handleOptions(ctx.request);
  if (opt) return opt;

  const reqId = crypto.randomUUID();
  try {
    if (ctx.request.method !== "POST") return withCors(ctx.request, badRequest("Método inválido"));

    const setupKey = ctx.env?.SETUP_KEY;
    const given = ctx.request.headers.get("X-Setup-Key") || "";
    if (!setupKey || given !== setupKey) return withCors(ctx.request, forbidden("Setup key inválida"));

    const body = await readJson(ctx.request);
    if (!body) return withCors(ctx.request, badRequest("JSON inválido"));

    const username = reqString(body.username || "admin", "username", { min: 3, max: 40 }).toLowerCase();
    const password = reqString(body.password, "password", { min: 6, max: 200 });

    const ph = await hashPassword(password);

    // Primero intentamos UPDATE (si existe)
    const upd = await db(ctx)
      .prepare("UPDATE users SET password_hash=?, role='ADMIN', is_active=1, updated_at=datetime('now') WHERE username=?")
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
    console.log("[setup/seed-admin]", reqId, e?.message || e);
    return withCors(ctx.request, serverError("Error en setup"));
  }
}
