const { dashboardStats } = require("@/lib/usage");
const { listPricedModels } = require("@/lib/pricing");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    ...dashboardStats(),
    pricedModels: listPricedModels()
  });
}
