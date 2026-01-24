import { ok, badRequest, unauthorized, forbidden, notFound, serverError, withCors, handleOptions } from "../_utils/response.js";
import { db, one } from "../_utils/db.js";
import { getAuthUser } from "../_utils/auth.js";
import {
  readJson,
  optString,
  oneOf,
  optNumber,
  normalizeCurrency,
  reqString
} from "../_utils/validate.js";

function getId(ctx) {
  const id = Number(ctx.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new Error("ID_INVALID");
  return id;
}

export async function onRequest(ctx) {
  const opt = handleOptions(ctx.request);
  if (opt) return opt;

  const reqId = crypto.randomUUID();
  try {
    const user = await getAuthUser(ctx);
    if (!user) return withCors(ctx.request, unauthorized("No logueado"));

    const id = getId(ctx);

    const acc = await one(db(ctx).prepare("SELECT * FROM accounts WHERE id = ? AND deleted_at IS NULL").bind(id));
    if (!acc) return withCors(ctx.request, notFound("Cuenta no existe"));

    if (acc.owner_user_id !== user.id) return withCors(ctx.request, forbidden("Solo OWNER puede modificar"));

    if (ctx.request.method === "PUT") {
      const body = await readJson(ctx.request);
      if (!body) return withCors(ctx.request, badRequest("JSON inválido"));

      const title = body.title != null ? reqString(body.title, "title", { min: 2, max: 80 }) : undefined;
      const kind = body.kind != null ? oneOf(body.kind, "kind", ["PAYABLE", "RECEIVABLE"]) : undefined;
      const currency = body.currency != null ? normalizeCurrency(body.currency) : undefined;
      const weekly_target = body.weekly_target !== undefined ? optNumber(body.weekly_target, "weekly_target", { min: 0 }) : undefined;
      const pay_to = body.pay_to !== undefined ? optString(body.pay_to, "pay_to", { max: 80 }) : undefined;
      const notes = body.notes !== undefined ? optString(body.notes, "notes", { max: 500 }) : undefined;

      const viewer_username_raw = body.viewer_username !== undefined ? optString(body.viewer_username, "viewer_username", { max: 40 }) : undefined;
      let viewer_user_id = undefined;

      if (viewer_username_raw !== undefined) {
        if (viewer_username_raw === null) {
          viewer_user_id = null;
        } else {
          const v = await one(
            db(ctx).prepare("SELECT id FROM users WHERE username = ? AND is_active=1").bind(viewer_username_raw.toLowerCase())
          );
          if (!v) return withCors(ctx.request, badRequest("viewer_username no existe"));
          if (v.id === user.id) return withCors(ctx.request, badRequest("viewer no puede ser el mismo owner"));
          viewer_user_id = v.id;
        }
      }

      const fields = [];
      const binds = [];

      const setIf = (name, val) => {
        if (val === undefined) return;
        if (val === null) {
          fields.push(`${name} = NULL`);
          return;
        }
        fields.push(`${name} = ?`);
        binds.push(val);
      };

      setIf("title", title);
      setIf("kind", kind);
      setIf("currency", currency);
      setIf("weekly_target", weekly_target);
      setIf("pay_to", pay_to);
      setIf("notes", notes);
      setIf("viewer_user_id", viewer_user_id);

      if (!fields.length) return withCors(ctx.request, badRequest("Nada para actualizar"));

      binds.push(id);
      await db(ctx)
        .prepare(`UPDATE accounts SET ${fields.join(", ")} WHERE id = ?`)
        .bind(...binds)
        .run();

      return withCors(ctx.request, ok({ updated: true }));
    }

    if (ctx.request.method === "DELETE") {
      await db(ctx).prepare("UPDATE accounts SET deleted_at = datetime('now') WHERE id = ?").bind(id).run();
      return withCors(ctx.request, ok({ deleted: true }));
    }

    return withCors(ctx.request, badRequest("Método inválido"));
  } catch (e) {
    console.log("[accounts/:id]", reqId, e?.message || e);
    if (e?.message === "ID_INVALID") return withCors(ctx.request, badRequest("id inválido"));
    if (e?.message === "UNAUTHORIZED") return withCors(ctx.request, unauthorized());
    if (e?.message === "FORBIDDEN") return withCors(ctx.request, forbidden());
    return withCors(ctx.request, serverError("Error en /accounts/:id"));
  }
}
