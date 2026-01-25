// Genera un password_hash compatible con el sistema (Workers/WebCrypto)
// Formato: pbkdf2$120000$<salt_base64>$<hash_base64>
// Uso:
//   node tools/hash_password.mjs "Admin123!"

import { webcrypto } from "node:crypto";

const crypto = webcrypto;

function toB64(u8) {
  return Buffer.from(u8).toString("base64");
}

async function hashPassword(password) {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const iterations = 120000;
  const enc = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256
  );

  const hash = new Uint8Array(bits);
  return `pbkdf2$${iterations}$${toB64(salt)}$${toB64(hash)}`;
}

const password = process.argv[2];
if (!password) {
  console.error("Uso: node tools/hash_password.mjs <password>");
  process.exit(1);
}

hashPassword(password)
  .then((h) => {
    console.log(h);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
