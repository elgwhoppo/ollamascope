const { estimateCost } = require("./pricing");

function getDb() {
  return require("./db").db;
}

function numberOrZero(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function extractUsage(endpoint, body, finalPayload, durationMs) {
  const model = body?.model || finalPayload?.model || "unknown";
  const promptTokens = numberOrZero(
    finalPayload?.prompt_eval_count ??
      finalPayload?.usage?.prompt_tokens ??
      finalPayload?.prompt_tokens
  );
  const completionTokens = numberOrZero(
    finalPayload?.eval_count ??
      finalPayload?.usage?.completion_tokens ??
      finalPayload?.completion_tokens
  );
  const totalTokens = numberOrZero(finalPayload?.usage?.total_tokens) || promptTokens + completionTokens;
  const totalDurationNs = numberOrZero(finalPayload?.total_duration);
  const measuredMs = totalDurationNs > 0 ? Math.round(totalDurationNs / 1_000_000) : durationMs;
  const tokensPerSecond = measuredMs > 0 ? completionTokens / (measuredMs / 1000) : 0;

  return {
    model,
    endpoint,
    promptTokens,
    completionTokens,
    totalTokens,
    durationMs: measuredMs,
    tokensPerSecond
  };
}

function recordUsage({ endpoint, body, finalPayload, durationMs, streamed }) {
  const db = getDb();
  const usage = extractUsage(endpoint, body, finalPayload, durationMs);
  const { estimatedCost, priceSnapshotId } = estimateCost(
    usage.model,
    usage.promptTokens,
    usage.completionTokens
  );

  db.prepare(`
    INSERT INTO usage_events (
      created_at,
      model,
      endpoint,
      prompt_tokens,
      completion_tokens,
      total_tokens,
      duration_ms,
      tokens_per_second,
      streamed,
      estimated_cost,
      price_snapshot_id
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    new Date().toISOString(),
    usage.model,
    usage.endpoint,
    usage.promptTokens,
    usage.completionTokens,
    usage.totalTokens,
    usage.durationMs,
    usage.tokensPerSecond,
    streamed ? 1 : 0,
    estimatedCost,
    priceSnapshotId
  );
}

function dashboardStats() {
  const db = getDb();
  const totals = db
    .prepare(
      `SELECT
        COUNT(*) AS total_requests,
        COALESCE(SUM(total_tokens), 0) AS total_tokens,
        COALESCE(SUM(estimated_cost), 0) AS total_estimated_savings,
        COALESCE(SUM(CASE WHEN date(created_at) = date('now') THEN 1 ELSE 0 END), 0) AS requests_today
       FROM usage_events`
    )
    .get();

  const mostUsedModels = db
    .prepare(
      `SELECT model, COUNT(*) AS requests, SUM(total_tokens) AS tokens, SUM(estimated_cost) AS cost
       FROM usage_events
       GROUP BY model
       ORDER BY requests DESC
       LIMIT 8`
    )
    .all();

  const daily = db
    .prepare(
      `SELECT date(created_at) AS date,
        COUNT(*) AS requests,
        SUM(total_tokens) AS tokens,
        SUM(estimated_cost) AS cost
       FROM usage_events
       GROUP BY date(created_at)
       ORDER BY date ASC
       LIMIT 30`
    )
    .all();

  return { totals, mostUsedModels, daily };
}

function modelStats() {
  const db = getDb();
  return db
    .prepare(
      `SELECT model,
        COUNT(*) AS requests,
        SUM(prompt_tokens) AS prompt_tokens,
        SUM(completion_tokens) AS completion_tokens,
        SUM(total_tokens) AS total_tokens,
        SUM(estimated_cost) AS estimated_cost,
        AVG(tokens_per_second) AS avg_tokens_per_second
       FROM usage_events
       GROUP BY model
       ORDER BY total_tokens DESC`
    )
    .all();
}

function requestLog(search = "") {
  const db = getDb();
  const term = `%${search}%`;
  return db
    .prepare(
      `SELECT *
       FROM usage_events
       WHERE model LIKE ? OR endpoint LIKE ?
       ORDER BY created_at DESC
       LIMIT 200`
    )
    .all(term, term);
}

module.exports = { recordUsage, dashboardStats, modelStats, requestLog };
