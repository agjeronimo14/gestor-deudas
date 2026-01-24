export async function readJson(req) {
  const ct = req.headers.get("Content-Type") || "";
  if (!ct.includes("application/json")) return null;
  try {
    return await req.json();
  } catch {
    return null;
  }
}

export function reqString(v, name, { min = 1, max = 120 } = {}) {
  if (typeof v !== "string") throw new Error(`${name} debe ser string`);
  const s = v.trim();
  if (s.length < min) throw new Error(`${name} es requerido`);
  if (s.length > max) throw new Error(`${name} es demasiado largo`);
  return s;
}

export function optString(v, name, { max = 500 } = {}) {
  if (v == null || v === "") return null;
  if (typeof v !== "string") throw new Error(`${name} debe ser string`);
  const s = v.trim();
  if (s.length > max) throw new Error(`${name} es demasiado largo`);
  return s || null;
}

export function reqNumber(v, name, { min = 0.0000001, max = 1e15 } = {}) {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`${name} debe ser número`);
  if (n < min) throw new Error(`${name} debe ser >= ${min}`);
  if (n > max) throw new Error(`${name} excede el máximo permitido`);
  return n;
}

export function optNumber(v, name, { min = 0, max = 1e15 } = {}) {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`${name} debe ser número`);
  if (n < min) throw new Error(`${name} debe ser >= ${min}`);
  if (n > max) throw new Error(`${name} excede el máximo permitido`);
  return n;
}

export function oneOf(v, name, allowed) {
  if (!allowed.includes(v)) throw new Error(`${name} inválido`);
  return v;
}

export function reqDateYYYYMMDD(v, name) {
  const s = reqString(v, name, { min: 10, max: 10 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error(`${name} debe ser YYYY-MM-DD`);
  return s;
}

export function normalizeCurrency(v) {
  const s = String(v || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{2,8}$/.test(s)) throw new Error("currency inválida");
  return s;
}
