import { supabase } from "@/lib/supabase"
import type { AssetOption, MarketHistoryResponse, PortfolioAssetPoint } from "@/types/asset"

interface AssetQueryRow {
  mes?: string
  acao: string
  valor_final_mes?: number | string | null
}

const TICKER_REGEX = /\b[A-Z]{4}\d{1,2}\b|\b[A-Z]{4}\d{3}\b/

function monthLabel(dateIso: string): string {
  const date = new Date(`${dateIso}T00:00:00`)
  return date.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
}

function toNumber(value: number | string | null | undefined): number {
  if (typeof value === "number") {
    return value
  }
  if (typeof value === "string" && value.length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

export function extractTickerFromAcao(acao: string): string | null {
  const normalized = acao.toUpperCase().replace(/\s+/g, " ").trim()
  const match = normalized.match(TICKER_REGEX)
  return match?.[0] ?? null
}

export async function getAvailableAssetTickers(): Promise<AssetOption[]> {
  const { data, error } = await supabase
    .from("rentabilidade_treated")
    .select("acao")
    .neq("acao", "Patrimônio")
    .neq("acao", "SALDOS")

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data ?? []) as AssetQueryRow[]
  const tickerSet = new Set<string>()

  for (const row of rows) {
    const ticker = extractTickerFromAcao(row.acao)
    if (ticker) {
      tickerSet.add(ticker)
    }
  }

  return Array.from(tickerSet)
    .sort((a, b) => a.localeCompare(b))
    .map((ticker) => ({ ticker }))
}

export async function getPortfolioAssetSeries(ticker: string): Promise<PortfolioAssetPoint[]> {
  const { data, error } = await supabase
    .from("rentabilidade_treated")
    .select("mes, acao, valor_final_mes")
    .neq("acao", "Patrimônio")
    .neq("acao", "SALDOS")
    .order("mes", { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data ?? []) as AssetQueryRow[]
  const byMonth = new Map<string, number>()

  for (const row of rows) {
    if (!row.mes) {
      continue
    }
    const rowTicker = extractTickerFromAcao(row.acao)
    if (rowTicker !== ticker) {
      continue
    }
    byMonth.set(row.mes, (byMonth.get(row.mes) ?? 0) + toNumber(row.valor_final_mes))
  }

  return Array.from(byMonth.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([mes, positionBrl]) => ({
      mes,
      mesLabel: monthLabel(mes),
      positionBrl,
    }))
}

export async function getMarketHistory(ticker: string): Promise<MarketHistoryResponse> {
  const { data, error } = await supabase.functions.invoke<MarketHistoryResponse>("market-history-public", {
    body: {
      ticker,
      range: "2y",
      interval: "1d",
    },
  })

  if (error) {
    throw new Error(error.message)
  }

  if (!data || !("ok" in data) || !("points" in data)) {
    throw new Error("Resposta invalida da funcao de mercado")
  }

  return data
}
