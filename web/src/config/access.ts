const AUTHORIZED_ANALYTICS_EMAILS = [
  "gzimmermannp@gmail.com",
  "nassermelo@gmail.com",
  "gabizpiccinini@gmail.com",
] as const

export function canViewAnalyticsData(email: string | null | undefined): boolean {
  if (!email) {
    return false
  }

  const normalized = email.trim().toLowerCase()
  return AUTHORIZED_ANALYTICS_EMAILS.includes(normalized as (typeof AUTHORIZED_ANALYTICS_EMAILS)[number])
}
