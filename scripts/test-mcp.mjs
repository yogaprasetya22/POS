/**
 * Smoke test for POS MCP Server (Serverless Handler & Tool Execution).
 */
import handler from '../api/mcp.js'

let totalPassed = 0
let totalFailed = 0

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`)
    totalPassed++
  } else {
    console.error(`  ✗ FAIL: ${message}`)
    totalFailed++
  }
}

// Mock HTTP Request / Response objects for Vercel Serverless Function
function createMockHttp(method, body = null, headers = {}) {
  const req = {
    method,
    body,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
  }

  let statusCode = 200
  let responseData = null
  const responseHeaders = {}

  const res = {
    setHeader(k, v) {
      responseHeaders[k] = v
      return res
    },
    status(code) {
      statusCode = code
      return res
    },
    json(data) {
      responseData = data
      return res
    },
    end() {
      return res
    },
  }

  return { req, res, getResult: () => ({ status: statusCode, data: responseData, headers: responseHeaders }) }
}

console.log('--- 1. Testing GET /api/mcp (Discovery & Health) ---')
{
  const { req, res, getResult } = createMockHttp('GET')
  await handler(req, res)
  const result = getResult()
  assert(result.status === 200, 'GET /api/mcp returns 200')
  assert(result.data.success === true, 'Response success is true')
  assert(result.data.tools_count === 24, `Response includes all 24 tools (found: ${result.data.tools_count})`)
}

console.log('\n--- 2. Testing POST /api/mcp (initialize) ---')
{
  const { req, res, getResult } = createMockHttp('POST', {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test-client', version: '1.0.0' },
    },
  })
  await handler(req, res)
  const result = getResult()
  assert(result.status === 200, 'initialize returns 200')
  assert(result.data.result.serverInfo.name === 'mcp-pos-intelligence', 'Server info matches')
  assert(result.data.result.protocolVersion === '2024-11-05', 'Protocol version 2024-11-05 supported')
}

console.log('\n--- 3. Testing POST /api/mcp (tools/list) ---')
{
  const { req, res, getResult } = createMockHttp('POST', {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {},
  })
  await handler(req, res)
  const result = getResult()
  assert(result.status === 200, 'tools/list returns 200')
  const tools = result.data.result.tools
  assert(Array.isArray(tools), 'tools is array')
  assert(tools.length === 24, `24 tools returned in list (found: ${tools.length})`)
  const todayTool = tools.find((t) => t.name === 'pos_get_today_sales')
  assert(!!todayTool, 'pos_get_today_sales is in the list')
}

console.log('\n--- 4. Testing POST /api/mcp (tools/call -> pos_get_today_sales) ---')
{
  const { req, res, getResult } = createMockHttp('POST', {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'pos_get_today_sales',
      arguments: {},
    },
  })
  await handler(req, res)
  const result = getResult()
  assert(result.status === 200, 'pos_get_today_sales returns 200')
  const content = JSON.parse(result.data.result.content[0].text)
  assert(content.success === true, 'Envelope success is true')
  assert(content.data.store_name === 'Warung Kopi Nusantara', 'Store name matches Warung Kopi Nusantara')
  assert(typeof content.data.net_sales === 'number', `Net sales is number (${content.data.net_sales_formatted})`)
  assert(Array.isArray(content.warnings), 'Warnings array present')
}

console.log('\n--- 5. Testing POST /api/mcp (tools/call -> pos_get_profit_report) ---')
{
  const { req, res, getResult } = createMockHttp('POST', {
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/call',
    params: {
      name: 'pos_get_profit_report',
      arguments: {
        from: '2026-10-18',
        to: '2026-11-16',
      },
    },
  })
  await handler(req, res)
  const result = getResult()
  assert(result.status === 200, 'pos_get_profit_report returns 200')
  const content = JSON.parse(result.data.result.content[0].text)
  assert(content.success === true, 'Profit report success is true')
  assert(content.data.revenue > 0, `Revenue > 0 (Revenue: ${content.data.revenue_formatted})`)
  assert(content.data.cogs > 0, `COGS > 0 (COGS: ${content.data.cogs_formatted})`)
  assert(content.data.gross_profit > 0, `Gross profit > 0 (Gross Profit: ${content.data.gross_profit_formatted})`)
  console.log(`     * Profit Margin: ${content.data.gross_margin_pct}`)
}

console.log('\n--- 6. Testing POST /api/mcp (tools/call -> pos_get_low_stock_ingredients) ---')
{
  const { req, res, getResult } = createMockHttp('POST', {
    jsonrpc: '2.0',
    id: 5,
    method: 'tools/call',
    params: {
      name: 'pos_get_low_stock_ingredients',
      arguments: {},
    },
  })
  await handler(req, res)
  const result = getResult()
  assert(result.status === 200, 'pos_get_low_stock_ingredients returns 200')
  const content = JSON.parse(result.data.result.content[0].text)
  assert(content.success === true, 'Inventory query success is true')
  assert(Array.isArray(content.data.items), 'Low stock items is array')
  console.log(`     * Bahan Kritis/Habis Terdeteksi: ${content.data.total_low_stock_count} item`)
}

console.log('\n--- 7. Testing POST /api/mcp (Guardrail: pos_preview_void_order) ---')
{
  const { req, res, getResult } = createMockHttp('POST', {
    jsonrpc: '2.0',
    id: 6,
    method: 'tools/call',
    params: {
      name: 'pos_preview_void_order',
      arguments: { order_id: 'non-existent-order-id' },
    },
  })
  await handler(req, res)
  const result = getResult()
  assert(result.status === 200, 'Handles non-existent order gracefully without 500 crash')
  const content = JSON.parse(result.data.result.content[0].text)
  assert(content.success === false, 'Returns success: false for invalid ID')
  assert(typeof content.error === 'string', 'Error message provided')
}

console.log(`\n========================================`)
console.log(`Result: ${totalPassed} passed, ${totalFailed} failed.`)
if (totalFailed > 0) process.exit(1)

