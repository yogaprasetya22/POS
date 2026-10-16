import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const src = (p: string) => fileURLToPath(new URL(`./src/${p}`, import.meta.url))

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: { exclude: ['e2e/**', 'node_modules/**'] }, // e2e dijalankan Playwright, bukan Vitest
  resolve: {
    alias: { '@features': src('features'), '@shared': src('shared'), '@': src('') },
  },
})
