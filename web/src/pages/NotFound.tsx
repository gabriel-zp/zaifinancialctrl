import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-app p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold text-blue-600">Erro 404</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Pagina nao encontrada</h1>
        <p className="mt-2 text-sm text-slate-500">
          O endereco que voce tentou acessar nao existe ou foi movido.
        </p>
        <Button className="mt-6" asChild>
          <Link to="/dashboard">Voltar ao dashboard</Link>
        </Button>
      </div>
    </div>
  )
}
