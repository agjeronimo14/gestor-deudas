import { ok, badRequest, unauthorized, forbidden, notFound, serverError, withCors, handleOptions } from "../../_utils/response.js";
import { db, one } from "../../_utils/db.js";
import { getAuthUser } from "../../_utils/auth.js";

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

    if (ctx.request.method !== "POST") return withCors(ctx.request, badRequest("Método inválido"));

    const txId = getId(ctx);

    const tx = await one(
      db(ctx)
        .prepare(
          `
        SELECT
          t.id, t.account_id, t.movement, t.receipt_status,
          a.viewer_user_id
        FROM transactions t
        JOIN accounts a ON a.id = t.account_id
        WHERE t.id = ? AND t.deleted_at IS NULL AND a.deleted_at IS NULL
      `
        )
        .bind(txId)
    );

    if (!tx) return withCors(ctx.request, notFound("Movimiento no existe"));

    if (!tx.viewer_user_id) return withCors(ctx.request, forbidden("Esta cuenta no tiene VIEWER asignado"));
    if (Number(tx.viewer_user_id) !== Number(user.id)) return withCors(ctx.request, forbidden("No eres el VIEWER de esta cuenta"));

    if (tx.movement !== "ABONO") return withCors(ctx.request, badRequest("Solo ABONO puede confirmarse"));
    if (tx.receipt_status !== "PENDIENTE") return withCors(ctx.request, badRequest("Este abono no está PENDIENTE"));

    await db(ctx)
      .prepare(
        `
      UPDATE transactions
      SET
        receipt_status = 'RECIBIDO',
        receipt_confirmed_by_user_id = ?,
        receipt_confirmed_at = datetime('now')
      WHERE id = ?
    `
      )
      .bind(user.id, txId)
      .run();

    return withCors(ctx.request, ok({ confirmed: true }));
  } catch (e) {
    console.log("[confirm-receipt]", reqId, e?.message || e);
    if (e?.message === "ID_INVALID") return withCors(ctx.request, badRequest("id inválido"));
    return withCors(ctx.request, serverError("Error confirmando recibido"));
  }
}
