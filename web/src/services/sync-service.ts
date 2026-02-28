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
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const response = await fetch(`${env.supabaseUrl}/functions/v1/sync-rentabilidade`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-trigger": "manual",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...(env.syncAdminSecret ? { "x-admin-secret": env.syncAdminSecret } : {}),
    },
    body: JSON.stringify({}),
  })

  const payload = (await response.json().catch(() => null)) as SyncFunctionResponse | { message?: string } | null

  if (!response.ok) {
    const message = payload && "message" in payload && payload.message
      ? payload.message
      : `Sync failed with status ${response.status}`
    throw new Error(message)
  }

  if (!payload || !("ok" in payload)) {
    throw new Error("Sync function returned no payload")
  }

  return payload as SyncFunctionResponse
}
