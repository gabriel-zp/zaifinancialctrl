import { useMemo, useState } from "react"
import { Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { parseBrokeragePdf } from "@/services/functions-service"
import type { BrokerageFormulaRow } from "@/types/functions"

function formatSignedShares(value: number): string {
  if (value > 0) {
    return `+${value}`
  }
  return `${value}`
}

export default function FunctionsPage() {
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [rows, setRows] = useState<BrokerageFormulaRow[]>([])
  const [totalLiquidoNota, setTotalLiquidoNota] = useState<string>("-")

  const hasRows = rows.length > 0

  const exportText = useMemo(() => {
    if (!rows.length) {
      return ""
    }

    const header = [
      "Ticker",
      "Ações Compradas",
      "Ações Vendidas",
      "Resumo de Ações",
      "Fórmula Total Compra",
      "Fórmula Total Venda",
      "Data",
    ].join("\t")

    const body = rows
      .map((row) => [
        row.ticker,
        row.acoesCompradas,
        row.acoesVendidas,
        row.resumoAcoes,
        row.formulaTotalCompra,
        row.formulaTotalVenda,
        row.data,
      ].join("\t"))
      .join("\n")

    return `${header}\n${body}`
  }, [rows])

  async function handleFile(file: File) {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Envie um arquivo PDF valido.")
      return
    }

    setError(null)
    setIsProcessing(true)
    setFileName(file.name)

    try {
      const parsed = await parseBrokeragePdf(file)
      setRows(parsed.rows)
      setTotalLiquidoNota(parsed.totalLiquidoNota)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao processar nota"
      setError(message)
      setRows([])
      setTotalLiquidoNota("-")
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-semibold text-slate-900">Functions</h2>
        <p className="text-sm text-slate-500">
          Arraste uma nota de corretagem em PDF para gerar formulas de Excel por ativo.
        </p>
      </header>

      <Card className="rounded-2xl border-slate-200 shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Upload da nota de corretagem</CardTitle>
          <CardDescription>Output em tabela para copia direta no Excel.</CardDescription>
        </CardHeader>
        <CardContent>
          <label
            className={`flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
              isDragging ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-slate-50"
            }`}
            onDragOver={(event) => {
              event.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault()
              setIsDragging(false)
              const droppedFile = event.dataTransfer.files?.[0]
              if (droppedFile) {
                void handleFile(droppedFile)
              }
            }}
          >
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(event) => {
                const selectedFile = event.target.files?.[0]
                if (selectedFile) {
                  void handleFile(selectedFile)
                }
              }}
            />
            <Upload className="mb-2 h-6 w-6 text-slate-500" />
            <p className="text-sm font-medium text-slate-700">Arraste o PDF aqui ou clique para selecionar</p>
            <p className="mt-1 text-xs text-slate-500">Arquivos suportados: .pdf</p>
          </label>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
              Arquivo: <span className="font-medium text-slate-800">{fileName ?? "-"}</span>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
              Total Liquido da Nota: <span className="font-medium text-slate-800">{totalLiquidoNota}</span>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!hasRows}
              onClick={async () => {
                if (!exportText) {
                  return
                }
                await navigator.clipboard.writeText(exportText)
              }}
            >
              Copiar tabela (TSV)
            </Button>
          </div>

          {isProcessing ? <p className="mt-3 text-sm text-slate-600">Processando PDF...</p> : null}
          {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-slate-200 shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Resultado</CardTitle>
          <CardDescription>Tabela com formulas por ticker extraidas da nota.</CardDescription>
        </CardHeader>
        <CardContent>
          {!hasRows ? (
            <p className="text-sm text-slate-500">Nenhum resultado ainda. Envie um PDF para iniciar.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-2 py-2 text-left font-medium">Ticker</th>
                    <th className="px-2 py-2 text-right font-medium">Acoes Compradas</th>
                    <th className="px-2 py-2 text-right font-medium">Acoes Vendidas</th>
                    <th className="px-2 py-2 text-right font-medium">Resumo de Acoes</th>
                    <th className="px-2 py-2 text-left font-medium">Formula Total Compra</th>
                    <th className="px-2 py-2 text-left font-medium">Formula Total Venda</th>
                    <th className="px-2 py-2 text-right font-medium">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.ticker} className="border-b border-slate-100 last:border-b-0">
                      <td className="px-2 py-2 font-medium text-slate-800">{row.ticker}</td>
                      <td className="px-2 py-2 text-right text-slate-700">{row.acoesCompradas}</td>
                      <td className="px-2 py-2 text-right text-slate-700">{row.acoesVendidas}</td>
                      <td className="px-2 py-2 text-right text-slate-700">{formatSignedShares(row.resumoAcoes)}</td>
                      <td className="px-2 py-2 text-slate-700">{row.formulaTotalCompra}</td>
                      <td className="px-2 py-2 text-slate-700">{row.formulaTotalVenda}</td>
                      <td className="px-2 py-2 text-right text-slate-700">{row.data}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
