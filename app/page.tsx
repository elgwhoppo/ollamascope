"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatCurrency, formatNumber } from "@/lib/utils";

type DashboardData = {
  totals: {
    total_requests: number;
    total_tokens: number;
    total_estimated_savings: number;
    requests_today: number;
  };
  mostUsedModels: Array<{ model: string; requests: number; tokens: number; cost: number }>;
  daily: Array<{ date: string; requests: number; tokens: number; cost: number }>;
};

const empty: DashboardData = {
  totals: { total_requests: 0, total_tokens: 0, total_estimated_savings: 0, requests_today: 0 },
  mostUsedModels: [],
  daily: []
};

export default function OverviewPage() {
  const [data, setData] = useState<DashboardData>(empty);

  useEffect(() => {
    let active = true;
    async function load() {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      if (active) setData(await response.json());
    }
    load();
    const timer = setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const metrics = [
    ["Total requests", formatNumber(data.totals.total_requests)],
    ["Total tokens", formatNumber(data.totals.total_tokens)],
    ["Estimated savings", formatCurrency(data.totals.total_estimated_savings)],
    ["Requests today", formatNumber(data.totals.requests_today)]
  ];

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map(([label, value]) => (
          <Card key={label}>
            <CardHeader>
              <CardTitle>{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{value}</div>
            </CardContent>
          </Card>
        ))}
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
