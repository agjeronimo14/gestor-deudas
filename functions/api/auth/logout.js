import { ok, serverError, withCors, handleOptions } from "../_utils/response.js";
import { getAuthUser, destroySession, clearSessionCookie } from "../_utils/auth.js";

export async function onRequest(ctx) {
  const opt = handleOptions(ctx.request);
  if (opt) return opt;

  const reqId = crypto.randomUUID();
  try {
    if (ctx.request.method !== "POST") return withCors(ctx.request, ok({}));

    const user = await getAuthUser(ctx);
    if (user?.sessionId) await destroySession(ctx, user.sessionId);

    const headers = new Headers();
    headers.append("Set-Cookie", clearSessionCookie(ctx.request));
    return withCors(ctx.request, ok({}), { headers });
  } catch (e) {
    console.log("[auth/logout]", reqId, e?.message || e);
    return withCors(ctx.request, serverError("Error en /auth/logout"));
  }
}
