import { useEffect, useMemo, useState } from "react"
import { AllocationDonutChart } from "@/components/charts/financial-charts"
import { DateRangeSlider } from "@/components/shared/date-range-slider"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { canViewAnalyticsData } from "@/config/access"
import { useAnalyticsData } from "@/hooks/use-analytics-data"
import { useAuth } from "@/hooks/use-auth"
import type { AllocationPoint, PortfolioPoint } from "@/types/analytics"

type AssetClassification = {
  renda_variavel: string[]
  renda_fixa: string[]
}

type ClassifiedAllocation = {
  rendaVariavel: AllocationPoint[]
  rendaFixa: AllocationPoint[]
  totalRendaVariavel: number
  totalRendaFixa: number
}

const EMPTY_CLASSIFICATION: AssetClassification = {
  renda_variavel: [],
  renda_fixa: [],
}

function normalizeKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value)
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`
}

function buildClassAllocation(rows: AllocationPoint[]): AllocationPoint[] {
  const total = rows.reduce((acc, row) => acc + row.valor, 0)

  if (!total) {
    return []
  }

  return rows
    .map((row) => ({
      ...row,
      percentual: row.valor / total,
    }))
    .sort((a, b) => b.valor - a.valor)
}

function classifyAllocation(
  rows: AllocationPoint[],
  classification: AssetClassification
): ClassifiedAllocation {
  const rendaVariavelSet = new Set(classification.renda_variavel.map(normalizeKey))
  const rendaFixaSet = new Set(classification.renda_fixa.map(normalizeKey))

  const rendaVariavel: AllocationPoint[] = []
  const rendaFixa: AllocationPoint[] = []

  for (const row of rows) {
    const key = normalizeKey(row.acao)
    if (rendaVariavelSet.has(key)) {
      rendaVariavel.push(row)
      continue
    }

    if (rendaFixaSet.has(key)) {
      rendaFixa.push(row)
      continue
    }

    rendaFixa.push(row)
  }

  const totalRendaVariavel = rendaVariavel.reduce((acc, row) => acc + row.valor, 0)
  const totalRendaFixa = rendaFixa.reduce((acc, row) => acc + row.valor, 0)

  return {
    rendaVariavel: buildClassAllocation(rendaVariavel),
    rendaFixa: buildClassAllocation(rendaFixa),
    totalRendaVariavel,
    totalRendaFixa,
  }
}

function AllocationTable({ title, data }: { title: string; data: AllocationPoint[] }) {
  return (
    <Card className="rounded-2xl border-slate-200 shadow-none">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>Detalhamento por ativo no ultimo mes filtrado.</CardDescription>
      </CardHeader>
      <CardContent>
        {!data.length ? (
          <p className="text-sm text-slate-500">Sem ativos nesta categoria para o periodo selecionado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-2 text-left font-medium">Ativo</th>
                  <th className="px-2 py-2 text-right font-medium">Valor</th>
                  <th className="px-2 py-2 text-right font-medium">%</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.acao} className="border-b border-slate-100 last:border-b-0">
                    <td className="px-2 py-2 text-slate-800">{row.acao}</td>
                    <td className="px-2 py-2 text-right text-slate-700">{formatMoney(row.valor)}</td>
                    <td className="px-2 py-2 text-right text-slate-700">{formatPercent(row.percentual)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function AllocationPage() {
  const { user } = useAuth()
  const isAuthorizedForAnalytics = canViewAnalyticsData(user?.email)
  const [dateRange, setDateRange] = useState<[number, number]>([0, 0])
  const [classification, setClassification] = useState<AssetClassification>(EMPTY_CLASSIFICATION)
  const [classificationError, setClassificationError] = useState<string | null>(null)

  const { portfolio, allocationByMonth, isLoading, error } = useAnalyticsData(isAuthorizedForAnalytics)

  useEffect(() => {
    let mounted = true

    async function loadClassification() {
      setClassificationError(null)

      try {
        const response = await fetch("/asset-classification.json")
        if (!response.ok) {
          throw new Error("Nao foi possivel carregar a classificacao de ativos")
        }

        const data = (await response.json()) as AssetClassification
        if (!mounted) {
          return
        }

        setClassification({
          renda_variavel: data.renda_variavel ?? [],
          renda_fixa: data.renda_fixa ?? [],
        })
      } catch (fetchError) {
        if (!mounted) {
          return
        }

        const message =
          fetchError instanceof Error ? fetchError.message : "Erro ao carregar classificacao de ativos"
        setClassificationError(message)
        setClassification(EMPTY_CLASSIFICATION)
      }
    }

    void loadClassification()

    return () => {
      mounted = false
    }
  }, [])

  const safeDateRange = useMemo<[number, number]>(() => {
    const maxIndex = Math.max(0, portfolio.length - 1)

    if (portfolio.length <= 1) {
      return [0, 0]
    }

    if (dateRange[0] === 0 && dateRange[1] === 0) {
      return [0, maxIndex]
    }

    const start = Math.min(Math.max(0, dateRange[0]), maxIndex)
    const end = Math.min(Math.max(start, dateRange[1]), maxIndex)

    return [start, end]
  }, [dateRange, portfolio.length])

  const filteredPortfolio = useMemo<PortfolioPoint[]>(() => {
    if (!portfolio.length) {
      return []
    }

    const [start, end] = safeDateRange
    return portfolio.slice(start, end + 1)
  }, [portfolio, safeDateRange])

  const filteredRangeLabels = useMemo(() => {
    if (!filteredPortfolio.length) {
      return { start: "-", end: "-" }
    }

    return {
      start: filteredPortfolio[0].mesLabel,
      end: filteredPortfolio[filteredPortfolio.length - 1].mesLabel,
    }
  }, [filteredPortfolio])

  const lastFilteredMonthAllocation = useMemo<AllocationPoint[]>(() => {
    if (!filteredPortfolio.length) {
      return []
    }

    const lastFilteredMonth = filteredPortfolio[filteredPortfolio.length - 1].mes
    return allocationByMonth[lastFilteredMonth] ?? []
  }, [allocationByMonth, filteredPortfolio])

  const classified = useMemo(
    () => classifyAllocation(lastFilteredMonthAllocation, classification),
    [classification, lastFilteredMonthAllocation]
  )

  const split = useMemo(() => {
    const total = classified.totalRendaVariavel + classified.totalRendaFixa
    if (!total) {
      return { rendaVariavel: 0, rendaFixa: 0 }
    }

    return {
      rendaVariavel: classified.totalRendaVariavel / total,
      rendaFixa: classified.totalRendaFixa / total,
    }
  }, [classified.totalRendaFixa, classified.totalRendaVariavel])

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-semibold text-slate-900">Alocacao de carteira</h2>
        <p className="text-sm text-slate-500">
          Distribuicao por classe e por ativo no ultimo mes do periodo filtrado.
        </p>
      </header>

      {!isAuthorizedForAnalytics ? (
        <Card className="rounded-2xl border-amber-200 bg-amber-50 shadow-none">
          <CardHeader>
            <CardTitle className="text-base text-amber-800">Acesso restrito aos dados financeiros</CardTitle>
            <CardDescription className="text-amber-700">
              Seu usuario esta autenticado, mas os graficos de rentabilidade estao liberados somente para
              gzimmermannp@gmail.com e nassermelo@gmail.com.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {isAuthorizedForAnalytics && portfolio.length > 1 && !isLoading ? (
        <DateRangeSlider
          min={0}
          max={portfolio.length - 1}
          value={safeDateRange}
          startLabel={filteredRangeLabels.start}
          endLabel={filteredRangeLabels.end}
          onValueChange={setDateRange}
        />
      ) : null}

      {classificationError ? (
        <Card className="rounded-2xl border-rose-200 bg-rose-50 shadow-none">
          <CardHeader>
            <CardTitle className="text-base text-rose-700">Falha ao carregar classificacao dos ativos</CardTitle>
            <CardDescription className="text-rose-600">{classificationError}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {isAuthorizedForAnalytics ? (
        <>
          {error ? (
            <Card className="rounded-2xl border-rose-200 bg-rose-50 shadow-none">
              <CardHeader>
                <CardTitle className="text-base text-rose-700">Falha ao carregar dados</CardTitle>
                <CardDescription className="text-rose-600">{error}</CardDescription>
              </CardHeader>
            </Card>
          ) : null}

          {isLoading ? (
            <Card className="rounded-2xl border-slate-200 shadow-none">
              <CardHeader>
                <CardTitle className="text-base">Carregando alocacoes...</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
              </CardContent>
            </Card>
          ) : (
            <>
              <section className="grid gap-4 md:grid-cols-2">
                <Card className="rounded-2xl border-slate-200 shadow-none">
                  <CardHeader>
                    <CardTitle className="text-base">Divisao da carteira por classe</CardTitle>
                    <CardDescription>Com base no ultimo mes do filtro selecionado.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Renda fixa</p>
                      <p className="mt-2 text-3xl font-semibold text-slate-900">{formatPercent(split.rendaFixa)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Renda variavel</p>
                      <p className="mt-2 text-3xl font-semibold text-slate-900">
                        {formatPercent(split.rendaVariavel)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </section>

              <section className="grid gap-4 xl:grid-cols-2">
                <Card className="rounded-2xl border-slate-200 shadow-none">
                  <CardHeader>
                    <CardTitle className="text-base">Distribuicao - Renda Variavel</CardTitle>
                    <CardDescription>Cada classe soma 100% dentro do proprio grafico.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <AllocationDonutChart data={classified.rendaVariavel} />
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border-slate-200 shadow-none">
                  <CardHeader>
                    <CardTitle className="text-base">Distribuicao - Renda Fixa</CardTitle>
                    <CardDescription>Inclui ativos classificados como caixa/moedas no JSON.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <AllocationDonutChart data={classified.rendaFixa} />
                  </CardContent>
                </Card>
              </section>

              <section className="grid gap-4 xl:grid-cols-2">
                <AllocationTable title="Tabela - Renda Variavel" data={classified.rendaVariavel} />
                <AllocationTable title="Tabela - Renda Fixa" data={classified.rendaFixa} />
              </section>
            </>
          )}
        </>
      ) : null}
    </div>
  )
}
