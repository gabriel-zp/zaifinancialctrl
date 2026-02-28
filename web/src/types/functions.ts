export interface BrokerageFormulaRow {
  ticker: string
  acoesCompradas: number
  acoesVendidas: number
  resumoAcoes: number
  formulaTotalCompra: string
  formulaTotalVenda: string
  data: string
}

export interface ParseBrokerageNoteResponse {
  ok: boolean
  rows: BrokerageFormulaRow[]
  totalLiquidoNota: string
}
