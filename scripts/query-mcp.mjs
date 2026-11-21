#!/usr/bin/env bun
/**
 * Direct CLI Query to POS Vercel MCP Serverless Endpoint.
 * Usage:
 *   bun scripts/query-mcp.mjs <tool_name> [args_json]
 * Example:
 *   bun scripts/query-mcp.mjs pos_get_today_sales
 *   bun scripts/query-mcp.mjs pos_get_profit_report '{"from":"2026-11-01","to":"2026-11-16"}'
 */

const VERCEL_URL = process.env.POS_MCP_URL || 'https://pos-lac-eta.vercel.app/api/mcp'
const [toolName, argsStr] = process.argv.slice(2)

if (!toolName) {
  console.log('Usage: bun scripts/query-mcp.mjs <tool_name> [args_json]')
  process.exit(1)
}

let args = {}
if (argsStr) {
  try {
    args = JSON.parse(argsStr)
  } catch (e) {
    console.error('Invalid JSON arguments:', e.message)
    process.exit(1)
  }
}

const payload = {
  jsonrpc: '2.0',
  id: Date.now(),
  method: 'tools/call',
  params: {
    name: toolName,
    arguments: args,
  },
}

try {
  const res = await fetch(VERCEL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    console.error(`HTTP Error: ${res.status} ${res.statusText}`)
    process.exit(1)
  }

  const json = await res.json()
  if (json.error) {
    console.error('MCP Error:', json.error.message)
    process.exit(1)
  }

  const text = json.result?.content?.[0]?.text
  if (text) {
    try {
      console.log(JSON.stringify(JSON.parse(text), null, 2))
    } catch {
      console.log(text)
    }
  } else {
    console.log(JSON.stringify(json.result, null, 2))
  }
} catch (err) {
  console.error('Fetch error:', err.message)
  process.exit(1)
}

