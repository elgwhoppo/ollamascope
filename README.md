# OllamaScope

OllamaScope is a small self-hosted proxy and dashboard for Ollama usage.

It listens on:

- Dashboard: `http://localhost:3000`
- Ollama proxy: `http://localhost:11435`

Point clients at `http://localhost:11435` instead of `http://localhost:11434`.

## What It Tracks

- Requests to `/api/chat`, `/api/generate`, `/v1/chat/completions`, and `/v1/completions`
- Prompt, completion, and total tokens when Ollama returns token counts
- Duration and tokens per second
- Streaming and non-streaming requests
- Estimated cloud-equivalent cost from OpenRouter pricing snapshots

## Start

For an existing Ollama server, set `OLLAMA_BASE_URL` in `.env`:

```env
OLLAMA_BASE_URL=http://10.0.0.10:11434
```

Then start OllamaScope:

```bash
docker compose up -d
```

Open the dashboard:

```text
http://localhost:3000
```

Use the proxy:

```bash
curl http://localhost:11435/api/generate \
  -H "content-type: application/json" \
  -d '{"model":"llama3.2:latest","prompt":"hello","stream":false}'
```

## Pricing

OllamaScope fetches OpenRouter model pricing from:

```text
https://openrouter.ai/api/v1/models
```

Pricing is synced once per day on startup or by clicking **Sync** on the Pricing page.

Snapshots are immutable:

- old price rows are never overwritten
- old usage rows are never recalculated
- each usage row stores the exact estimated cost and pricing snapshot id used at request time

## Model Mappings

Local Ollama model names are mapped to OpenRouter model ids in the Pricing page.

Default examples:

```text
qwen3-coder-next:q8_0 -> openrouter/qwen/qwen3-coder
llama3.2:latest -> meta-llama/llama-3.2
```

If a model has no mapping or no imported price, the request is still tracked and estimated cost is recorded as `0`.

## SQLite

SQLite is stored in the `ollamascope-data` Docker volume by default.

Tables:

- `usage_events`
- `price_snapshots`
- `model_mappings`

## Configuration

Copy `.env.example` if you want local environment overrides.

```env
APP_PORT=3000
PROXY_PORT=11435
APP_HOST=0.0.0.0
OLLAMA_BASE_URL=http://host.docker.internal:11434
DATA_DIR=/data
DATABASE_PATH=/data/ollamascope.sqlite
```

For an existing Ollama instance on the host, use:

```env
OLLAMA_BASE_URL=http://host.docker.internal:11434
```

For an existing Ollama instance on another machine, use:

```env
OLLAMA_BASE_URL=http://10.0.0.10:11434
```
