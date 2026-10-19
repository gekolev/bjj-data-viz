export function handleEmail(request: Request, env: {
  RESEND_API_KEY?: string
  WRAPPED_EMAIL_FROM?: string
  WRAPPED_EMAIL_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> }
}, send?: typeof fetch): Promise<Response>
