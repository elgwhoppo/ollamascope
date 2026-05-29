const http = require("node:http");
const next = require("next");
const { recordUsage } = require("./lib/usage");
const { syncPricing } = require("./lib/pricing");

const dev = process.env.NODE_ENV !== "production";
const appPort = Number(process.env.APP_PORT || 3000);
const proxyPort = Number(process.env.PROXY_PORT || 11435);
const appHost = process.env.APP_HOST || "0.0.0.0";
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || "http://ollama:11434";
const trackedEndpoints = new Set([
  "/api/chat",
  "/api/generate",
  "/v1/chat/completions",
  "/v1/completions"
]);

const app = next({ dev, hostname: "0.0.0.0", port: appPort });
const handle = app.getRequestHandler();

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function parseJson(buffer) {
  if (!buffer?.length) return {};
  try {
    return JSON.parse(buffer.toString("utf8"));
  } catch {
    return {};
  }
}

function extractPayloads(text) {
  const payloads = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const jsonText = trimmed.startsWith("data:") ? trimmed.slice(5).trim() : trimmed;
    if (!jsonText || jsonText === "[DONE]") continue;

    try {
      payloads.push(JSON.parse(jsonText));
    } catch {
      // Partial stream chunks are expected. Usage is best-effort until a full line arrives.
    }
  }
  return payloads;
}

function finalPayloadFromStream(text) {
  const payloads = extractPayloads(text);
  if (payloads.length === 0) return {};

  const withUsage = [...payloads].reverse().find((payload) => payload.usage);
  if (withUsage) return withUsage;

  const donePayload = [...payloads].reverse().find((payload) => payload.done);
  return donePayload || payloads[payloads.length - 1] || {};
}

async function proxyRequest(req, res) {
  const startedAt = Date.now();
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const trackUsage = trackedEndpoints.has(url.pathname);

  const bodyBuffer = await readRequestBody(req);
  const requestBody = parseJson(bodyBuffer);
  const target = new URL(`${url.pathname}${url.search}`, ollamaBaseUrl);
  const headers = { ...req.headers };
  delete headers.host;
  headers["content-length"] = String(bodyBuffer.length);

  const upstream = await fetch(target, {
    method: req.method,
    headers,
    body: bodyBuffer.length ? bodyBuffer : undefined,
    duplex: "half"
  });

  const responseHeaders = {};
  upstream.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });
  res.writeHead(upstream.status, responseHeaders);

  const contentType = upstream.headers.get("content-type") || "";
  const chunks = [];
  let finalPayload = {};

  if (upstream.body) {
    const reader = upstream.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = Buffer.from(value);
      if (trackUsage) {
        chunks.push(chunk);
      }
      res.write(chunk);
    }
  }

  res.end();

  if (!trackUsage) {
    return;
  }

  const responseText = Buffer.concat(chunks).toString("utf8");
  if (contentType.includes("application/json") && !responseText.includes("\n")) {
    finalPayload = parseJson(Buffer.from(responseText));
  } else {
    finalPayload = finalPayloadFromStream(responseText);
  }

  const streamed =
    requestBody?.stream === true ||
    contentType.includes("text/event-stream") ||
    responseText.split(/\r?\n/).filter(Boolean).length > 1;

  try {
    recordUsage({
      endpoint: url.pathname,
      body: requestBody,
      finalPayload,
      durationMs: Date.now() - startedAt,
      streamed
    });
  } catch (error) {
    console.error("Failed to record usage:", error);
  }
}

async function start() {
  await app.prepare();

  const dashboardServer = http.createServer((req, res) => handle(req, res));
  dashboardServer.on("error", (error) => {
    console.error("Dashboard server error:", error);
    process.exit(1);
  });
  dashboardServer.listen(appPort, appHost, () => {
    console.log(`OllamaScope dashboard listening on http://${appHost}:${appPort}`);
  });

  const proxyServer = http.createServer((req, res) => {
    proxyRequest(req, res).catch((error) => {
      console.error("Proxy error:", error);
      if (!res.headersSent) {
        res.writeHead(502, { "content-type": "application/json" });
      }
      res.end(JSON.stringify({ error: "Ollama proxy request failed" }));
    });
  });
  proxyServer.on("error", (error) => {
    console.error("Proxy server error:", error);
    process.exit(1);
  });
  proxyServer.listen(proxyPort, appHost, () => {
    console.log(`OllamaScope proxy listening on http://${appHost}:${proxyPort}`);
  });

  syncPricing().catch((error) => console.error(error.message));
  setInterval(() => syncPricing().catch((error) => console.error(error.message)), 60 * 60 * 1000);
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
