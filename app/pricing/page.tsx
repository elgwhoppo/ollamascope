"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatCurrency, formatNumber } from "@/lib/utils";

type Mapping = { id: number; local_model: string; external_model_id: string };
type Price = {
  external_model_id: string;
  input_cost_per_1m_tokens: number;
  output_cost_per_1m_tokens: number;
  fetched_at: string;
};

export default function PricingPage() {
  const [latest, setLatest] = useState<{ fetched_at: string; rows: number } | null>(null);
  const [prices, setPrices] = useState<Price[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [localModel, setLocalModel] = useState("");
  const [externalModelId, setExternalModelId] = useState("");

  async function load() {
    const [pricingResponse, mappingResponse] = await Promise.all([
      fetch("/api/pricing", { cache: "no-store" }),
      fetch("/api/mappings", { cache: "no-store" })
    ]);
    const pricing = await pricingResponse.json();
    const mappingJson = await mappingResponse.json();
    setLatest(pricing.latest);
    setPrices(pricing.prices || []);
    setMappings(mappingJson.mappings || []);
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, []);

  async function saveMapping() {
    await fetch("/api/mappings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ local_model: localModel, external_model_id: externalModelId })
    });
    setLocalModel("");
    setExternalModelId("");
    load();
  }

  async function deleteMapping(id: number) {
    await fetch(`/api/mappings?id=${id}`, { method: "DELETE" });
    load();
  }

  async function syncPricing() {
    await fetch("/api/pricing", { method: "POST" });
    load();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>OpenRouter Pricing Sync</CardTitle>
          <Button onClick={syncPricing} title="Sync pricing now">
            Sync
          </Button>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            Latest sync: {latest?.fetched_at ? new Date(latest.fetched_at).toLocaleString() : "never"} ·{" "}
            {formatNumber(latest?.rows || 0)} rows
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Model Mappings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <Input placeholder="Local Ollama model" value={localModel} onChange={(e) => setLocalModel(e.target.value)} />
            <Input
              placeholder="OpenRouter model id"
              value={externalModelId}
              onChange={(e) => setExternalModelId(e.target.value)}
            />
            <Button onClick={saveMapping} disabled={!localModel || !externalModelId} title="Save mapping">
              Save
            </Button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>Local Model</TH>
                  <TH>OpenRouter Model</TH>
                  <TH></TH>
                </TR>
              </THead>
              <TBody>
                {mappings.map((mapping) => (
                  <TR key={mapping.id}>
                    <TD className="font-medium">{mapping.local_model}</TD>
                    <TD>{mapping.external_model_id}</TD>
                    <TD className="text-right">
                      <Button className="bg-muted text-foreground" onClick={() => deleteMapping(mapping.id)} title="Delete mapping">
                        Delete
                      </Button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Imported Model Prices</CardTitle>
        </CardHeader>
        <CardContent className="max-h-[520px] overflow-auto">
          <Table>
            <THead>
              <TR>
                <TH>Model</TH>
                <TH>Input / 1M</TH>
                <TH>Output / 1M</TH>
                <TH>Fetched</TH>
              </TR>
            </THead>
            <TBody>
              {prices.map((price) => (
                <TR key={price.external_model_id}>
                  <TD className="font-medium">{price.external_model_id}</TD>
                  <TD>{formatCurrency(price.input_cost_per_1m_tokens)}</TD>
                  <TD>{formatCurrency(price.output_cost_per_1m_tokens)}</TD>
                  <TD>{new Date(price.fetched_at).toLocaleString()}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
