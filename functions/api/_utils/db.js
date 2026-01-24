export function db(ctx) {
  if (!ctx.env?.DB) throw new Error("DB binding no está configurado (env.DB)");
  return ctx.env.DB;
}

export async function one(stmt) {
  const row = await stmt.first();
  return row || null;
}

export async function all(stmt) {
  const { results } = await stmt.all();
  return results || [];
}
