import { toolDefinitions, toolHandlers, invalidateAuthCache, verifyAuthToken } from '../server/mcp-tools.js'

/**
 * Vercel Serverless Function MCP Endpoint (JSON-RPC 2.0 / HTTP POST & SSE).
 * Compatible with Claude Desktop, Cursor, Antigravity IDE, and claude.ai Remote Connector.
 *
 * Security Model:
 * 1. GET / OPTIONS / initialize / ping: Public protocol metadata & healthcheck.
 * 2. tools/list & tools/call: STRICT AUTHENTICATION REQUIRED.
 *    Accepts:
 *    - Bearer <MCP_SECRET_KEY>
 *    - Header x-mcp-key: <MCP_SECRET_KEY>
 *    - Bearer <Supabase_JWT> (User session)
 * 3. Role-Based Access Control (RBAC):
 *    - Role 'cashier' is forbidden from accessing profit / margin costing data.
 */
export default async function handler(req, res) {
  // 1. CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-mcp-key, x-mcp-signature')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // 2. GET Method: Public metadata & Healthcheck (Zero financial data leaked)
  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      service: 'POS Intelligence MCP Serverless',
      version: '1.1.0',
      status: 'ONLINE',
      auth_required: true,
      tools_count: toolDefinitions.length,
      protocol: 'JSON-RPC 2.0 / MCP Specification (2024-11-05)',
      timestamp: new Date().toISOString(),
    })
  }

  // 3. POST Method Check
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, OPTIONS')
    return res.status(405).json({
      jsonrpc: '2.0',
      error: { code: -32600, message: 'Method not allowed. Use POST for JSON-RPC.' },
      id: null,
    })
  }

  const { jsonrpc, id, method, params } = req.body || {}

  // 4. Safe Protocol Handshakes (No sensitive business data exposed)
  if (method === 'initialize') {
    return res.status(200).json({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: { listChanged: false },
        },
        serverInfo: {
          name: 'mcp-pos-intelligence',
          version: '1.1.0',
        },
      },
    })
  }

  if (method === 'notifications/initialized' || method === 'ping') {
    return res.status(200).json({
      jsonrpc: '2.0',
      id: id ?? null,
      result: {},
    })
  }

  // 5. Strict Authentication Check for Protected Methods (tools/list & tools/call)
  const authHeader = req.headers?.authorization || req.headers?.['x-mcp-key'] || ''
  const authContext = await verifyAuthToken(authHeader)

  if (!authContext?.authenticated) {
    return res.status(401).json({
      jsonrpc: '2.0',
      id: id ?? null,
      error: {
        code: -32000,
        message: 'Unauthorized: Akses MCP ditolak. Harap sertakan header Authorization: Bearer <MCP_SECRET_KEY> atau token Supabase yang sah.',
      },
    })
  }

  // 6. Protected Methods
  try {
    switch (method) {
      case 'tools/list':
        return res.status(200).json({
          jsonrpc: '2.0',
          id,
          result: {
            tools: toolDefinitions,
          },
        })

      case 'tools/call': {
        const toolName = params?.name
        const toolArgs = params?.arguments || {}
        const fn = toolHandlers[toolName]

        if (!fn) {
          return res.status(404).json({
            jsonrpc: '2.0',
            id,
            error: {
              code: -32601,
              message: `Tool "${toolName}" tidak ditemukan dalam katalog POS MCP.`,
            },
          })
        }

        // RBAC: Kasir dilarang melihat laporan laba/rugi, HPP resep, dan perbandingan periode
        const role = authContext.user?.role
        const ownerOnlyTools = ['pos_get_profit_report', 'pos_get_item_profitability', 'pos_compare_periods', 'pos_get_recipe_costing']
        if (role === 'cashier' && ownerOnlyTools.includes(toolName)) {
          return res.status(403).json({
            jsonrpc: '2.0',
            id,
            error: {
              code: -32001,
              message: `Forbidden: Peran "${role}" tidak memiliki izin mengakses data finansial strategis (${toolName}).`,
            },
          })
        }

        try {
          let envelope
          try {
            envelope = await fn(toolArgs, authHeader, authContext.user)
          } catch (firstErr) {
            // Auto retry on auth failure with fresh token
            const msg = firstErr.message || ''
            if (msg.includes('JWT') || msg.includes('token') || msg.includes('forbidden') || msg.includes('expired')) {
              invalidateAuthCache()
              envelope = await fn(toolArgs, authHeader, authContext.user)
            } else {
              throw firstErr
            }
          }

          return res.status(200).json({
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(envelope, null, 2),
                },
              ],
              isError: false,
            },
          })
        } catch (err) {
          return res.status(200).json({
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      success: false,
                      error: err.message,
                      timestamp: new Date().toISOString(),
                    },
                    null,
                    2,
                  ),
                },
              ],
              isError: true,
            },
          })
        }
      }

      default:
        return res.status(400).json({
          jsonrpc: '2.0',
          id: id ?? null,
          error: {
            code: -32601,
            message: `Method "${method}" tidak didukung oleh MCP POS Server.`,
          },
        })
    }
  } catch (err) {
    return res.status(500).json({
      jsonrpc: '2.0',
      id: id ?? null,
      error: {
        code: -32603,
        message: `Internal server error: ${err.message}`,
      },
    })
  }
}
