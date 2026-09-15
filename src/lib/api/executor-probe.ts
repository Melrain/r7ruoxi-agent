/** Light VPS + Nest Grok CLI ping (desktop → Nest via resolveApiUrl / desktopFetch). */

import { resolveApiUrl } from "@/lib/api-base"
import { backendFetch } from "@/lib/api/client"
import { desktopFetch } from "@/lib/api/desktop-fetch"

export type ExecutorProbeResult = {
  ok: boolean
  latencyMs: number
  status: number | null
  error?: string
}

export type GrokCliProbeResult = {
  ok: boolean
  version?: string
  error?: string
}

export type DualExecutorProbeResult = {
  vps: ExecutorProbeResult
  grok: GrokCliProbeResult
}

const DEFAULT_TIMEOUT_MS = 4_000
const GROK_STATUS_TIMEOUT_MS = 6_000

/** GET /healthz on Nest (VITE_API_BASE). */
export async function probeVpsHealth({
  timeoutMs = DEFAULT_TIMEOUT_MS,
  signal,
}: {
  timeoutMs?: number
  signal?: AbortSignal
} = {}): Promise<ExecutorProbeResult> {
  const started = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const onExternal = () => controller.abort()
  if (signal) {
    if (signal.aborted) controller.abort()
    else signal.addEventListener("abort", onExternal, { once: true })
  }

  try {
    const response = await desktopFetch(resolveApiUrl("/api/backend/healthz"), {
      cache: "no-store",
      signal: controller.signal,
    })
    const latencyMs = Date.now() - started
    if (!response.ok) {
      return {
        ok: false,
        latencyMs,
        status: response.status,
        error: `HTTP ${response.status}`,
      }
    }
    return { ok: true, latencyMs, status: response.status }
  } catch (error) {
    const latencyMs = Date.now() - started
    if (
      (error instanceof DOMException && error.name === "AbortError") ||
      (error instanceof Error && error.name === "AbortError")
    ) {
      const timedOut = latencyMs >= timeoutMs - 50
      return {
        ok: false,
        latencyMs,
        status: null,
        error: timedOut ? "超时" : "已取消",
      }
    }
    return {
      ok: false,
      latencyMs,
      status: null,
      error: error instanceof Error ? error.message : "无法连接",
    }
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener("abort", onExternal)
  }
}

/**
 * GET /internal/film/grok-status — Nest Grok CLI installed/callable.
 * Honest: endpoint is new on Nest (web dirty); probe reports failure until Nest ships it.
 */
export async function probeGrokCli({
  timeoutMs = GROK_STATUS_TIMEOUT_MS,
  signal,
}: {
  timeoutMs?: number
  signal?: AbortSignal
} = {}): Promise<GrokCliProbeResult> {
  try {
    const raw = await backendFetch<unknown>(
      "/api/backend/internal/film/grok-status",
      { timeoutMs, signal },
    )
    const row =
      raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
    const ok = row.ok === true
    const version =
      typeof row.version === "string" && row.version.trim()
        ? row.version.trim()
        : undefined
    const error =
      typeof row.error === "string" && row.error.trim()
        ? row.error.trim()
        : undefined
    return ok ? { ok: true, version } : { ok: false, error: error ?? "未就绪" }
  } catch (error) {
    if (
      (error instanceof DOMException && error.name === "AbortError") ||
      (error instanceof Error && error.name === "AbortError")
    ) {
      return { ok: false, error: "超时" }
    }
    return {
      ok: false,
      error: error instanceof Error && error.message.trim()
        ? error.message.trim().slice(0, 48)
        : "无法连接",
    }
  }
}

/** Parallel VPS healthz + Nest Grok CLI status. Always returns both legs. */
export async function probeVpsAndGrokCli(options?: {
  signal?: AbortSignal
}): Promise<DualExecutorProbeResult> {
  const [vps, grok] = await Promise.all([
    probeVpsHealth({ signal: options?.signal }),
    probeGrokCli({ signal: options?.signal }),
  ])
  return { vps, grok }
}

export function formatExecutorProbeToast(result: ExecutorProbeResult): string {
  if (result.ok) return `VPS 通 · ${result.latencyMs}ms`
  return "VPS 不通"
}

export function formatGrokCliProbeToast(result: GrokCliProbeResult): string {
  return result.ok ? "Grok CLI 就绪" : "Grok CLI 未就绪"
}

/** Always show both legs, even when one fails. */
export function formatDualExecutorProbeToast(
  result: DualExecutorProbeResult,
): string {
  return `${formatExecutorProbeToast(result.vps)}｜${formatGrokCliProbeToast(result.grok)}`
}
