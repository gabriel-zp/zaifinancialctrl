import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getDocument } from "npm:pdfjs-dist@4.10.38/legacy/build/pdf.mjs";

type ParsedRow = {
  ticker: string;
  acoesCompradas: number;
  acoesVendidas: number;
  resumoAcoes: number;
  formulaTotalCompra: string;
  formulaTotalVenda: string;
  data: string;
};

type ParsedPayload = {
  rows: ParsedRow[];
  totalLiquidoNota: string;
};

type AggregateRow = {
  ticker: string;
  compras: number;
  vendas: number;
  compraTerms: string[];
  vendaTerms: string[];
};

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

function toNumber(value: string): number {
  const sanitized = value.replace(/\./g, "").replace(/,/g, ".").trim();
  const parsed = Number.parseFloat(sanitized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toQuantity(value: string): number {
  const sanitized = value.replace(/\./g, "").trim();
  const parsed = Number.parseInt(sanitized, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatBrlSigned(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const formatted = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(abs);
  return `${sign}${formatted}`;
}

function normalizeTicker(rawSpec: string): string {
  const parts = rawSpec.trim().split(/\s+/);
  const matched = parts.find((item) => /[A-Z]{4}\d{1,2}/.test(item));
  return matched ?? parts[0] ?? rawSpec.trim();
}

async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const loadingTask = getDocument({ data: bytes, useWorkerFetch: false, isEvalSupported: false });
  const pdf = await loadingTask.promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const lines: string[] = [];
    let line = "";

    for (const item of textContent.items) {
      if (!("str" in item)) {
        continue;
      }
      line += item.str;
      if (item.hasEOL) {
        lines.push(line.trim());
        line = "";
      } else {
        line += " ";
      }
    }

    if (line.trim()) {
      lines.push(line.trim());
    }

    pages.push(lines.join("\n"));
  }

  return pages.join("\n");
}

function parseTradesFromText(text: string): ParsedPayload {
  const dateMatch = text.match(/Data\s*preg[aã]o[^\d]*(\d{2}\/\d{2}\/\d{4})/i);
  const fallbackDateMatch = text.match(/\b\d{2}\/\d{2}\/\d{4}\b/);
  const tradeDate = dateMatch?.[1] ?? fallbackDateMatch?.[0] ?? "";

  const operationRegex =
    /^\d+-BOVESPA\s+([CV])\s+\S+\s+(.+?)\s+(\d{1,3}(?:\.\d{3})*|\d+)\s+(\d+,\d{2})\s+[\d\.,]+\s+[CD]$/;

  const aggregate = new Map<string, AggregateRow>();
  let totalLiquidoNumerico = 0;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    if (!line.startsWith("1-BOVESPA")) {
      continue;
    }

    const match = line.match(operationRegex);
    if (!match) {
      continue;
    }

    const side = match[1];
    const spec = match[2];
    const quantity = toQuantity(match[3]);
    const priceRaw = match[4];
    const price = toNumber(priceRaw);
    const ticker = normalizeTicker(spec);

    if (!quantity || !price || !ticker) {
      continue;
    }

    const existing = aggregate.get(ticker) ?? {
      ticker,
      compras: 0,
      vendas: 0,
      compraTerms: [],
      vendaTerms: [],
    };

    const term = `${quantity}*${priceRaw}`;
    if (side === "C") {
      existing.compras += quantity;
      existing.compraTerms.push(term);
      totalLiquidoNumerico += quantity * price;
    } else {
      existing.vendas += quantity;
      existing.vendaTerms.push(term);
      totalLiquidoNumerico -= quantity * price;
    }

    aggregate.set(ticker, existing);
  }

  const rows: ParsedRow[] = Array.from(aggregate.values())
    .sort((a, b) => a.ticker.localeCompare(b.ticker))
    .map((row) => ({
      ticker: row.ticker,
      acoesCompradas: row.compras,
      acoesVendidas: row.vendas,
      resumoAcoes: row.compras - row.vendas,
      formulaTotalCompra: row.compraTerms.join(" + "),
      formulaTotalVenda: row.vendaTerms.join(" - "),
      data: tradeDate,
    }));

  return {
    rows,
    totalLiquidoNota: formatBrlSigned(totalLiquidoNumerico),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { ok: false, message: "Method not allowed" });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return json(400, { ok: false, message: "Envie um arquivo PDF no campo 'file'" });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const text = await extractPdfText(bytes);
    const parsed = parseTradesFromText(text);

    return json(200, {
      ok: true,
      rows: parsed.rows,
      totalLiquidoNota: parsed.totalLiquidoNota,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado ao processar PDF";
    return json(500, { ok: false, message });
  }
});
