export interface AssetOption {
  ticker: string
}

export interface PortfolioAssetPoint {
  mes: string
  mesLabel: string
  positionBrl: number
}

export interface MarketHistoryPoint {
  date: string
  close: number
}

export interface MarketHistoryResponse {
  ok: boolean
  source: string
  symbol: string
  currency: string
  points: MarketHistoryPoint[]
  cached: boolean
  cachedAt: string | null
}
