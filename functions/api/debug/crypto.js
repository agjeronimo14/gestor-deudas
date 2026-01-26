import { ok, serverError } from "../_utils/response";
import { hashPassword, verifyPassword } from "../_utils/crypto";

export async function onRequestGet(ctx) {
  try {
    const pw = "test123!";
    const hash = await hashPassword(pw, 2000);
    const verify = await verifyPassword(pw, hash);
    return ok({
      runtime: "pages-functions",
      hasSubtle: !!globalThis.crypto?.subtle,
      verify,
      samplePrefix: hash.slice(0, 24) + "..."
    });
  } catch (err) {
    console.error("debug/crypto error", err);
    return serverError("debug/crypto falló");
  }
}
