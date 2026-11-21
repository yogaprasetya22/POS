# POS Project Development & Verification Guidelines

## Active Skills & Recommendations
- **`webapp-testing`**: Gunakan panduan pengujian standar untuk fitur POS, backoffice, cart, dan print receipt.
- **`playwright-cli`**: Gunakan Playwright untuk otomatisasi browser E2E, pengujian alur kasir, rekam tutorial, dan verifikasi visual.
- **`verification-before-completion`**: Wajib jalankan verifikasi (`bun run lint && bun run build && bun run test`) sebelum menyatakan tugas selesai atau melakukan git commit/push.

## Verification Checklist
Sebelum menutup task atau membuat git commit:
1. `bun run lint` (0 error, 0 warning)
2. `bun run build` (tsc pass, bundle sukses)
3. `bun run test` (semua unit test pass)
4. `bun run mcp:test` (jika mengubah server MCP atau API)

