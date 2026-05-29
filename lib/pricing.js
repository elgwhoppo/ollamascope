const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
const PRICE_PROVIDER = "openrouter";
const DAY_MS = 24 * 60 * 60 * 1000;

function getDb() {
  return require("./db").db;
}

function dollarsPerMillion(value) {
  const n = Number(value || 0);
  return n * 1_000_000;
}

function getLatestPricingSync() {
  const db = getDb();
  return db
    .prepare(
      `SELECT fetched_at, COUNT(*) AS rows
       FROM price_snapshots
       WHERE provider = ?
       GROUP BY fetched_at
       ORDER BY fetched_at DESC
       LIMIT 1`
    )
    .get(PRICE_PROVIDER);
}

function shouldSyncPricing() {
  const latest = getLatestPricingSync();
  if (!latest?.fetched_at) return true;
  return Date.now() - new Date(`${latest.fetched_at}Z`).getTime() > DAY_MS;
}

async function syncPricing({ force = false } = {}) {
  if (!force && !shouldSyncPricing()) {
    return { skipped: true, latest: getLatestPricingSync() || null };
  }

  const response = await fetch(OPENROUTER_MODELS_URL);
  if (!response.ok) {
    throw new Error(`OpenRouter pricing fetch failed: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  const models = Array.isArray(payload?.data) ? payload.data : [];
  const fetchedAt = new Date().toISOString();
  const db = getDb();

  const insert = db.prepare(`
    INSERT INTO price_snapshots (
      fetched_at,
      provider,
      external_model_id,
      input_cost_per_1m_tokens,
      output_cost_per_1m_tokens,
      raw_payload
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  db.exec("BEGIN");
  try {
    for (const model of models) {
      const pricing = model.pricing || {};
      insert.run(
        fetchedAt,
        PRICE_PROVIDER,
        model.id,
        dollarsPerMillion(pricing.prompt),
        dollarsPerMillion(pricing.completion),
        JSON.stringify(model)
      );
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return { skipped: false, fetched_at: fetchedAt, rows: models.length };
}

function latestPriceForLocalModel(localModel) {
  const db = getDb();
  const mapping = db
    .prepare("SELECT external_model_id FROM model_mappings WHERE local_model = ?")
    .get(localModel);
  if (!mapping) return null;

  return db
    .prepare(
      `SELECT *
       FROM price_snapshots
       WHERE provider = ? AND external_model_id = ?
       ORDER BY fetched_at DESC, id DESC
       LIMIT 1`
    )
    .get(PRICE_PROVIDER, mapping.external_model_id);
}

function listPricedModels() {
  const db = getDb();
  return db
    .prepare(
      `SELECT external_model_id,
        input_cost_per_1m_tokens,
        output_cost_per_1m_tokens,
        fetched_at
       FROM price_snapshots
       WHERE id IN (
        SELECT MAX(id) FROM price_snapshots GROUP BY external_model_id
       )
       ORDER BY external_model_id ASC`
    )
    .all()
    .filter(
      (row) => row.input_cost_per_1m_tokens > 0 && row.output_cost_per_1m_tokens > 0
    );
}

function estimateCost(localModel, promptTokens, completionTokens) {
  const price = latestPriceForLocalModel(localModel);
  if (!price) {
    return { estimatedCost: 0, priceSnapshotId: null };
  }

  const inputCost = (promptTokens / 1_000_000) * price.input_cost_per_1m_tokens;
  const outputCost = (completionTokens / 1_000_000) * price.output_cost_per_1m_tokens;
  return {
    estimatedCost: inputCost + outputCost,
    priceSnapshotId: price.id
  };
}

module.exports = {
  PRICE_PROVIDER,
  getLatestPricingSync,
  syncPricing,
  shouldSyncPricing,
  listPricedModels,
  estimateCost
};
