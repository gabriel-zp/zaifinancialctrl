import { useCallback, useEffect, useState } from "react"
import { getLastSyncRun, triggerManualSync } from "@/services/sync-service"
import type { SyncRun } from "@/types/sync"

export function useSync() {
  const [lastRun, setLastRun] = useState<SyncRun | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setError(null)
    setIsLoading(true)
    try {
      const data = await getLastSyncRun()
      setLastRun(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load sync status"
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const runSync = useCallback(async () => {
    setError(null)
    setIsSyncing(true)
    try {
      await triggerManualSync()
      await refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to trigger sync"
      setError(message)
    } finally {
      setIsSyncing(false)
    }
  }, [refresh])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    lastRun,
    isLoading,
    isSyncing,
    error,
    refresh,
    runSync,
  }
}
