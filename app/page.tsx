"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";

const DEFAULT_WHATIF_MODEL = "anthropic/claude-opus-4";

type PricedModel = {
  external_model_id: string;
  input_cost_per_1m_tokens: number;
  output_cost_per_1m_tokens: number;
  fetched_at: string;
};

type DashboardData = {
  totals: {
    total_requests: number;
    total_tokens: number;
    total_prompt_tokens: number;
    total_completion_tokens: number;
    total_estimated_savings: number;
    requests_today: number;
    tokens_today: number;
  };
  pricedModels: PricedModel[];
  mostUsedModels: Array<{ model: string; requests: number; tokens: number; cost: number }>;
  daily: Array<{ date: string; requests: number; tokens: number; cost: number }>;
};

const empty: DashboardData = {
  totals: {
    total_requests: 0,
    total_tokens: 0,
    total_prompt_tokens: 0,
    total_completion_tokens: 0,
    total_estimated_savings: 0,
    requests_today: 0,
    tokens_today: 0
  },
  pricedModels: [],
  mostUsedModels: [],
  daily: []
};

function StatPair({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}

function whatIfCost(
  pricedModels: PricedModel[],
  modelId: string,
  promptTokens: number,
  completionTokens: number
) {
  const price = pricedModels.find((row) => row.external_model_id === modelId);
  if (!price) return 0;
  return (
    (promptTokens / 1_000_000) * price.input_cost_per_1m_tokens +
    (completionTokens / 1_000_000) * price.output_cost_per_1m_tokens
  );
}

export default function OverviewPage() {
  const [data, setData] = useState<DashboardData>(empty);
  const [whatIfModelId, setWhatIfModelId] = useState(DEFAULT_WHATIF_MODEL);

  useEffect(() => {
    let active = true;
    async function load() {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      if (!active) return;
      const json = await response.json();
      setData(json);
      const priced = json.pricedModels || [];
      setWhatIfModelId((current) => {
        if (priced.some((row: PricedModel) => row.external_model_id === current)) {
          return current;
        }
        const preferred = priced.find((row: PricedModel) => row.external_model_id === DEFAULT_WHATIF_MODEL);
        return preferred?.external_model_id || priced[0]?.external_model_id || DEFAULT_WHATIF_MODEL;
      });
    }
    load();
    const timer = setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const selectedWhatIfPrice = useMemo(
    () => data.pricedModels.find((row) => row.external_model_id === whatIfModelId),
    [data.pricedModels, whatIfModelId]
  );

  const whatIfTotal = useMemo(
    () =>
      whatIfCost(
        data.pricedModels,
        whatIfModelId,
        data.totals.total_prompt_tokens,
        data.totals.total_completion_tokens
      ),
    [data.pricedModels, data.totals.total_completion_tokens, data.totals.total_prompt_tokens, whatIfModelId]
  );

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>All time</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <StatPair label="Requests" value={formatNumber(data.totals.total_requests)} />
            <StatPair label="Tokens" value={formatNumber(data.totals.total_tokens)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Today</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <StatPair label="Requests" value={formatNumber(data.totals.requests_today)} />
            <StatPair label="Tokens" value={formatNumber(data.totals.tokens_today)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Estimated savings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatCurrency(data.totals.total_estimated_savings)}</div>
            <p className="mt-2 text-sm text-muted-foreground">Cloud-equivalent cost for all tracked usage</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What if</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {formatNumber(data.totals.total_prompt_tokens)} in ·{" "}
              {formatNumber(data.totals.total_completion_tokens)} out
            </p>
            <select
              id="whatif-model"
              aria-label="Compare pricing model"
              className={cn(
                "h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
              )}
              value={whatIfModelId}
              onChange={(event) => setWhatIfModelId(event.target.value)}
              disabled={data.pricedModels.length === 0}
            >
              {data.pricedModels.map((row) => (
                <option key={row.external_model_id} value={row.external_model_id}>
                  {row.external_model_id}
                </option>
              ))}
            </select>
            <div className="text-2xl font-semibold">{formatCurrency(whatIfTotal)}</div>
            {selectedWhatIfPrice ? (
              <p className="text-sm text-muted-foreground">
                {formatCurrency(selectedWhatIfPrice.input_cost_per_1m_tokens)} / 1M in ·{" "}
                {formatCurrency(selectedWhatIfPrice.output_cost_per_1m_tokens)} / 1M out
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Sync pricing to compare models</p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Token Usage</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151" }} />
                <Bar dataKey="tokens" fill="#2dd4bf" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Estimated Cost</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151" }} />
                <Line type="monotone" dataKey="cost" stroke="#60a5fa" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Most Used Models</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <THead>
              <TR>
                <TH>Model</TH>
                <TH>Requests</TH>
                <TH>Tokens</TH>
                <TH>Estimated Savings</TH>
              </TR>
            </THead>
            <TBody>
              {data.mostUsedModels.map((row) => (
                <TR key={row.model}>
                  <TD className="font-medium">{row.model}</TD>
                  <TD>{formatNumber(row.requests)}</TD>
                  <TD>{formatNumber(row.tokens)}</TD>
                  <TD>{formatCurrency(row.cost)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
