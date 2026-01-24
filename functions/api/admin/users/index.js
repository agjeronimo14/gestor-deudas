import { ok, badRequest, unauthorized, forbidden, serverError, withCors, handleOptions } from "../../_utils/response.js";
import { db, all, one } from "../../_utils/db.js";
import { getAuthUser, requireAdmin } from "../../_utils/auth.js";
import { readJson, reqString, oneOf } from "../../_utils/validate.js";
import { hashPassword } from "../../_utils/crypto.js";

function tempPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function onRequest(ctx) {
  const opt = handleOptions(ctx.request);
  if (opt) return opt;

  const reqId = crypto.randomUUID();
  try {
    const user = await getAuthUser(ctx);
    if (!user) return withCors(ctx.request, unauthorized("No logueado"));
    try {
      requireAdmin(user);
    } catch (e) {
      return withCors(ctx.request, e.message === "FORBIDDEN" ? forbidden() : unauthorized());
    }

    if (ctx.request.method === "GET") {
      const users = await all(
        db(ctx).prepare("SELECT id, username, role, is_active, created_at FROM users ORDER BY created_at DESC, id DESC")
      );
      return withCors(ctx.request, ok({ users }));
    }

    if (ctx.request.method === "POST") {
      const body = await readJson(ctx.request);
      if (!body) return withCors(ctx.request, badRequest("JSON inválido"));

      const username = reqString(body.username, "username", { min: 3, max: 40 }).toLowerCase();
      const role = body.role ? oneOf(body.role, "role", ["USER", "ADMIN"]) : "USER";

      const exists = await one(db(ctx).prepare("SELECT id FROM users WHERE username = ?").bind(username));
      if (exists) return withCors(ctx.request, badRequest("username ya existe"));

      const tp = tempPassword();
      const password_hash = await hashPassword(tp);

      await db(ctx)
        .prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)")
        .bind(username, password_hash, role)
        .run();

      return withCors(ctx.request, ok({ created: true, temp_password: tp }));
    }

    return withCors(ctx.request, badRequest("Método inválido"));
  } catch (e) {
    console.log("[admin/users]", reqId, e?.message || e);
    return withCors(ctx.request, serverError("Error en admin users"));
  }
}
