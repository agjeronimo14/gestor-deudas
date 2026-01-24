import { ok, unauthorized, serverError, withCors, handleOptions } from "../_utils/response.js";
import { getAuthUser } from "../_utils/auth.js";

export async function onRequest(ctx) {
  const opt = handleOptions(ctx.request);
  if (opt) return opt;

  const reqId = crypto.randomUUID();
  try {
    const user = await getAuthUser(ctx);
    if (!user) return withCors(ctx.request, unauthorized("No logueado"));

    return withCors(ctx.request, ok({ user: { id: user.id, username: user.username, role: user.role } }));
  } catch (e) {
    console.log("[auth/me]", reqId, e?.message || e);
    return withCors(ctx.request, serverError("Error en /auth/me"));
  }
}
