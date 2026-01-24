// Uso:
//   npm run hash -- "miPassword"
// Devuelve el string password_hash compatible con el sistema.
//
// Ejemplo:
//   npm run hash -- "Admin123!"
//
// Importante: el resultado es el que debes guardar en users.password_hash.
import { webcrypto } from "node:crypto";

function toB64(u8) {
  return Buffer.from(u8).toString("base64");
}

async function hashPassword(password) {
  const salt = new Uint8Array(16);
  webcrypto.getRandomValues(salt);

  const iterations = 120000;
  const enc = new TextEncoder();

  const keyMaterial = await webcrypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const bits = await webcrypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    keyMaterial,
    256
  );

  const hash = new Uint8Array(bits);
  return `pbkdf2$${iterations}$${toB64(salt)}$${toB64(hash)}`;
}

const password = process.argv[2];
if (!password) {
  console.log('Uso: node tools/hash_password.mjs "TuPassword"');
  process.exit(1);
}

console.log(await hashPassword(password));
