import { Slider } from "@/components/ui/slider"

interface DateRangeSliderProps {
  min: number
  max: number
  value: [number, number]
  startLabel: string
  endLabel: string
  onValueChange: (value: [number, number]) => void
}

export function DateRangeSlider({
  min,
  max,
  value,
  startLabel,
  endLabel,
  onValueChange,
}: DateRangeSliderProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-slate-700">Periodo dos graficos</p>
        <p className="text-xs text-slate-500">Estilo Power BI</p>
      </div>

      <Slider
        min={min}
        max={max}
        step={1}
        value={value}
        minStepsBetweenThumbs={1}
        onValueChange={(newValue) => onValueChange([newValue[0], newValue[1]])}
        className="py-2"
      />

      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
        <span>Inicio: {startLabel}</span>
        <span>Fim: {endLabel}</span>
      </div>
    </div>
  )
}
