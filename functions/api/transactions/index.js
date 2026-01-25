import { ok, badRequest, unauthorized, forbidden, notFound, serverError, withCors, handleOptions } from "../_utils/response.js";
import { db, all, one } from "../_utils/db.js";
import { getAuthUser } from "../_utils/auth.js";
import { readJson, reqNumber, oneOf, reqDateYYYYMMDD, optString, normalizeCurrency } from "../_utils/validate.js";

async function getAccountIfVisible(ctx, userId, accountId) {
  return await one(
    db(ctx)
      .prepare(
        `
      SELECT
        a.id, a.title, a.kind, a.currency, a.initial_amount,
        a.owner_user_id, a.viewer_user_id
      FROM accounts a
      WHERE a.id = ? AND a.deleted_at IS NULL
        AND (a.owner_user_id = ? OR a.viewer_user_id = ?)
    `
      )
      .bind(accountId, userId, userId)
  );
}

export async function onRequest(ctx) {
  const opt = handleOptions(ctx.request);
  if (opt) return opt;

  const reqId = crypto.randomUUID();
  try {
    const user = await getAuthUser(ctx);
    if (!user) return withCors(ctx.request, unauthorized("No logueado"));
    const uid = Number(user.id);

    const url = new URL(ctx.request.url);

    if (ctx.request.method === "GET") {
      const account_id = Number(url.searchParams.get("account_id"));
      if (!Number.isInteger(account_id) || account_id <= 0) return withCors(ctx.request, badRequest("account_id requerido"));

      const limit = Math.min(Number(url.searchParams.get("limit") || 50), 200);
      const offset = Math.max(Number(url.searchParams.get("offset") || 0), 0);

      const acc = await getAccountIfVisible(ctx, uid, account_id);
      if (!acc) return withCors(ctx.request, notFound("Cuenta no visible o no existe"));

      const my_role = Number(acc.owner_user_id) === uid ? "OWNER" : "VIEWER";

      const summary = await one(
        db(ctx)
          .prepare(
            `
          SELECT
            COALESCE(SUM(CASE WHEN movement='ABONO' THEN amount END), 0) AS total_abonos,
            COALESCE(SUM(CASE WHEN movement='CARGO' THEN amount END), 0) AS total_cargos
          FROM transactions
          WHERE account_id = ? AND deleted_at IS NULL
        `
          )
          .bind(account_id)
      );

      const saldo = Number(acc.initial_amount) + Number(summary.total_cargos || 0) - Number(summary.total_abonos || 0);

      const txs = await all(
        db(ctx)
          .prepare(
            `
          SELECT
            id, account_id, created_by_user_id, movement, date, amount, currency, pay_to, note,
            receipt_status, receipt_confirmed_by_user_id, receipt_confirmed_at,
            created_at
          FROM transactions
          WHERE account_id = ? AND deleted_at IS NULL
          ORDER BY date DESC, id DESC
          LIMIT ? OFFSET ?
        `
          )
          .bind(account_id, limit, offset)
      );

      return withCors(
        ctx.request,
        ok({
          account: {
            id: acc.id,
            title: acc.title,
            kind: acc.kind,
            currency: acc.currency,
            initial_amount: acc.initial_amount,
            owner_user_id: acc.owner_user_id,
            viewer_user_id: acc.viewer_user_id,
            my_role,
            can_write: my_role === "OWNER"
          },
          summary: {
            total_abonos: Number(summary.total_abonos || 0),
            total_cargos: Number(summary.total_cargos || 0),
            saldo
          },
          transactions: txs
        })
      );
    }

    if (ctx.request.method === "POST") {
      const body = await readJson(ctx.request);
      if (!body) return withCors(ctx.request, badRequest("JSON inválido"));

      const account_id = reqNumber(body.account_id, "account_id", { min: 1 });
      const movement = oneOf(body.movement, "movement", ["ABONO", "CARGO"]);
      const date = reqDateYYYYMMDD(body.date, "date");
      const amount = reqNumber(body.amount, "amount", { min: 0.0000001 });
      const pay_to = optString(body.pay_to, "pay_to", { max: 80 });
      const note = optString(body.note, "note", { max: 300 });

      const acc = await getAccountIfVisible(ctx, uid, account_id);
      if (!acc) return withCors(ctx.request, notFound("Cuenta no existe o no visible"));

      if (Number(acc.owner_user_id) !== uid) return withCors(ctx.request, forbidden("Solo OWNER puede crear movimientos"));

      const currency = normalizeCurrency(body.currency || acc.currency);
      if (currency !== String(acc.currency).toUpperCase()) {
        return withCors(ctx.request, badRequest("currency debe coincidir con la currency de la cuenta"));
      }

      const receipt_status = movement === "ABONO" ? "PENDIENTE" : null;

      await db(ctx)
        .prepare(
          `
        INSERT INTO transactions (
          account_id, created_by_user_id, movement, date, amount, currency, pay_to, note, receipt_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .bind(account_id, uid, movement, date, amount, currency, pay_to, note, receipt_status)
        .run();

      return withCors(ctx.request, ok({ created: true }));
    }

    return withCors(ctx.request, badRequest("Método inválido"));
  } catch (e) {
    console.log("[transactions]", reqId, e?.message || e);
    if (e?.message === "UNAUTHORIZED") return withCors(ctx.request, unauthorized());
    if (e?.message === "FORBIDDEN") return withCors(ctx.request, forbidden());
    return withCors(ctx.request, serverError("Error en /transactions"));
  }
}
