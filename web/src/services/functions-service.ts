import { env } from "@/config/env"
import { supabase } from "@/lib/supabase"
import type { ParseBrokerageNoteResponse } from "@/types/functions"

export async function parseBrokeragePdf(file: File): Promise<ParseBrokerageNoteResponse> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const formData = new FormData()
  formData.append("file", file)

  const response = await fetch(`${env.supabaseUrl}/functions/v1/parse-brokerage-note`, {
    method: "POST",
    headers: {
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: formData,
  })

  const payload = (await response.json().catch(() => null)) as
    | ParseBrokerageNoteResponse
    | { message?: string }
    | null

  if (!response.ok) {
    const message = payload && "message" in payload && payload.message
      ? payload.message
      : `Falha ao processar nota (${response.status})`
    throw new Error(message)
  }

  if (!payload || !("ok" in payload) || !("rows" in payload) || !("totalLiquidoNota" in payload)) {
    throw new Error("Resposta invalida da funcao")
  }

  return payload
}
