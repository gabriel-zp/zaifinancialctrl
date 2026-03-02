import { useEffect, useMemo, useState } from "react"
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { DateRangeSlider } from "@/components/shared/date-range-slider"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { canViewAnalyticsData } from "@/config/access"
import { useAuth } from "@/hooks/use-auth"
import { getAvailableAssetTickers, getMarketHistory, getPortfolioAssetSeries } from "@/services/asset-service"
import type { MarketHistoryPoint, PortfolioAssetPoint } from "@/types/asset"

function formatMoney(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDateLabel(value: string): string {
  const date = new Date(`${value}T00:00:00`)
  return date.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
}

function formatDateShort(value: string): string {
  const date = new Date(`${value}T00:00:00`)
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })
}

type ChartTooltipEntry = {
  value?: number
  name?: string
}

function MoneyTooltip({ active, payload, label }: { active?: boolean; payload?: ChartTooltipEntry[]; label?: string }) {
  if (!active || !payload?.length) {
    return null
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-md">
      <p className="mb-1 text-xs font-semibold text-slate-700">{label}</p>
      <div className="space-y-1">
        {payload.map((entry) => (
          <p key={entry.name} className="text-xs text-slate-600">
            <span className="font-medium text-slate-900">{entry.name}:</span>{" "}
            {typeof entry.value === "number" ? formatMoney(entry.value) : "-"}
          </p>
        ))}
      </div>
    </div>
  )
}

export default function AssetPage() {
  const { user } = useAuth()
  const isAuthorizedForAnalytics = canViewAnalyticsData(user?.email)

  const [tickers, setTickers] = useState<string[]>([])
  const [selectedTicker, setSelectedTicker] = useState<string>("")

  const [portfolioSeries, setPortfolioSeries] = useState<PortfolioAssetPoint[]>([])
  const [marketSeries, setMarketSeries] = useState<MarketHistoryPoint[]>([])
  const [portfolioDateRange, setPortfolioDateRange] = useState<[number, number]>([0, 0])
  const [marketDateRange, setMarketDateRange] = useState<[number, number]>([0, 0])

  const [isLoadingTickers, setIsLoadingTickers] = useState(false)
  const [isLoadingPortfolio, setIsLoadingPortfolio] = useState(false)
  const [isLoadingMarket, setIsLoadingMarket] = useState(false)

  const [tickersError, setTickersError] = useState<string | null>(null)
  const [portfolioError, setPortfolioError] = useState<string | null>(null)
  const [marketError, setMarketError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthorizedForAnalytics) {
      setTickers([])
      setSelectedTicker("")
      setPortfolioSeries([])
      setMarketSeries([])
      setTickersError(null)
      return
    }

    let mounted = true

    async function loadTickers() {
      setIsLoadingTickers(true)
      setTickersError(null)

      try {
        const options = await getAvailableAssetTickers()
        if (!mounted) {
          return
        }

        const tickerList = options.map((item) => item.ticker)
        setTickers(tickerList)
        setSelectedTicker((current) => (current && tickerList.includes(current) ? current : tickerList[0] ?? ""))
      } catch (err) {
        if (!mounted) {
          return
        }
        const message = err instanceof Error ? err.message : "Falha ao carregar ativos"
        setTickersError(message)
      } finally {
        if (mounted) {
          setIsLoadingTickers(false)
        }
      }
    }

    void loadTickers()

    return () => {
      mounted = false
    }
  }, [isAuthorizedForAnalytics])

  useEffect(() => {
    if (!isAuthorizedForAnalytics || !selectedTicker) {
      setPortfolioSeries([])
      setMarketSeries([])
      setPortfolioError(null)
      setMarketError(null)
      return
    }

    let mounted = true

    async function loadSeries() {
      setIsLoadingPortfolio(true)
      setIsLoadingMarket(true)
      setPortfolioError(null)
      setMarketError(null)

      const [portfolioResult, marketResult] = await Promise.allSettled([
        getPortfolioAssetSeries(selectedTicker),
        getMarketHistory(selectedTicker),
      ])

      if (!mounted) {
        return
      }

      if (portfolioResult.status === "fulfilled") {
        setPortfolioSeries(portfolioResult.value)
        setPortfolioError(null)
      } else {
        const message =
          portfolioResult.reason instanceof Error
            ? portfolioResult.reason.message
            : "Falha ao carregar dados da carteira"
        setPortfolioError(message)
        setPortfolioSeries([])
      }

      if (marketResult.status === "fulfilled") {
        setMarketSeries(marketResult.value.points)
        setMarketError(null)
      } else {
        const message =
          marketResult.reason instanceof Error
            ? marketResult.reason.message
            : "Falha ao carregar historico de mercado"
        setMarketError(message)
        setMarketSeries([])
      }

      setIsLoadingPortfolio(false)
      setIsLoadingMarket(false)
    }

    void loadSeries()

    return () => {
      mounted = false
    }
  }, [isAuthorizedForAnalytics, selectedTicker])

  useEffect(() => {
    setPortfolioDateRange([0, 0])
    setMarketDateRange([0, 0])
  }, [selectedTicker])

  const safePortfolioDateRange = useMemo<[number, number]>(() => {
    const maxIndex = Math.max(0, portfolioSeries.length - 1)

    if (portfolioSeries.length <= 1) {
      return [0, 0]
    }

    if (portfolioDateRange[0] === 0 && portfolioDateRange[1] === 0) {
      return [0, maxIndex]
    }

    const start = Math.min(Math.max(0, portfolioDateRange[0]), maxIndex)
    const end = Math.min(Math.max(start, portfolioDateRange[1]), maxIndex)

    return [start, end]
  }, [portfolioDateRange, portfolioSeries.length])

  const filteredPortfolioSeries = useMemo(() => {
    if (!portfolioSeries.length) {
      return []
    }

    const [start, end] = safePortfolioDateRange
    return portfolioSeries.slice(start, end + 1)
  }, [portfolioSeries, safePortfolioDateRange])

  const filteredPortfolioRangeLabels = useMemo(() => {
    if (!filteredPortfolioSeries.length) {
      return { start: "-", end: "-" }
    }

    return {
      start: filteredPortfolioSeries[0].mesLabel,
      end: filteredPortfolioSeries[filteredPortfolioSeries.length - 1].mesLabel,
    }
  }, [filteredPortfolioSeries])

  const marketChartData = useMemo(
    () => marketSeries.map((point) => ({ ...point, dateLabel: formatDateLabel(point.date) })),
    [marketSeries]
  )

  const safeMarketDateRange = useMemo<[number, number]>(() => {
    const maxIndex = Math.max(0, marketChartData.length - 1)

    if (marketChartData.length <= 1) {
      return [0, 0]
    }

    if (marketDateRange[0] === 0 && marketDateRange[1] === 0) {
      return [0, maxIndex]
    }

    const start = Math.min(Math.max(0, marketDateRange[0]), maxIndex)
    const end = Math.min(Math.max(start, marketDateRange[1]), maxIndex)

    return [start, end]
  }, [marketChartData.length, marketDateRange])

  const filteredMarketChartData = useMemo(() => {
    if (!marketChartData.length) {
      return []
    }

    const [start, end] = safeMarketDateRange
    return marketChartData.slice(start, end + 1)
  }, [marketChartData, safeMarketDateRange])

  const filteredMarketRangeLabels = useMemo(() => {
    if (!filteredMarketChartData.length) {
      return { start: "-", end: "-" }
    }

    return {
      start: formatDateShort(filteredMarketChartData[0].date),
      end: formatDateShort(filteredMarketChartData[filteredMarketChartData.length - 1].date),
    }
  }, [filteredMarketChartData])

  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Analise por ativo</h2>
          <p className="text-sm text-slate-500">
            Compare a evolucao da posicao do ativo na carteira com o preco de mercado dos ultimos 2 anos.
          </p>
        </div>

        {isAuthorizedForAnalytics ? (
          <label className="inline-flex items-center gap-2 text-sm text-slate-600">
            Ativo
            <select
              value={selectedTicker}
              onChange={(event) => setSelectedTicker(event.target.value)}
              disabled={isLoadingTickers || !tickers.length}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700"
            >
              {!tickers.length ? <option value="">Sem ativos</option> : null}
              {tickers.map((ticker) => (
                <option key={ticker} value={ticker}>
                  {ticker}
                </option>
              ))}
            </select>
          </label>
        ) : null}
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

      {tickersError ? (
        <Card className="rounded-2xl border-rose-200 bg-rose-50 shadow-none">
          <CardHeader>
            <CardTitle className="text-base text-rose-700">Falha ao carregar lista de ativos</CardTitle>
            <CardDescription className="text-rose-600">{tickersError}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-2xl border-slate-200 shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Evolucao do ativo na carteira</CardTitle>
            <CardDescription>Posicao em R$ do ativo selecionado ao longo do tempo.</CardDescription>
          </CardHeader>
          <CardContent>
            {filteredPortfolioSeries.length > 1 && !isLoadingPortfolio ? (
              <div className="mb-4">
                <DateRangeSlider
                  min={0}
                  max={portfolioSeries.length - 1}
                  value={safePortfolioDateRange}
                  startLabel={filteredPortfolioRangeLabels.start}
                  endLabel={filteredPortfolioRangeLabels.end}
                  onValueChange={setPortfolioDateRange}
                />
              </div>
            ) : null}
            {portfolioError ? <p className="text-sm text-rose-600">{portfolioError}</p> : null}
            {isLoadingPortfolio ? (
              <div className="h-72 animate-pulse rounded-xl bg-slate-100" />
            ) : filteredPortfolioSeries.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={filteredPortfolioSeries} margin={{ top: 12, right: 12, bottom: 0, left: 4 }}>
                  <defs>
                    <linearGradient id="assetPortfolioGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2d64d8" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#2d64d8" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#e7edf6" strokeDasharray="4 4" />
                  <XAxis dataKey="mesLabel" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#64748b" }} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: "#64748b" }}
                    tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip content={<MoneyTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="positionBrl"
                    name="Posicao"
                    stroke="#2d64d8"
                    strokeWidth={2.5}
                    fill="url(#assetPortfolioGradient)"
                    dot={false}
                    activeDot={{ r: 5, fill: "#2d64d8" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-72 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-500">
                Sem dados para o ativo selecionado.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Mercado do ativo (2 anos)</CardTitle>
            <CardDescription>Serie historica de fechamento para o ativo selecionado.</CardDescription>
          </CardHeader>
          <CardContent>
            {filteredMarketChartData.length > 1 && !isLoadingMarket ? (
              <div className="mb-4">
                <DateRangeSlider
                  min={0}
                  max={marketChartData.length - 1}
                  value={safeMarketDateRange}
                  startLabel={filteredMarketRangeLabels.start}
                  endLabel={filteredMarketRangeLabels.end}
                  onValueChange={setMarketDateRange}
                />
              </div>
            ) : null}
            {marketError ? <p className="text-sm text-rose-600">{marketError}</p> : null}
            {isLoadingMarket ? (
              <div className="h-72 animate-pulse rounded-xl bg-slate-100" />
            ) : filteredMarketChartData.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={filteredMarketChartData} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke="#e7edf6" strokeDasharray="4 4" />
                  <XAxis
                    dataKey="dateLabel"
                    tickLine={false}
                    axisLine={false}
                    minTickGap={24}
                    tick={{ fontSize: 12, fill: "#64748b" }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: "#64748b" }}
                    tickFormatter={(value) => `R$ ${Number(value).toFixed(0)}`}
                  />
                  <Tooltip content={<MoneyTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="close"
                    name="Preco"
                    stroke="#1f4db4"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5, fill: "#1f4db4" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-72 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-500">
                Sem historico de mercado disponivel para o ativo selecionado.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
