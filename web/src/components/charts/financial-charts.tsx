import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { AllocationPoint, PortfolioPoint } from "@/types/analytics"

const COLORS = ["#2d64d8", "#5d89e6", "#86a8ee", "#aac1f5", "#c8d8fa", "#dce7fc"]

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value)
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value?: number; name?: string }>; label?: string }) {
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
            {typeof entry.value === "number" ? formatCurrency(entry.value) : "-"}
          </p>
        ))}
      </div>
    </div>
  )
}

function PercentTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value?: number; name?: string }>; label?: string }) {
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
            {typeof entry.value === "number" ? formatPercent(entry.value) : "-"}
          </p>
        ))}
      </div>
    </div>
  )
}

function PieTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: AllocationPoint }> }) {
  const item = payload?.[0]?.payload

  if (!active || !item) {
    return null
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-md">
      <p className="text-xs font-semibold text-slate-800">{item.acao}</p>
      <p className="text-xs text-slate-600">{formatCurrency(item.valor)}</p>
      <p className="text-xs text-slate-600">{formatPercent(item.percentual)}</p>
    </div>
  )
}

export function PatrimonioChart({ data }: { data: PortfolioPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <AreaChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: 4 }}>
        <defs>
          <linearGradient id="patrimonioGradient" x1="0" y1="0" x2="0" y2="1">
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
          tickFormatter={(value) => `R$ ${(value / 1000000).toFixed(1)}M`}
        />
        <Tooltip content={<ChartTooltip />} />
        <Area
          type="monotone"
          dataKey="patrimonio"
          name="Patrimonio"
          stroke="#2d64d8"
          strokeWidth={2.5}
          fill="url(#patrimonioGradient)"
          dot={{ r: 0 }}
          activeDot={{ r: 5, fill: "#2d64d8" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function RentabilidadeChart({ data }: { data: PortfolioPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="#e7edf6" strokeDasharray="4 4" />
        <XAxis dataKey="mesLabel" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#64748b" }} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12, fill: "#64748b" }}
          tickFormatter={(value) => `${(value * 100).toFixed(1)}%`}
        />
        <Tooltip content={<PercentTooltip />} />
        <Bar dataKey="rentabilidadeMes" name="Rentabilidade" radius={[8, 8, 0, 0]} fill="#2d64d8" />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function RetornoAcumuladoChart({ data }: { data: PortfolioPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="#e7edf6" strokeDasharray="4 4" />
        <XAxis dataKey="mesLabel" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#64748b" }} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12, fill: "#64748b" }}
          tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
        />
        <Tooltip content={<PercentTooltip />} />
        <Line
          type="monotone"
          dataKey="retornoAcumulado"
          name="Retorno acumulado"
          stroke="#1f4db4"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 5, fill: "#1f4db4" }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function AllocationDonutChart({ data }: { data: AllocationPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <PieChart>
        <Pie
          data={data}
          dataKey="percentual"
          nameKey="acao"
          cx="50%"
          cy="46%"
          innerRadius={72}
          outerRadius={110}
          paddingAngle={2}
        >
          {data.map((entry, index) => (
            <Cell key={`${entry.acao}-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<PieTooltip />} />
        <Legend
          verticalAlign="bottom"
          align="center"
          iconType="circle"
          iconSize={8}
          formatter={(value) => <span className="text-xs text-slate-600">{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
