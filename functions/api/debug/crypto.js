import { json, serverError } from "../_utils/response.js";

const enc = new TextEncoder();

function u8ToB64(u8) {
  let s = "";
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s);
}

export async function onRequestGet(ctx) {
  const out = {
    ok: true,
    hasCrypto: typeof crypto !== "undefined",
    hasGetRandomValues: typeof crypto?.getRandomValues === "function",
    hasSubtle: typeof crypto?.subtle?.importKey === "function",
    pbkdf2Test: null,
  };

  try {
    const salt = new Uint8Array([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16]);
    const it = 2; // pequeño para prueba
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode("test"),
      { name: "PBKDF2" },
      false,
      ["deriveBits"],
    );
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations: it, hash: { name: "SHA-256" } },
      key,
      256,
    );
    out.pbkdf2Test = {
      ok: true,
      sample: u8ToB64(new Uint8Array(bits)).slice(0, 16),
    };
    return json(out);
  } catch (e) {
    out.pbkdf2Test = { ok: false, error: String(e?.message || e) };
    return json(out, { status: 200 });
  }
}
