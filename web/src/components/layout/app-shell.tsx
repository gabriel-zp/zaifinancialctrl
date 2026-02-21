import type { ReactNode } from "react"
import { NavLink } from "react-router-dom"
import { LayoutDashboard, LineChart, LogOut, Search, Wallet } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/ativo", label: "Ativo", icon: LineChart },
]

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-app">
      <div className="mx-auto flex w-full max-w-[1500px] gap-4 p-4 lg:p-6">
        <aside className="hidden w-64 shrink-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:block">
          <div className="mb-8 flex items-center gap-2 px-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white">
              <Wallet size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">ZAI Financial</p>
              <p className="text-xs text-slate-500">Portfolio Intelligence</p>
            </div>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-blue-50 text-blue-700"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    )
                  }
                >
                  <Icon size={16} />
                  {item.label}
                </NavLink>
              )
            })}
          </nav>

          <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-900">Conta</p>
            <p className="mt-1 truncate text-xs text-slate-500">{user?.email}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full justify-start"
              onClick={() => void signOut()}
            >
              <LogOut size={14} className="mr-2" />
              Sair
            </Button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <header className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm lg:px-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-base font-semibold text-slate-900 lg:text-lg">Portfolio Dashboard</h1>
                <p className="text-xs text-slate-500 lg:text-sm">Visao geral da sua carteira e sincronizacao</p>
              </div>

              <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-500 md:flex">
                <Search size={14} />
                <span className="text-xs">Pesquisa global (em breve)</span>
              </div>
            </div>
          </header>

          <main className="min-h-[calc(100vh-8rem)] rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
