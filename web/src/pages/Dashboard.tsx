import { useMemo, useState } from "react"
import { RefreshCw } from "lucide-react"
import {
  AllocationDonutChart,
  PatrimonioChart,
  RentabilidadeChart,
  RetornoAcumuladoChart,
} from "@/components/charts/financial-charts"
import { DateRangeSlider } from "@/components/shared/date-range-slider"
import { StatusPill } from "@/components/shared/status-pill"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { canViewAnalyticsData } from "@/config/access"
import { useAnalyticsData } from "@/hooks/use-analytics-data"
import { useAuth } from "@/hooks/use-auth"
import { useSync } from "@/hooks/use-sync"

function formatDate(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
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

function KpiCard({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <Card className="rounded-2xl border-slate-200 shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-500">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
        <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const isAuthorizedForAnalytics = canViewAnalyticsData(user?.email)
  const [dateRange, setDateRange] = useState<[number, number]>([0, 0])

  const { lastRun, isLoading, isSyncing, error, runSync, refresh } = useSync()
  const {
    portfolio,
    allocation,
    metrics,
    isLoading: isAnalyticsLoading,
    error: analyticsError,
  } = useAnalyticsData(isAuthorizedForAnalytics)

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

  const filteredPortfolio = useMemo(() => {
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

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <Card className="rounded-2xl border-slate-200 bg-slate-50/60 shadow-none">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base text-slate-900">Ultima sincronizacao</CardTitle>
              <CardDescription>Status da pipeline Sheets para Supabase</CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={isLoading || isSyncing}>
                Atualizar status
              </Button>
              <Button size="sm" className="gap-2" onClick={() => void runSync()} disabled={isSyncing}>
                <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />
                Sync now
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <p className="text-sm text-slate-500">Carregando status...</p>
            ) : lastRun ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-xs text-slate-500">Status</p>
                  <div className="mt-1">
                    <StatusPill status={lastRun.status} />
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-xs text-slate-500">Inicio</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{formatDate(lastRun.started_at)}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-xs text-slate-500">Linhas escritas</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{lastRun.rows_written ?? "-"}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-xs text-slate-500">Trigger</p>
                  <p className="mt-1 text-sm font-medium capitalize text-slate-900">{lastRun.trigger}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Nenhuma sincronizacao encontrada.</p>
            )}

            {error ? (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Roadmap imediato</CardTitle>
            <CardDescription>Comparativo com IBOV e CDI entra na proxima etapa.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600">
            <p>- Graficos temporais interativos com tooltip</p>
            <p>- Distribuicao da carteira no mes mais recente</p>
            <p>- Controle de acesso por email autorizado</p>
          </CardContent>
        </Card>
      </section>

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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Patrimonio total"
          value={isAuthorizedForAnalytics ? formatMoney(metrics.currentPatrimonio) : "Restrito"}
          subtitle="Carteira consolidada"
        />
        <KpiCard
          title="Rentabilidade mes"
          value={isAuthorizedForAnalytics ? formatPercent(metrics.currentRentabilidade) : "Restrito"}
          subtitle="Base: acao Patrimonio"
        />
        <KpiCard
          title="Retorno acumulado"
          value={isAuthorizedForAnalytics ? formatPercent(metrics.currentRetornoAcumulado) : "Restrito"}
          subtitle="Acumulado multiplicativo"
        />
        <KpiCard
          title="Comparativo mercado"
          value="Em breve"
          subtitle="Carteira vs IBOV vs CDI"
        />
      </section>

      {isAuthorizedForAnalytics && portfolio.length > 1 && !isAnalyticsLoading ? (
        <DateRangeSlider
          min={0}
          max={portfolio.length - 1}
          value={safeDateRange}
          startLabel={filteredRangeLabels.start}
          endLabel={filteredRangeLabels.end}
          onValueChange={setDateRange}
        />
      ) : null}

      {isAuthorizedForAnalytics ? (
        <>
          {analyticsError ? (
            <Card className="rounded-2xl border-rose-200 bg-rose-50 shadow-none">
              <CardHeader>
                <CardTitle className="text-base text-rose-700">Falha ao carregar dados do dashboard</CardTitle>
                <CardDescription className="text-rose-600">{analyticsError}</CardDescription>
              </CardHeader>
            </Card>
          ) : null}

          {isAnalyticsLoading ? (
            <Card className="rounded-2xl border-slate-200 shadow-none">
              <CardHeader>
                <CardTitle className="text-base">Carregando graficos...</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
              </CardContent>
            </Card>
          ) : (
            <>
              <section className="grid gap-4 xl:grid-cols-2">
                <Card className="rounded-2xl border-slate-200 shadow-none">
                  <CardHeader>
                    <CardTitle className="text-base">Evolucao do patrimonio</CardTitle>
                    <CardDescription>
                      Passe o cursor para ver os valores mensais detalhados.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <PatrimonioChart data={filteredPortfolio} />
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border-slate-200 shadow-none">
                  <CardHeader>
                    <CardTitle className="text-base">Rentabilidade mensal</CardTitle>
                    <CardDescription>
                      Visual interativo no estilo de analytics com barras arredondadas.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <RentabilidadeChart data={filteredPortfolio} />
                  </CardContent>
                </Card>
              </section>

              <section className="grid gap-4 xl:grid-cols-2">
                <Card className="rounded-2xl border-slate-200 shadow-none">
                  <CardHeader>
                    <CardTitle className="text-base">Retorno acumulado</CardTitle>
                    <CardDescription>
                      Curva de performance acumulada ao longo do tempo.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <RetornoAcumuladoChart data={filteredPortfolio} />
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border-slate-200 shadow-none">
                  <CardHeader>
                    <CardTitle className="text-base">Distribuicao da carteira</CardTitle>
                    <CardDescription>
                      Alocacao percentual por ativo no mes mais recente.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <AllocationDonutChart data={allocation} />
                  </CardContent>
                </Card>
              </section>
            </>
          )}
        </>
      ) : null}
    </div>
  )
}
