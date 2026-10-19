import { existsSync, readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import type { Plugin } from 'vite'
import { handleEmail } from '../worker/index.mjs'

// Reuse the production handler in Vite so local email needs no second server.
export function wrappedEmailDev(): Plugin {
  return {
    name: 'wrapped-email-dev',
    apply: 'serve',
    configureServer(server) {
      const varsPath = new URL('../.dev.vars', import.meta.url)
      const vars = existsSync(varsPath) ? parseEnv(readFileSync(varsPath, 'utf8')) : {}
      const windows = new Map<string, { count: number; reset: number }>()
      const env = {
        RESEND_API_KEY: process.env.RESEND_API_KEY || vars.RESEND_API_KEY,
        WRAPPED_EMAIL_FROM: process.env.WRAPPED_EMAIL_FROM || vars.WRAPPED_EMAIL_FROM,
        WRAPPED_EMAIL_LIMITER: {
          async limit({ key }: { key: string }) {
            const now = Date.now()
            for (const [name, entry] of windows) if (entry.reset <= now) windows.delete(name)
            const entry = windows.get(key) ?? { count: 0, reset: now + 60_000 }
            entry.count++
            windows.set(key, entry)
            return { success: entry.count <= 2 }
          },
        },
      }
      server.middlewares.use('/api/wrapped/email', async (req, res) => {
        try {
          const chunks: Buffer[] = []
          let size = 0
          for await (const chunk of req) {
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
            size += buffer.length
            if (size > 24_000_000) {
              res.writeHead(413, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'Images are too large to email. Download the ZIP instead.' }))
              return
            }
            chunks.push(buffer)
          }
          const headers = new Headers()
          for (const [name, value] of Object.entries(req.headers)) {
            if (value) headers.set(name, Array.isArray(value) ? value.join(', ') : value)
          }
          headers.set('CF-Connecting-IP', req.socket.remoteAddress ?? 'local')
          const protocol = server.config.server.https ? 'https' : 'http'
          const method = req.method ?? 'GET'
          const request = new Request(`${protocol}://${req.headers.host}/api/wrapped/email`, {
            method, headers, ...(method !== 'GET' && method !== 'HEAD' ? { body: new Uint8Array(Buffer.concat(chunks)) } : {}),
          })
          const response = await handleEmail(request, env)
          res.writeHead(response.status, Object.fromEntries(response.headers))
          res.end(await response.text())
        } catch {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Local email could not be sent. Check the server configuration and try again.' }))
        }
      })
    },
  }
}
