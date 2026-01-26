// Password hashing + verification (PBKDF2-SHA256) for Cloudflare Pages Functions.
// Format: pbkdf2$<iterations>$<salt_b64>$<hash_b64>

function toB64(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function fromB64Any(b64) {
  // Tolerate base64url and whitespace.
  const s = (b64 ?? "").toString().trim();
  try {
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    // Try base64url variant
    const norm = s.replace(/-/g, "+").replace(/_/g, "/");
    const padded = norm + "===".slice((norm.length + 3) % 4);
    const bin = atob(padded);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
}

function timingSafeEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function parseStoredHash(stored) {
  const s = (stored ?? "").toString().trim();
  const parts = s.split("$");
  if (parts.length !== 4) return null;
  const [scheme, it, salt_b64, hash_b64] = parts;
  if (scheme !== "pbkdf2") return null;
  const iterations = Number(it);
  if (!Number.isFinite(iterations) || iterations < 10000) return null;
  return { iterations, salt: fromB64Any(salt_b64), hash: fromB64Any(hash_b64) };
}

export async function hashPassword(password, iterations = 120000) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key,
    256
  );
  const hash = new Uint8Array(bits);
  return `pbkdf2$${iterations}$${toB64(salt)}$${toB64(hash)}`;
}

export async function verifyPassword(password, stored) {
  const parsed = parseStoredHash(stored);
  if (!parsed) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: parsed.salt, iterations: parsed.iterations, hash: "SHA-256" },
    key,
    parsed.hash.length * 8
  );
  const derived = new Uint8Array(bits);
  return timingSafeEqual(derived, parsed.hash);
}
