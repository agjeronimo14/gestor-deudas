import { ok, badRequest, unauthorized, serverError, withCors, handleOptions } from "../_utils/response.js";
import { db, one } from "../_utils/db.js";
import { readJson, reqString } from "../_utils/validate.js";
import { verifyPassword } from "../_utils/crypto.js";
import { createSession, setSessionCookie } from "../_utils/auth.js";

export async function onRequest(ctx) {
  const opt = handleOptions(ctx.request);
  if (opt) return opt;

  const reqId = crypto.randomUUID();
  try {
    const setupKey = String(ctx.env.SETUP_KEY ?? "").trim();
    const debugKey = String(ctx.request.headers.get("X-Setup-Key") ?? "").trim();
    const allowDebug = setupKey && debugKey && debugKey === setupKey;

    const debugUnauthorized = (debug) => {
      const headers = new Headers({ "Content-Type": "application/json; charset=utf-8" });
      return new Response(JSON.stringify({ ok: false, error: "Credenciales inválidas", debug }), {
        status: 401,
        headers,
      });
    };

    if (ctx.request.method !== "POST") return withCors(ctx.request, badRequest("Método inválido"));

    const body = await readJson(ctx.request);
    if (!body) return withCors(ctx.request, badRequest("JSON inválido"));

    const username = reqString(body.username, "username", { min: 3, max: 40 }).toLowerCase();
    const password = reqString(body.password, "password", { min: 6, max: 200 });

    const user = await one(
      db(ctx)
        .prepare(
          "SELECT id, username, password_hash, role, is_active FROM users WHERE username = ? COLLATE NOCASE"
        )
        .bind(username)
    );

    // Nota: D1/SQLite en algunos entornos puede devolver INTEGER como string.
    // Normalizamos con Number() para evitar falsos 401.
    if (!user) {
      return withCors(
        ctx.request,
        allowDebug ? debugUnauthorized({ reason: "user_not_found", username }) : unauthorized("Credenciales inválidas")
      );
    }

    if (Number(user.is_active) !== 1) {
      return withCors(
        ctx.request,
        allowDebug
          ? debugUnauthorized({ reason: "user_inactive", username, is_active: user.is_active, role: user.role })
          : unauthorized("Credenciales inválidas")
      );
    }

    const passOk = await verifyPassword(password, user.password_hash);
    if (!passOk) {
      const ph = String(user.password_hash || "");
      const prefix = ph.slice(0, 32);
      return withCors(
        ctx.request,
        allowDebug
          ? debugUnauthorized({ reason: "password_mismatch", username, hash_prefix: prefix, hash_len: ph.length })
          : unauthorized("Credenciales inválidas")
      );
    }

    const userId = Number(user.id);
    const { sessionId, ttlSeconds } = await createSession(ctx, userId);

    const headers = new Headers();
    headers.append("Set-Cookie", setSessionCookie(ctx.request, sessionId, ttlSeconds));

    return withCors(
      ctx.request,
      ok({ user: { id: userId, username: user.username, role: user.role } }, { headers })
    );
  } catch (e) {
    console.log("[auth/login]", reqId, e?.message || e);
    return withCors(ctx.request, serverError("Error en /auth/login"));
  }
}
