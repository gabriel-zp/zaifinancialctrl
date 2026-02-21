import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, RefreshCw } from 'lucide-react'

interface SyncRun {
  id: string
  started_at: string
  finished_at: string | null
  status: string
  trigger: string
  rows_written: number | null
  message: string | null
}

export default function DashboardPage() {
  const { user, signOut } = useAuth()
  const [lastSync, setLastSync] = useState<SyncRun | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  const fetchLastSync = async () => {
    const { data } = await supabase
      .from('sync_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(1)
      .single()
    
    if (data) {
      setLastSync(data as SyncRun)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchLastSync()
  }, [])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-rentabilidade`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(session 
              ? { 'Authorization': `Bearer ${session.access_token}` }
              : { 'x-admin-secret': import.meta.env.VITE_SYNC_ADMIN_SECRET || '' }
            ),
            'x-trigger': 'manual',
          },
        }
      )

      if (!response.ok) {
        throw new Error('Sync failed')
      }

      await fetchLastSync()
    } catch (error) {
      console.error('Sync error:', error)
    } finally {
      setSyncing(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-500'
      case 'error': return 'bg-red-500'
      case 'running': return 'bg-blue-500'
      case 'skipped': return 'bg-yellow-500'
      default: return 'bg-gray-500'
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-bold text-gray-900">ZAI Financial</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">{user?.email}</span>
              <Button variant="outline" size="sm" onClick={() => signOut()}>
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Última Sincronização</CardTitle>
              <Button 
                size="sm" 
                onClick={handleSync} 
                disabled={syncing}
                className="gap-2"
              >
                {syncing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Sync Now
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center gap-2 text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando...
                </div>
              ) : lastSync ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${getStatusColor(lastSync.status)}`} />
                    <span className="text-2xl font-bold capitalize">{lastSync.status}</span>
                  </div>
                  <p className="text-sm text-gray-500">
                    {formatDate(lastSync.started_at)}
                  </p>
                  {lastSync.rows_written && (
                    <p className="text-sm text-gray-500">
                      {lastSync.rows_written} rows written
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-gray-500">Nenhuma sincronização encontrada</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Patrimônio Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R$ --</div>
              <p className="text-xs text-gray-500">Em breve</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Rentabilidade</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">--%</div>
              <p className="text-xs text-gray-500">Em breve</p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Gráficos em breve</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500">
                Os gráficos de evolução do patrimônio, rentabilidade e retorno acumulado 
                serão implementados nas próximas etapas.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
