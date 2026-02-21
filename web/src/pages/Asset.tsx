import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function AssetPage() {
  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-xl font-semibold text-slate-900">Analise por ativo</h2>
        <p className="text-sm text-slate-500">
          Base pronta para o comparativo entre evolucao na carteira e mercado (ultimos 2 anos).
        </p>
      </header>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-2xl border-slate-200 shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Evolucao do ativo na carteira</CardTitle>
            <CardDescription>
              Plot de valor_final_mes para o ativo selecionado ao longo do tempo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72 rounded-xl border border-dashed border-slate-200 bg-slate-50/70" />
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Mercado do ativo (2 anos)</CardTitle>
            <CardDescription>
              Serie de preco com provider externo (Google Finance ou equivalente).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72 rounded-xl border border-dashed border-slate-200 bg-slate-50/70" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
