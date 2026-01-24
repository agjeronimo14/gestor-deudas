import { ok, badRequest, unauthorized, forbidden, serverError, withCors, handleOptions } from "../_utils/response.js";
import { db, all, one } from "../_utils/db.js";
import { getAuthUser } from "../_utils/auth.js";
import {
  readJson,
  reqString,
  optString,
  oneOf,
  reqNumber,
  optNumber,
  normalizeCurrency
} from "../_utils/validate.js";

export async function onRequest(ctx) {
  const opt = handleOptions(ctx.request);
  if (opt) return opt;

  const reqId = crypto.randomUUID();
  try {
    const user = await getAuthUser(ctx);
    if (!user) return withCors(ctx.request, unauthorized("No logueado"));

    if (ctx.request.method === "GET") {
      const rows = await all(
        db(ctx)
          .prepare(
            `
          SELECT
            a.id, a.title, a.kind, a.currency, a.initial_amount, a.weekly_target, a.pay_to, a.notes,
            a.owner_user_id, a.viewer_user_id, a.created_at, a.updated_at
          FROM accounts a
          WHERE a.deleted_at IS NULL
            AND (a.owner_user_id = ? OR a.viewer_user_id = ?)
          ORDER BY a.created_at DESC, a.id DESC
        `
          )
          .bind(user.id, user.id)
      );

      const mapped = rows.map((r) => ({
        ...r,
        my_role: r.owner_user_id === user.id ? "OWNER" : "VIEWER",
        can_write: r.owner_user_id === user.id
      }));

      return withCors(ctx.request, ok({ accounts: mapped }));
    }

    if (ctx.request.method === "POST") {
      const body = await readJson(ctx.request);
      if (!body) return withCors(ctx.request, badRequest("JSON inválido"));

      const title = reqString(body.title, "title", { min: 2, max: 80 });
      const kind = oneOf(body.kind, "kind", ["PAYABLE", "RECEIVABLE"]);
      const currency = normalizeCurrency(body.currency);
      const initial_amount = reqNumber(body.initial_amount, "initial_amount", { min: 0 });
      const weekly_target = optNumber(body.weekly_target, "weekly_target", { min: 0 });
      const pay_to = optString(body.pay_to, "pay_to", { max: 80 });
      const notes = optString(body.notes, "notes", { max: 500 });

      const viewer_username_raw = optString(body.viewer_username, "viewer_username", { max: 40 });
      let viewer_user_id = null;

      if (viewer_username_raw) {
        const viewer_username = viewer_username_raw.toLowerCase();
        const v = await one(
          db(ctx)
            .prepare("SELECT id FROM users WHERE username = ? AND is_active = 1")
            .bind(viewer_username)
        );
        if (!v) return withCors(ctx.request, badRequest("viewer_username no existe"));
        if (v.id === user.id) return withCors(ctx.request, badRequest("viewer no puede ser el mismo owner"));
        viewer_user_id = v.id;
      }

      await db(ctx)
        .prepare(
          `
        INSERT INTO accounts (owner_user_id, viewer_user_id, title, kind, currency, initial_amount, weekly_target, pay_to, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .bind(user.id, viewer_user_id, title, kind, currency, initial_amount, weekly_target, pay_to, notes)
        .run();

      return withCors(ctx.request, ok({ created: true }));
    }

    return withCors(ctx.request, badRequest("Método inválido"));
  } catch (e) {
    console.log("[accounts]", reqId, e?.message || e);
    if (e?.message === "UNAUTHORIZED") return withCors(ctx.request, unauthorized());
    if (e?.message === "FORBIDDEN") return withCors(ctx.request, forbidden());
    return withCors(ctx.request, serverError("Error en /accounts"));
  }
}
