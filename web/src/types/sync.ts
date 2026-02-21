export type SyncRunStatus = "running" | "success" | "error" | "skipped"

export type SyncRunTrigger = "manual" | "cron"

export interface SyncRun {
  id: string
  started_at: string
  finished_at: string | null
  status: SyncRunStatus
  trigger: SyncRunTrigger
  message: string | null
  rows_written: number | null
  source_hash: string | null
}

export interface SyncFunctionResponse {
  ok: boolean
  status: SyncRunStatus
  run_id: string
  months_published?: number
  rows_written?: number
  message?: string
}
