const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
const dbPath = process.env.DATABASE_PATH || path.join(dataDir, "ollamascope.sqlite");

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");
db.exec("PRAGMA busy_timeout = 5000");

db.exec(`
CREATE TABLE IF NOT EXISTS usage_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  model TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  tokens_per_second REAL NOT NULL DEFAULT 0,
  streamed INTEGER NOT NULL DEFAULT 0,
  estimated_cost REAL NOT NULL DEFAULT 0,
  price_snapshot_id INTEGER,
  FOREIGN KEY (price_snapshot_id) REFERENCES price_snapshots(id)
);

CREATE TABLE IF NOT EXISTS price_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
  provider TEXT NOT NULL,
  external_model_id TEXT NOT NULL,
  input_cost_per_1m_tokens REAL NOT NULL DEFAULT 0,
  output_cost_per_1m_tokens REAL NOT NULL DEFAULT 0,
  raw_payload TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS model_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  local_model TEXT NOT NULL UNIQUE,
  external_model_id TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_usage_created_at ON usage_events(created_at);
CREATE INDEX IF NOT EXISTS idx_usage_model ON usage_events(model);
CREATE INDEX IF NOT EXISTS idx_prices_model_time ON price_snapshots(external_model_id, fetched_at);
`);

const defaultMappings = [
  ["qwen3-coder-next:q8_0", "openrouter/qwen/qwen3-coder"],
  ["llama3.2:latest", "meta-llama/llama-3.2"]
];

const insertMapping = db.prepare(`
  INSERT OR IGNORE INTO model_mappings (local_model, external_model_id)
  VALUES (?, ?)
`);
for (const mapping of defaultMappings) insertMapping.run(...mapping);

module.exports = { db };
