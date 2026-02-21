export function LoadingScreen({ label = "Carregando" }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-app">
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-r-transparent" />
        <span className="text-sm text-slate-600">{label}...</span>
      </div>
    </div>
  )
}
