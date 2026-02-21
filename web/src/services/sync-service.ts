import { env } from "@/config/env"
import { supabase } from "@/lib/supabase"
import type { SyncFunctionResponse, SyncRun } from "@/types/sync"

export async function getLastSyncRun(): Promise<SyncRun | null> {
  const { data, error } = await supabase
    .from("sync_runs")
    .select("id, started_at, finished_at, status, trigger, message, rows_written, source_hash")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function triggerManualSync(): Promise<SyncFunctionResponse> {
  const { data, error } = await supabase.functions.invoke<SyncFunctionResponse>(
    "sync-rentabilidade",
    {
      body: {},
      headers: {
        "x-trigger": "manual",
        ...(env.syncAdminSecret ? { "x-admin-secret": env.syncAdminSecret } : {}),
      },
    }
  )

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    throw new Error("Sync function returned no payload")
  }

  return data
}
