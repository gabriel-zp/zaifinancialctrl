import { useEffect, useMemo, useState } from "react"
import { getAllocationSeries, getPortfolioSeries } from "@/services/analytics-service"
import type { AllocationPoint, AllocationSeriesRow, PortfolioMetrics, PortfolioPoint } from "@/types/analytics"

function monthLabel(dateIso: string): string {
  const date = new Date(`${dateIso}T00:00:00`)
  return date.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
}

function buildPortfolioPoints(
  rows: Array<{ mes: string; patrimonio: number; rentabilidadeMes: number }>
): PortfolioPoint[] {
  let accumulated = 1

  return rows.map((row) => {
    accumulated *= 1 + row.rentabilidadeMes

    return {
      ...row,
      mesLabel: monthLabel(row.mes),
      retornoAcumulado: accumulated - 1,
    }
  })
}

function buildAllocationByMonth(rows: AllocationSeriesRow[]): Record<string, AllocationPoint[]> {
  const grouped = new Map<string, AllocationSeriesRow[]>()

  for (const row of rows) {
    const monthRows = grouped.get(row.mes)
    if (monthRows) {
      monthRows.push(row)
      continue
    }

    grouped.set(row.mes, [row])
  }

  const out: Record<string, AllocationPoint[]> = {}

  for (const [mes, monthRows] of grouped.entries()) {
    const total = monthRows.reduce((acc, row) => acc + row.valor, 0)

    if (!total) {
      out[mes] = []
      continue
    }

    out[mes] = monthRows
      .map((row) => ({
        acao: row.acao,
        valor: row.valor,
        percentual: row.valor / total,
      }))
      .sort((a, b) => b.valor - a.valor)
  }

  return out
}

export function useAnalyticsData(enabled: boolean) {
  const [portfolio, setPortfolio] = useState<PortfolioPoint[]>([])
  const [allocationByMonth, setAllocationByMonth] = useState<Record<string, AllocationPoint[]>>({})
  const [isLoading, setIsLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) {
      setPortfolio([])
      setAllocationByMonth({})
      setError(null)
      setIsLoading(false)
      return
    }

    let mounted = true

    async function load() {
      setError(null)
      setIsLoading(true)

      try {
        const [portfolioRows, allocationRows] = await Promise.all([
          getPortfolioSeries(),
          getAllocationSeries(),
        ])

        if (!mounted) {
          return
        }

        setPortfolio(buildPortfolioPoints(portfolioRows))
        setAllocationByMonth(buildAllocationByMonth(allocationRows))
      } catch (err) {
        if (!mounted) {
          return
        }

        const message = err instanceof Error ? err.message : "Nao foi possivel carregar os dados"
        setError(message)
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    void load()

    return () => {
      mounted = false
    }
  }, [enabled])

  const metrics = useMemo<PortfolioMetrics>(() => {
    if (!portfolio.length) {
      return {
        currentPatrimonio: 0,
        currentRentabilidade: 0,
        currentRetornoAcumulado: 0,
      }
    }

    const latest = portfolio[portfolio.length - 1]

    return {
      currentPatrimonio: latest.patrimonio,
      currentRentabilidade: latest.rentabilidadeMes,
      currentRetornoAcumulado: latest.retornoAcumulado,
    }
  }, [portfolio])

  return {
    portfolio,
    allocationByMonth,
    metrics,
    isLoading,
    error,
  }
}
