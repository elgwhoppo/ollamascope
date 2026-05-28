const { modelStats } = require("@/lib/usage");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ models: modelStats() });
}
