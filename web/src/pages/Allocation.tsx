import { useEffect, useMemo, useState } from "react"
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
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
  gold_cash: string[]
}

type AllocationBreakdownRow = AllocationPoint & {
  percentualCarteira: number
}

type ClassifiedAllocation = {
  rendaVariavel: AllocationBreakdownRow[]
  rendaFixa: AllocationBreakdownRow[]
  goldCash: AllocationBreakdownRow[]
  totalRendaVariavel: number
  totalRendaFixa: number
  totalGoldCash: number
}

type GroupKey = "rendaVariavel" | "rendaFixa" | "goldCash"

const GOLD_CASH_ASSET_KEY = normalizeKey("GOLD + CASH")
const MOEDAS_WISE_ASSET_KEY = normalizeKey("MOEDAS - WISE")

const EMPTY_CLASSIFICATION: AssetClassification = {
  renda_variavel: [],
  renda_fixa: [],
  gold_cash: [],
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

function groupLabel(key: GroupKey): string {
  if (key === "rendaFixa") {
    return "Renda Fixa"
  }
  if (key === "goldCash") {
    return "Gold/Cash"
  }
  return "Renda Variavel"
}

function buildClassAllocation(rows: AllocationPoint[], totalCarteira: number): AllocationBreakdownRow[] {
  const totalGrupo = rows.reduce((acc, row) => acc + row.valor, 0)

  if (!totalGrupo) {
    return []
  }

  return rows
    .map((row) => ({
      ...row,
      percentual: row.valor / totalGrupo,
      percentualCarteira: totalCarteira ? row.valor / totalCarteira : 0,
    }))
    .sort((a, b) => b.valor - a.valor)
}

function classifyAllocation(rows: AllocationPoint[], classification: AssetClassification): ClassifiedAllocation {
  const rendaVariavelSet = new Set(classification.renda_variavel.map(normalizeKey))
  const rendaFixaSet = new Set(classification.renda_fixa.map(normalizeKey))
  const goldCashSet = new Set(classification.gold_cash.map(normalizeKey))

  const rendaVariavel: AllocationPoint[] = []
  const rendaFixa: AllocationPoint[] = []
  const goldCash: AllocationPoint[] = []

  for (const row of rows) {
    const key = normalizeKey(row.acao)

    if (goldCashSet.has(key)) {
      goldCash.push(row)
      continue
    }

    if (rendaVariavelSet.has(key)) {
      rendaVariavel.push(row)
      continue
    }

    if (rendaFixaSet.has(key)) {
      rendaFixa.push(row)
      continue
    }

    rendaVariavel.push(row)
  }

  const totalRendaVariavel = rendaVariavel.reduce((acc, row) => acc + row.valor, 0)
  const totalRendaFixa = rendaFixa.reduce((acc, row) => acc + row.valor, 0)
  const totalGoldCash = goldCash.reduce((acc, row) => acc + row.valor, 0)
  const totalCarteira = totalRendaVariavel + totalRendaFixa + totalGoldCash

  return {
    rendaVariavel: buildClassAllocation(rendaVariavel, totalCarteira),
    rendaFixa: buildClassAllocation(rendaFixa, totalCarteira),
    goldCash: buildClassAllocation(goldCash, totalCarteira),
    totalRendaVariavel,
    totalRendaFixa,
    totalGoldCash,
  }
}

function AllocationTable({ title, data }: { title: string; data: AllocationBreakdownRow[] }) {
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
                  <th className="px-2 py-2 text-right font-medium">% no grupo</th>
                  <th className="px-2 py-2 text-right font-medium">% da carteira</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.acao} className="border-b border-slate-100 last:border-b-0">
                    <td className="px-2 py-2 text-slate-800">{row.acao}</td>
                    <td className="px-2 py-2 text-right text-slate-700">{formatMoney(row.valor)}</td>
                    <td className="px-2 py-2 text-right text-slate-700">{formatPercent(row.percentual)}</td>
                    <td className="px-2 py-2 text-right text-slate-700">{formatPercent(row.percentualCarteira)}</td>
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

function DonutCard({ title, description, data }: { title: string; description: string; data: AllocationPoint[] }) {
  return (
    <Card className="rounded-2xl border-slate-200 shadow-none">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <AllocationDonutChart data={data} />
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
  const [selectedTrendGroup, setSelectedTrendGroup] = useState<GroupKey>("rendaVariavel")

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
          gold_cash: data.gold_cash ?? [],
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
    const total = classified.totalRendaVariavel + classified.totalRendaFixa + classified.totalGoldCash
    if (!total) {
      return { rendaVariavel: 0, rendaFixa: 0, goldCash: 0 }
    }

    return {
      rendaVariavel: classified.totalRendaVariavel / total,
      rendaFixa: classified.totalRendaFixa / total,
      goldCash: classified.totalGoldCash / total,
    }
  }, [classified.totalGoldCash, classified.totalRendaFixa, classified.totalRendaVariavel])

  const classSummaryRows = useMemo<AllocationBreakdownRow[]>(() => {
    const totalCarteira =
      classified.totalRendaVariavel + classified.totalRendaFixa + classified.totalGoldCash

    if (!totalCarteira) {
      return []
    }

    let goldCashTotal = 0
    let moedasWiseTotal = 0

    for (const row of classified.goldCash) {
      const key = normalizeKey(row.acao)
      if (key === MOEDAS_WISE_ASSET_KEY) {
        moedasWiseTotal += row.valor
      } else if (key === GOLD_CASH_ASSET_KEY) {
        goldCashTotal += row.valor
      } else {
        goldCashTotal += row.valor
      }
    }

    const rawRows = [
      { acao: "Renda Variavel", valor: classified.totalRendaVariavel },
      { acao: "Renda Fixa", valor: classified.totalRendaFixa },
      { acao: "Gold + CASH", valor: goldCashTotal },
      { acao: "MOEDAS - WISE", valor: moedasWiseTotal },
    ].filter((row) => row.valor > 0)

    return rawRows.map((row) => ({
      ...row,
      percentual: row.valor / totalCarteira,
      percentualCarteira: row.valor / totalCarteira,
    }))
  }, [classified.goldCash, classified.totalGoldCash, classified.totalRendaFixa, classified.totalRendaVariavel])

  const classSummaryDonutData = useMemo<AllocationPoint[]>(() => {
    return classSummaryRows.map((row) => ({
      acao: row.acao,
      valor: row.valor,
      percentual: row.percentual,
    }))
  }, [classSummaryRows])

  const groupTrendData = useMemo(() => {
    return filteredPortfolio.map((point) => {
      const monthRows = allocationByMonth[point.mes] ?? []
      const monthClassified = classifyAllocation(monthRows, classification)
      const monthTotal =
        monthClassified.totalRendaVariavel + monthClassified.totalRendaFixa + monthClassified.totalGoldCash

      const selectedTotal =
        selectedTrendGroup === "rendaFixa"
          ? monthClassified.totalRendaFixa
          : selectedTrendGroup === "goldCash"
            ? monthClassified.totalGoldCash
            : monthClassified.totalRendaVariavel

      return {
        mesLabel: point.mesLabel,
        percentual: monthTotal ? selectedTotal / monthTotal : 0,
      }
    })
  }, [allocationByMonth, classification, filteredPortfolio, selectedTrendGroup])

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
              <section className="grid gap-4 md:grid-cols-3">
                <Card className="rounded-2xl border-slate-200 shadow-none">
                  <CardHeader>
                    <CardTitle className="text-base">Renda Variavel</CardTitle>
                    <CardDescription>Percentual no total da carteira.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-semibold text-slate-900">{formatPercent(split.rendaVariavel)}</p>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border-slate-200 shadow-none">
                  <CardHeader>
                    <CardTitle className="text-base">Renda Fixa</CardTitle>
                    <CardDescription>Percentual no total da carteira.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-semibold text-slate-900">{formatPercent(split.rendaFixa)}</p>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border-slate-200 shadow-none">
                  <CardHeader>
                    <CardTitle className="text-base">Gold/Cash</CardTitle>
                    <CardDescription>Percentual no total da carteira.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-semibold text-slate-900">{formatPercent(split.goldCash)}</p>
                  </CardContent>
                </Card>
              </section>

              <section>
                <Card className="rounded-2xl border-slate-200 shadow-none">
                  <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="text-base">Participacao da classe ao longo do tempo</CardTitle>
                      <CardDescription>
                        Serie temporal no periodo filtrado pelo slider.
                      </CardDescription>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      Classe
                      <select
                        value={selectedTrendGroup}
                        onChange={(event) => setSelectedTrendGroup(event.target.value as GroupKey)}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700"
                      >
                        <option value="rendaVariavel">Renda Variavel</option>
                        <option value="rendaFixa">Renda Fixa</option>
                        <option value="goldCash">Gold/Cash</option>
                      </select>
                    </label>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={groupTrendData} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
                        <CartesianGrid vertical={false} stroke="#e7edf6" strokeDasharray="4 4" />
                        <XAxis
                          dataKey="mesLabel"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 12, fill: "#64748b" }}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 12, fill: "#64748b" }}
                          tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                        />
                        <Tooltip
                          formatter={(value) => formatPercent(typeof value === "number" ? value : 0)}
                          labelFormatter={(label) => `${label} - ${groupLabel(selectedTrendGroup)}`}
                        />
                        <Line
                          type="monotone"
                          dataKey="percentual"
                          name={groupLabel(selectedTrendGroup)}
                          stroke="#1f4db4"
                          strokeWidth={2.5}
                          dot={false}
                          activeDot={{ r: 5, fill: "#1f4db4" }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </section>

              <section className="grid gap-4 xl:grid-cols-3">
                <DonutCard
                  title="Distribuicao - Renda Variavel"
                  description="A soma da categoria e 100% no grafico."
                  data={classified.rendaVariavel}
                />
                <DonutCard
                  title="Distribuicao - Renda Fixa"
                  description="A soma da categoria e 100% no grafico."
                  data={classified.rendaFixa}
                />
                <DonutCard
                  title="Distribuicao - Gold/Cash"
                  description="A soma da categoria e 100% no grafico."
                  data={classified.goldCash}
                />
              </section>

              <section className="grid gap-4 xl:grid-cols-3">
                <AllocationTable title="Tabela - Renda Variavel" data={classified.rendaVariavel} />
                <AllocationTable title="Tabela - Renda Fixa" data={classified.rendaFixa} />
                <AllocationTable title="Tabela - Gold/Cash" data={classified.goldCash} />
              </section>

              <section className="grid gap-4 xl:grid-cols-2">
                <DonutCard
                  title="Distribuicao geral por classe"
                  description="Composicao entre RV, RF, Gold + CASH e MOEDAS - WISE no mes filtrado."
                  data={classSummaryDonutData}
                />
                <AllocationTable title="Tabela - Distribuicao geral por classe" data={classSummaryRows} />
              </section>
            </>
          )}
        </>
      ) : null}
    </div>
  )
}
