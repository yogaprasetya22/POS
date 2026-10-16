import { defineConfig } from '@playwright/test'

try {
  process.loadEnvFile('.env')
} catch {
  // env bisa datang dari shell/CI
}

export default defineConfig({
  testDir: 'e2e',
  workers: 1, // semua tes berbagi satu database; jalan berurutan
  timeout: 60_000,
  reporter: 'list',
  use: { baseURL: 'http://localhost:5199', trace: 'retain-on-failure' },
  webServer: { command: 'bun run dev --port 5199 --strictPort', url: 'http://localhost:5199', reuseExistingServer: true },
})
