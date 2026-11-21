#!/usr/bin/env bun
/**
 * MCP Stdio Bridge to Vercel Serverless Function.
 * Connects Antigravity, Claude Desktop, or Cursor directly to https://pos-lac-eta.vercel.app/api/mcp
 */
import readline from 'node:readline'

const VERCEL_URL = process.env.POS_MCP_URL || 'https://pos-lac-eta.vercel.app/api/mcp'
const AUTH_HEADER = process.env.MCP_SECRET_KEY ? `Bearer ${process.env.MCP_SECRET_KEY}` : ''

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
})

async function forwardToVercel(rpcMessage) {
  try {
    const res = await fetch(VERCEL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(AUTH_HEADER ? { Authorization: AUTH_HEADER } : {}),
      },
      body: JSON.stringify(rpcMessage),
    })

    if (!res.ok) {
      return {
        jsonrpc: '2.0',
        id: rpcMessage.id ?? null,
        error: { code: -32603, message: `Vercel HTTP error: ${res.status} ${res.statusText}` },
      }
    }

    return await res.json()
  } catch (err) {
    return {
      jsonrpc: '2.0',
      id: rpcMessage.id ?? null,
      error: { code: -32603, message: `Failed to connect to Vercel: ${err.message}` },
    }
  }
}

rl.on('line', async (line) => {
  const trimmed = line.trim()
  if (!trimmed) return

  let parsed
  try {
    parsed = JSON.parse(trimmed)
  } catch (e) {
    console.log(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }))
    return
  }

  const response = await forwardToVercel(parsed)
  console.log(JSON.stringify(response))
})

