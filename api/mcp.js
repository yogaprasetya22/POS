import { toolDefinitions, toolHandlers, invalidateAuthCache } from '../server/mcp-tools.js'

/**
 * Vercel Serverless Function MCP Endpoint (JSON-RPC 2.0 / HTTP POST & SSE).
 * Compatible with Claude Desktop, Cursor, Antigravity IDE, and claude.ai Remote Connector.
 */
export default async function handler(req, res) {
  // 1. CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-mcp-signature')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // 2. Secret Key Authentication (Optional / If configured)
  const secretKey = process.env.MCP_SECRET_KEY
  if (secretKey) {
    const authHeader = req.headers?.authorization
    if (!authHeader || authHeader !== `Bearer ${secretKey}`) {
      return res.status(401).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Unauthorized: Invalid or missing MCP_SECRET_KEY' },
        id: req.body?.id || null,
      })
    }
  }

  // 3. GET Method: Health check & Discovery metadata
  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      service: 'POS Intelligence MCP Serverless',
      version: '1.0.0',
      status: 'ONLINE',
      tools_count: toolDefinitions.length,
      protocol: 'JSON-RPC 2.0 / MCP Specification (2024-11-05)',
      timestamp: new Date().toISOString(),
    })
  }

  // 4. POST Method: JSON-RPC 2.0 Handler
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, OPTIONS')
    return res.status(405).json({
      jsonrpc: '2.0',
      error: { code: -32600, message: 'Method not allowed. Use POST for JSON-RPC.' },
      id: null,
    })
  }

  const { jsonrpc, id, method, params } = req.body || {}

  try {
    switch (method) {
      case 'initialize':
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
              version: '1.0.0',
            },
          },
        })

      case 'notifications/initialized':
      case 'ping':
        return res.status(200).json({
          jsonrpc: '2.0',
          id: id ?? null,
          result: {},
        })

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

        try {
          let envelope
          try {
            envelope = await fn(toolArgs, req.headers?.authorization)
          } catch (firstErr) {
            // Auto retry on auth failure with fresh token
            const msg = firstErr.message || ''
            if (msg.includes('JWT') || msg.includes('token') || msg.includes('forbidden') || msg.includes('expired')) {
              invalidateAuthCache()
              envelope = await fn(toolArgs, req.headers?.authorization)
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

