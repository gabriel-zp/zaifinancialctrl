import type { SyncRunStatus } from "@/types/sync"
import { cn } from "@/lib/utils"

const statusStyles: Record<SyncRunStatus, string> = {
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  error: "bg-rose-50 text-rose-700 border-rose-200",
  running: "bg-blue-50 text-blue-700 border-blue-200",
  skipped: "bg-amber-50 text-amber-700 border-amber-200",
}

export function StatusPill({ status }: { status: SyncRunStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold capitalize",
        statusStyles[status]
      )}
    >
      {status}
    </span>
  )
}
