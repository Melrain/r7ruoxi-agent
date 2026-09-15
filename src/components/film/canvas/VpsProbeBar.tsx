"use client"

import { useEffect, useState } from "react"
import {
  formatDualExecutorProbeToast,
  probeVpsAndGrokCli,
} from "@/lib/api/executor-probe"
import { writeExecutorSourcePreference } from "@/lib/executor-source"
import { cn } from "@/lib/utils"
import { useProjectStore } from "@/components/film/canvas/store/project-store"

/**
 * /video 顶栏：只读「VPS」徽章 + ghost「探针」。
 * 一次点：并行测 VPS healthz + Nest Grok CLI；toast 并列两项。
 * 强制 r7.executorSource=vps；不渲染 ExecutorSourceSwitch 分段。
 */
export function VpsProbeBar({ className }: { className?: string }) {
  const showToast = useProjectStore((s) => s.showToast)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    writeExecutorSourcePreference("vps")
  }, [])

  async function onProbe() {
    if (busy) return
    setBusy(true)
    try {
      const result = await probeVpsAndGrokCli()
      const bothOk = result.vps.ok && result.grok.ok
      showToast(formatDualExecutorProbeToast(result), {
        durationMs: bothOk ? 2800 : 5200,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={cn("inline-flex items-center gap-1.5", className)}
      title="网页影片固定走 VPS"
    >
      <span
        aria-label="执行来源 VPS"
        className="inline-flex items-center rounded-full border border-zinc-600/80 bg-zinc-800/80 px-2.5 py-0.5 text-[11px] font-medium tracking-wide text-zinc-200"
      >
        VPS
      </span>
      <button
        type="button"
        disabled={busy}
        aria-busy={busy}
        aria-label="探测 VPS 与 Grok CLI"
        title="探测 VPS 连通 + Nest Grok CLI"
        onClick={() => void onProbe()}
        className={cn(
          "rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors",
          "text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-100",
          "disabled:cursor-wait disabled:opacity-60",
        )}
      >
        {busy ? "探针中…" : "探针"}
      </button>
    </div>
  )
}
