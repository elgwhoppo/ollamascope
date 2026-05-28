const { getLatestPricingSync, syncPricing } = require("@/lib/pricing");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pricingPayload() {
  const { db } = require("@/lib/db");
  const latest = getLatestPricingSync() || null;
  const prices = db
    .prepare(
      `SELECT external_model_id,
        input_cost_per_1m_tokens,
        output_cost_per_1m_tokens,
        fetched_at
       FROM price_snapshots
       WHERE id IN (
        SELECT MAX(id) FROM price_snapshots GROUP BY external_model_id
       )
       ORDER BY external_model_id ASC
       LIMIT 300`
    )
    .all();
  const snapshots = db
    .prepare(
      `SELECT id, fetched_at, provider, external_model_id,
        input_cost_per_1m_tokens,
        output_cost_per_1m_tokens
       FROM price_snapshots
       ORDER BY fetched_at DESC, id DESC
       LIMIT 200`
    )
    .all();

  return { latest, prices, snapshots };
}

export async function GET() {
  return Response.json(pricingPayload());
}

export async function POST() {
  const result = await syncPricing({ force: true });
  return Response.json({ result, ...pricingPayload() });
}
