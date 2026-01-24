import { ok, badRequest, unauthorized, forbidden, notFound, serverError, withCors, handleOptions } from "../../../_utils/response.js";
import { db, one } from "../../../_utils/db.js";
import { getAuthUser, requireAdmin } from "../../../_utils/auth.js";
import { hashPassword } from "../../../_utils/crypto.js";

function getId(ctx) {
  const id = Number(ctx.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new Error("ID_INVALID");
  return id;
}

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

    if (ctx.request.method !== "POST") return withCors(ctx.request, badRequest("Método inválido"));

    const id = getId(ctx);
    const exists = await one(db(ctx).prepare("SELECT id FROM users WHERE id = ?").bind(id));
    if (!exists) return withCors(ctx.request, notFound("Usuario no existe"));

    const tp = tempPassword();
    const password_hash = await hashPassword(tp);

    await db(ctx).prepare("UPDATE users SET password_hash = ? WHERE id = ?").bind(password_hash, id).run();

    return withCors(ctx.request, ok({ reset: true, temp_password: tp }));
  } catch (e) {
    console.log("[admin/reset-password]", reqId, e?.message || e);
    if (e?.message === "ID_INVALID") return withCors(ctx.request, badRequest("id inválido"));
    return withCors(ctx.request, serverError("Error reseteando password"));
  }
}
