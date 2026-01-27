export function json(ok, dataOrError, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(
    JSON.stringify(ok ? { ok: true, data: dataOrError } : { ok: false, error: dataOrError }),
    { ...init, headers }
  );
}

export function ok(data, init) {
  return json(true, data, init);
}

export function badRequest(message, init = {}) {
  return json(false, message, { ...init, status: 400 });
}

export function unauthorized(message = "No autorizado", init = {}) {
  return json(false, message, { ...init, status: 401 });
}

export function forbidden(message = "Prohibido", init = {}) {
  return json(false, message, { ...init, status: 403 });
}

export function notFound(message = "No encontrado", init = {}) {
  return json(false, message, { ...init, status: 404 });
}

export function serverError(message = "Error interno", init = {}) {
  return json(false, message, { ...init, status: 500 });
}

export function withCors(req, res) {
  const headers = new Headers(res.headers);
  const origin = req.headers.get("Origin");

  // Normalmente será same-origin en Pages, pero en dev/pruebas ayuda.
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Credentials", "true");
    headers.set("Vary", "Origin");
  }
  // Permite headers custom (útil para /api/setup y /api/debug)
  const acrh = req.headers.get("Access-Control-Request-Headers");
  headers.set(
    "Access-Control-Allow-Headers",
    acrh || "Content-Type, X-Setup-Key, X-Debug-Key"
  );
  headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");

  return new Response(res.body, { status: res.status, headers });
}

export function handleOptions(req) {
  if (req.method !== "OPTIONS") return null;
  return withCors(req, new Response(null, { status: 204 }));
}
