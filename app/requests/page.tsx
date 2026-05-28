"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatCurrency, formatNumber } from "@/lib/utils";

type RequestRow = {
  id: number;
  created_at: string;
  model: string;
  endpoint: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  duration_ms: number;
  tokens_per_second: number;
  streamed: number;
  estimated_cost: number;
};

export default function RequestsPage() {
  const [query, setQuery] = useState("");
  const [requests, setRequests] = useState<RequestRow[]>([]);

  useEffect(() => {
    let active = true;
    async function load() {
      const response = await fetch(`/api/requests?q=${encodeURIComponent(query)}`, { cache: "no-store" });
      const json = await response.json();
      if (active) setRequests(json.requests || []);
    }
    load();
    const timer = setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [query]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Input
          placeholder="Search model or endpoint"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Latest Requests</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <THead>
              <TR>
                <TH>Time</TH>
                <TH>Model</TH>
                <TH>Endpoint</TH>
                <TH>Prompt</TH>
                <TH>Completion</TH>
                <TH>Total</TH>
                <TH>Duration</TH>
                <TH>Stream</TH>
                <TH>Cost</TH>
              </TR>
            </THead>
            <TBody>
              {requests.map((row) => (
                <TR key={row.id}>
                  <TD>{new Date(row.created_at).toLocaleString()}</TD>
                  <TD className="font-medium">{row.model}</TD>
                  <TD>{row.endpoint}</TD>
                  <TD>{formatNumber(row.prompt_tokens)}</TD>
                  <TD>{formatNumber(row.completion_tokens)}</TD>
                  <TD>{formatNumber(row.total_tokens)}</TD>
                  <TD>{formatNumber(row.duration_ms)} ms</TD>
                  <TD>{row.streamed ? "yes" : "no"}</TD>
                  <TD>{formatCurrency(row.estimated_cost)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
