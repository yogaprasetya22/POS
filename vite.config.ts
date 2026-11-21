import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { loadEnv, type Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

const src = (p: string) => fileURLToPath(new URL(`./src/${p}`, import.meta.url))

/** Menjalankan api/*.js di `vite dev` dengan bentuk req/res yang sama seperti fungsi serverless Vercel. */
function devApi(): Plugin {
  return {
    name: 'dev-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '', 'http://localhost')
        const m = url.pathname.match(/^\/api\/([\w-]+)$/)
        if (!m) return next()
        // Muat ulang env terkini dari .env setiap ada panggilan API lokal
        Object.assign(process.env, loadEnv('development', process.cwd(), ''))
        const chunks: Buffer[] = []
        for await (const c of req) chunks.push(c as Buffer)
        const raw = Buffer.concat(chunks).toString()
        const shim = Object.assign(res, {
          status(code: number) { res.statusCode = code; return shim },
          json(body: unknown) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)) },
        })
        try {
          const mod = await server.ssrLoadModule(`/api/${m[1]}.js`)
          Object.assign(req, { query: Object.fromEntries(url.searchParams), body: raw ? JSON.parse(raw) : {} })
          await mod.default(req, shim)
        } catch (e) {
          shim.status(500).json({ success: false, error: e instanceof Error ? e.message : String(e) })
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), devApi()],
  test: { exclude: ['e2e/**', 'node_modules/**'] }, // e2e dijalankan Playwright, bukan Vitest
  resolve: {
    alias: { '@features': src('features'), '@shared': src('shared'), '@': src('') },
  },
})
