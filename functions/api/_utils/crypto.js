const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const REV = (() => {
  const a = new Int16Array(256);
  a.fill(-1);
  for (let i = 0; i < B64.length; i++) a[B64.charCodeAt(i)] = i;
  a["-".charCodeAt(0)] = 62; // base64url
  a["_".charCodeAt(0)] = 63; // base64url
  return a;
})();

function toB64(bytes) {
  let out = "";
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
  }
  const rem = bytes.length - i;
  if (rem === 1) {
    const n = bytes[i] << 16;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + "==";
  } else if (rem === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + "=";
  }
  return out;
}

function fromB64(b64) {
  // tolerate base64url, whitespace, missing padding
  let s = String(b64 || "").trim();
  if (!s) return new Uint8Array();
  s = s.replace(/\s+/g, "");
  const pad = s.length % 4;
  if (pad) s += "=".repeat(4 - pad);

  const out = [];
  let i = 0;
  while (i < s.length) {
    const c1 = REV[s.charCodeAt(i++)];
    const c2 = REV[s.charCodeAt(i++)];
    const c3ch = s.charCodeAt(i++);
    const c4ch = s.charCodeAt(i++);

    if (c1 < 0 || c2 < 0) throw new Error("base64: inválido");

    const c3 = c3ch === 61 ? -2 : REV[c3ch]; // '='
    const c4 = c4ch === 61 ? -2 : REV[c4ch];

    if (c3 < -1 || c4 < -1) throw new Error("base64: inválido");

    const n = (c1 << 18) | (c2 << 12) | ((c3 > -2 ? c3 : 0) << 6) | (c4 > -2 ? c4 : 0);
    out.push((n >> 16) & 255);
    if (c3 !== -2) out.push((n >> 8) & 255);
    if (c4 !== -2) out.push(n & 255);
  }

  return new Uint8Array(out);
}

function toB64Url(bytes) {
  return toB64(bytes).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function randomToken(bytes = 32) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return toB64Url(arr);
}

export async function hashPassword(password) {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);

  const iterations = 120000;
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    keyMaterial,
    256
  );

  const hash = new Uint8Array(bits);
  return `pbkdf2$${iterations}$${toB64(salt)}$${toB64(hash)}`;
}

export async function verifyPassword(password, stored) {
  try {
    const safe = String(stored || "").trim();
    const [algo, iterStr, saltB64, hashB64] = safe.split("$");
    if (algo !== "pbkdf2") return false;

    const iterations = Number(iterStr);
    if (!Number.isFinite(iterations) || iterations < 10000) return false;

    const salt = fromB64(saltB64);
    const expected = fromB64(hashB64);

    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveBits"]
    );

    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt, iterations },
      keyMaterial,
      256
    );

    const got = new Uint8Array(bits);
    if (got.length !== expected.length) return false;

    let diff = 0;
    for (let i = 0; i < got.length; i++) diff |= got[i] ^ expected[i];
    return diff === 0;
  } catch {
    return false;
  }
}
