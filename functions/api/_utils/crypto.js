// Crypto utils (PBKDF2 password hashing + base64url tokens)
//
// Cloudflare Pages/Workers supports atob/btoa.
// We use them for base64 to avoid padding/decoder bugs that can break auth.

const enc = new TextEncoder();

function toB64(u8) {
  // Standard base64 (with padding)
  let s = "";
  for (const b of u8) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(b64) {
  // Accept base64url too and normalize padding
  const norm = (b64 || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = norm.padEnd(Math.ceil(norm.length / 4) * 4, "=");
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function toB64Url(u8) {
  return toB64(u8).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const it = 120000;
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: it },
    key,
    256,
  );
  const hash = new Uint8Array(bits);
  return `pbkdf2$${it}$${toB64(salt)}$${toB64(hash)}`;
}

export async function verifyPassword(password, hash) {
  try {
    const raw = String(hash || "").trim();

    // Formatos soportados:
    // 1) pbkdf2$<it>$<saltB64>$<hashB64>
    // 2) v1:pbkdf2_sha256:<it>:<saltB64>:<hashB64>
    let kind, itStr, saltB64, hashB64;
    if (raw.startsWith("pbkdf2$")) {
      [kind, itStr, saltB64, hashB64] = raw.split("$");
    } else if (raw.startsWith("v1:")) {
      const p = raw.split(":");
      const algo = String(p[1] || "").toLowerCase();
      if (!algo.includes("pbkdf2")) return false;
      kind = "pbkdf2";
      itStr = p[2];
      saltB64 = p[3];
      hashB64 = p[4];
    } else {
      return false;
    }

    if (kind !== "pbkdf2" || !saltB64 || !hashB64) return false;
    const it = Number(itStr || "120000");
    if (!Number.isFinite(it) || it < 10000) return false;

    const salt = fromB64(saltB64);
    const expectedHash = fromB64(hashB64);

    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveBits"],
    );
    // Derive the same number of bits as the stored hash length (supports legacy variations).
    const bitsLen = expectedHash.length * 8;
    if (!Number.isFinite(bitsLen) || bitsLen <= 0) return false;

    // Cloudflare supports PBKDF2 with SHA-256; in case an older deploy used a different hash,
    // try a few common hashes for compatibility.
    const hashesToTry = ["SHA-256", "SHA-512", "SHA-1"];
    for (const h of hashesToTry) {
      const bits = await crypto.subtle.deriveBits(
        { name: "PBKDF2", hash: h, salt, iterations: it },
        key,
        bitsLen,
      );
      const gotHash = new Uint8Array(bits);
      if (expectedHash.length !== gotHash.length) continue;

      // Constant-ish time compare
      let diff = 0;
      for (let i = 0; i < expectedHash.length; i++) diff |= expectedHash[i] ^ gotHash[i];
      if (diff === 0) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function randomToken(bytes = 24) {
  const u8 = crypto.getRandomValues(new Uint8Array(bytes));
  return toB64Url(u8);
}
