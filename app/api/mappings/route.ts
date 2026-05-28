const { db } = require("@/lib/db");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const mappings = db
    .prepare("SELECT * FROM model_mappings ORDER BY local_model ASC")
    .all();
  return Response.json({ mappings });
}

export async function POST(request: Request) {
  const body = await request.json();
  const localModel = String(body.local_model || "").trim();
  const externalModelId = String(body.external_model_id || "").trim();

  if (!localModel || !externalModelId) {
    return Response.json({ error: "local_model and external_model_id are required" }, { status: 400 });
  }

  db.prepare(
    `INSERT INTO model_mappings (local_model, external_model_id)
     VALUES (?, ?)
     ON CONFLICT(local_model) DO UPDATE SET external_model_id = excluded.external_model_id`
  ).run(localModel, externalModelId);

  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const id = Number(url.searchParams.get("id"));
  if (!id) return Response.json({ error: "id is required" }, { status: 400 });
  db.prepare("DELETE FROM model_mappings WHERE id = ?").run(id);
  return Response.json({ ok: true });
}
