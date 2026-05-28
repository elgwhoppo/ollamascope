const { requestLog } = require("@/lib/usage");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  return Response.json({ requests: requestLog(url.searchParams.get("q") || "") });
}
