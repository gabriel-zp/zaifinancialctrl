type RequiredEnvVar = "VITE_SUPABASE_URL"

function getEnvVar(name: RequiredEnvVar): string {
  const value = import.meta.env[name]
  if (!value) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}

export const env = {
  supabaseUrl: getEnvVar("VITE_SUPABASE_URL"),
  supabaseKey:
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
    (() => {
      throw new Error(
        "Missing Supabase key. Set VITE_SUPABASE_PUBLISHABLE_KEY (preferred) or VITE_SUPABASE_ANON_KEY (legacy)."
      )
    })(),
  syncAdminSecret: import.meta.env.VITE_SYNC_ADMIN_SECRET as string | undefined,
}
