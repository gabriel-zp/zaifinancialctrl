export interface PortfolioRow {
  mes: string
  patrimonio: number
  rentabilidadeMes: number
}

export interface PortfolioPoint extends PortfolioRow {
  mesLabel: string
  retornoAcumulado: number
}

export interface AllocationPoint {
  acao: string
  valor: number
  percentual: number
}

export interface PortfolioMetrics {
  currentPatrimonio: number
  currentRentabilidade: number
  currentRetornoAcumulado: number
}
