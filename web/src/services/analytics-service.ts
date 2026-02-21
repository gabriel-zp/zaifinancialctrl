import { supabase } from "@/lib/supabase"
import type { AllocationPoint, PortfolioRow } from "@/types/analytics"

interface PortfolioQueryRow {
  mes: string
  valor_final_mes: number | string | null
  rentabilidade_mes: number | string | null
}

interface AllocationQueryRow {
  acao: string
  valor_final_mes: number | string | null
}

function toNumber(value: number | string | null): number {
  if (typeof value === "number") {
    return value
  }
  if (typeof value === "string" && value.length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

export async function getPortfolioSeries(): Promise<PortfolioRow[]> {
  const { data, error } = await supabase
    .from("rentabilidade_treated")
    .select("mes, valor_final_mes, rentabilidade_mes")
    .eq("acao", "Patrimônio")
    .order("mes", { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data ?? []) as PortfolioQueryRow[]

  return rows.map((row) => ({
    mes: row.mes,
    patrimonio: toNumber(row.valor_final_mes),
    rentabilidadeMes: toNumber(row.rentabilidade_mes),
  }))
}

export async function getLatestAllocation(): Promise<AllocationPoint[]> {
  const { data: latestMonthData, error: latestMonthError } = await supabase
    .from("rentabilidade_treated")
    .select("mes")
    .eq("acao", "Patrimônio")
    .order("mes", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latestMonthError) {
    throw new Error(latestMonthError.message)
  }

  if (!latestMonthData?.mes) {
    return []
  }

  const { data, error } = await supabase
    .from("rentabilidade_treated")
    .select("acao, valor_final_mes")
    .eq("mes", latestMonthData.mes)
    .neq("acao", "Patrimônio")
    .neq("acao", "SALDOS")

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data ?? []) as AllocationQueryRow[]
  const normalizedRows = rows
    .map((row) => ({
      acao: row.acao,
      valor: toNumber(row.valor_final_mes),
    }))
    .filter((row) => row.valor > 0)

  const total = normalizedRows.reduce((acc, row) => acc + row.valor, 0)

  if (!total) {
    return []
  }

  return normalizedRows
    .map((row) => ({
      acao: row.acao,
      valor: row.valor,
      percentual: row.valor / total,
    }))
    .sort((a, b) => b.valor - a.valor)
}
