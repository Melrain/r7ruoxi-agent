"use client"

import { useEffect } from "react"
import { BottomBar } from "@/components/film/canvas/BottomBar"
import { CanvasViewport } from "@/components/film/canvas/CanvasViewport"
import { CreateAgentSheet } from "@/components/film/canvas/CreateAgentSheet"
import { NodeDetailOverlay } from "@/components/film/canvas/NodeDetailOverlay"
import { ProjectSwitcher } from "@/components/film/canvas/ProjectSwitcher"
import { ProgressHairline } from "@/components/film/canvas/ProgressHairline"
import { ToastHost } from "@/components/film/canvas/ToastHost"
import { VpsProbeBar } from "@/components/film/canvas/VpsProbeBar"
import { refreshNodeAssetUrls } from "@/components/film/canvas/lib/refresh-node-asset-urls"
import { useProjectStore } from "@/components/film/canvas/store/project-store"
import "@/components/film/canvas/film-canvas.css"

/** Pure-canvas WorkspaceShell — desktop film main entry (web `/video`). */
export function WorkspaceShell({
  onOpenClassic,
}: {
  onOpenClassic?: () => void
}) {
  const hydrateFromStorage = useProjectStore((s) => s.hydrateFromStorage)
  const setViewMode = useProjectStore((s) => s.setViewMode)
  const projectId = useProjectStore((s) => s.projectId)

  useEffect(() => {
    hydrateFromStorage()
  }, [hydrateFromStorage])

  useEffect(() => {
    setViewMode("workflow")
  }, [setViewMode])

  useEffect(() => {
    if (!projectId) return
    const ac = new AbortController()
    void refreshNodeAssetUrls({ signal: ac.signal })
    return () => ac.abort()
  }, [projectId])

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[#14161c] text-[#ece7dc]">
      <div className="absolute left-3 top-3 z-50 flex items-center gap-1">
        <ProjectSwitcher />
      </div>
      <div className="pointer-events-auto absolute right-3 top-3 z-50">
        <VpsProbeBar className="inline-flex" />
      </div>
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
          <ProgressHairline />
          <CanvasViewport />
          <NodeDetailOverlay />
          <CreateAgentSheet />
          <BottomBar onOpenClassic={onOpenClassic} />
        </div>
      </div>
      <ToastHost />
    </div>
  )
}

export default WorkspaceShell
