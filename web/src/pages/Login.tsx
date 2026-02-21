import { useState, type FormEvent } from "react"
import { Navigate } from "react-router-dom"
import { Chrome, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/hooks/use-auth"

type Mode = "signin" | "signup"

export default function LoginPage() {
  const { user, signIn, signUp, signInWithGoogle } = useAuth()
  const [mode, setMode] = useState<Mode>("signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)

    if (mode === "signup" && password !== confirmPassword) {
      setError("As senhas nao conferem.")
      return
    }

    setLoading(true)

    const sanitizedEmail = email.trim().toLowerCase()

    try {
      if (mode === "signup") {
        const response = await signUp(sanitizedEmail, password)
        if (response.error) {
          setError(response.error.message)
          return
        }

        if (response.session) {
          setMessage("Conta criada com sucesso. Voce ja esta autenticado.")
        } else {
          setMessage("Conta criada. Verifique seu email para confirmar o acesso.")
        }
      } else {
        const response = await signIn(sanitizedEmail, password)
        if (response.error) {
          setError(response.error.message)
          return
        }
      }
    } catch {
      setError("Nao foi possivel concluir a autenticacao agora. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  async function onGoogleSignIn() {
    setError(null)
    setMessage(null)
    setGoogleLoading(true)

    try {
      const response = await signInWithGoogle()
      if (response.error) {
        setError(response.error.message)
      }
    } catch {
      setError("Nao foi possivel iniciar login com Google agora.")
    } finally {
      setGoogleLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-app p-4 lg:p-6">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] w-full max-w-6xl gap-4 lg:grid-cols-[1.15fr_0.85fr] lg:gap-6">
        <section className="hidden rounded-2xl border border-slate-200 bg-white p-8 shadow-sm lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="mb-8 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
                <Wallet size={18} />
              </div>
              <div>
                <p className="text-base font-semibold text-slate-900">ZAI Financial</p>
                <p className="text-sm text-slate-500">Portfolio control center</p>
              </div>
            </div>

            <h1 className="max-w-xl text-3xl font-semibold leading-tight text-slate-900">
              Sua carteira em um painel claro, moderno e orientado a performance.
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-slate-600">
              Autentique-se para acompanhar sincronizacao com Google Sheets, evolucao do patrimonio,
              rentabilidade e comparativos com benchmarks.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {["Sync confiavel", "Graficos interativos", "Comparativo com mercado"].map((item) => (
              <div key={item} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-medium text-slate-600">
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-center">
          <Card className="w-full max-w-md rounded-2xl border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-2xl font-semibold text-slate-900">
                {mode === "signin" ? "Acessar conta" : "Criar conta"}
              </CardTitle>
              <CardDescription>
                {mode === "signin"
                  ? "Entre com email e senha para acessar o dashboard."
                  : "Crie sua conta para iniciar o acompanhamento da carteira."}
              </CardDescription>
            </CardHeader>

            <form onSubmit={onSubmit}>
              <CardContent className="space-y-4">
                {error ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>
                ) : null}
                {message ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                    {message}
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="voce@exemplo.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    minLength={6}
                    required
                  />
                </div>

                {mode === "signup" ? (
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirmar senha</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      minLength={6}
                      required
                    />
                  </div>
                ) : null}
              </CardContent>

              <CardFooter className="flex flex-col gap-3">
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading
                    ? "Processando..."
                    : mode === "signin"
                      ? "Entrar"
                      : "Criar conta"}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => void onGoogleSignIn()}
                  disabled={googleLoading || loading}
                >
                  <Chrome size={16} className="mr-2" />
                  {googleLoading ? "Conectando com Google..." : "Continuar com Google"}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-slate-600"
                  onClick={() => {
                    setMode(mode === "signin" ? "signup" : "signin")
                    setError(null)
                    setMessage(null)
                    setConfirmPassword("")
                  }}
                >
                  {mode === "signin" ? "Nao possui conta? Criar agora" : "Ja possui conta? Entrar"}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </section>
      </div>
    </div>
  )
}
