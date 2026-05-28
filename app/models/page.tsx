"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatCurrency, formatNumber } from "@/lib/utils";

type ModelRow = {
  model: string;
  requests: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost: number;
  avg_tokens_per_second: number;
};

export default function ModelsPage() {
  const [models, setModels] = useState<ModelRow[]>([]);

  useEffect(() => {
    let active = true;
    async function load() {
      const response = await fetch("/api/models", { cache: "no-store" });
      const json = await response.json();
      if (active) setModels(json.models || []);
    }
    load();
    const timer = setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usage By Model</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <THead>
            <TR>
              <TH>Model</TH>
              <TH>Requests</TH>
              <TH>Prompt Tokens</TH>
              <TH>Completion Tokens</TH>
              <TH>Total Tokens</TH>
              <TH>Avg Tok/Sec</TH>
              <TH>Estimated Savings</TH>
            </TR>
          </THead>
          <TBody>
            {models.map((row) => (
              <TR key={row.model}>
                <TD className="font-medium">{row.model}</TD>
                <TD>{formatNumber(row.requests)}</TD>
                <TD>{formatNumber(row.prompt_tokens)}</TD>
                <TD>{formatNumber(row.completion_tokens)}</TD>
                <TD>{formatNumber(row.total_tokens)}</TD>
                <TD>{formatNumber(Math.round(row.avg_tokens_per_second || 0))}</TD>
                <TD>{formatCurrency(row.estimated_cost)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </CardContent>
    </Card>
  );
}
