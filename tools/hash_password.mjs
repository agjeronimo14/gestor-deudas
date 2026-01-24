// Uso:
//   npm run hash -- "miPassword"
// Devuelve el string password_hash compatible con el sistema.
//
// Ejemplo:
//   npm run hash -- "Admin123!"
//
// Importante: el resultado es el que debes guardar en users.password_hash.

import { webcrypto } from 'node:crypto';

globalThis.crypto = webcrypto;

function toB64Url(bytes) {
  return Buffer.from(bytes)
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

async function hashPassword(password) {
  const iterations = 210000;
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    keyMaterial,
    256
  );

  const hash = new Uint8Array(bits);
  return `v1:pbkdf2_sha256:${iterations}:${toB64Url(salt)}:${toB64Url(hash)}`;
}

async function main() {
  const pass = process.argv.slice(2).join(' ');
  if (!pass) {
    console.error('Uso: npm run hash -- "miPassword"');
    process.exit(1);
  }
  const out = await hashPassword(pass);
  console.log(out);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
