"use client"

import { useState, type ReactNode } from "react"
import { FolderOpen, Hand, LayoutTemplate, Map, Plus, Search, Sparkles, Table2 } from "lucide-react"
import { AddNodePanel } from "@/components/film/canvas/AddNodePanel"
import { AssetLibrarySheet } from "@/components/film/canvas/AssetLibrarySheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { isUploadKind, pickAndAttachAsset } from "@/components/film/canvas/lib/pick-local-file"
import { cn } from "@/lib/utils"
import { useProjectStore } from "@/components/film/canvas/store/project-store"

function BarTip({
  label,
  shortcut,
  children,
}: {
  label: string
  shortcut?: string
  children: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top" className="text-center">
        <p className="font-medium text-zinc-100">{label}</p>
        {shortcut ? (
          <p className="mt-0.5 text-[10px] tabular-nums text-zinc-400">{shortcut}</p>
        ) : null}
      </TooltipContent>
    </Tooltip>
  )
}

function IconTip({
  label,
  shortcut,
  children,
  onClick,
  active,
}: {
  label: string
  shortcut?: string
  children: ReactNode
  onClick?: () => void
  active?: boolean
}) {
  return (
    <BarTip label={label} shortcut={shortcut}>
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        className={cn(
          "inline-flex size-8 items-center justify-center rounded-full text-zinc-400 hover:bg-white/6 hover:text-zinc-100",
          active && "bg-white/10 text-zinc-100"
        )}
      >
        {children}
      </button>
    </BarTip>
  )
}

export function BottomBar({
  onOpenClassic,
}: {
  onOpenClassic?: () => void
}) {
  const zoom = useProjectStore((s) => s.zoom)
  const addNode = useProjectStore((s) => s.addNode)
  const addAgent = useProjectStore((s) => s.addAgent)
  const openCreateAgent = useProjectStore((s) => s.openCreateAgent)
  const autoLayout = useProjectStore((s) => s.autoLayout)
  const setHandTool = useProjectStore((s) => s.setHandTool)
  const handTool = useProjectStore((s) => s.handTool)
  const showMinimap = useProjectStore((s) => s.showMinimap)
  const setShowMinimap = useProjectStore((s) => s.setShowMinimap)
  const showStarfield = useProjectStore((s) => s.showStarfield)
  const setShowStarfield = useProjectStore((s) => s.setShowStarfield)
  const showToast = useProjectStore((s) => s.showToast)
  const requestFitView = useProjectStore((s) => s.requestFitView)
  const [plusOpen, setPlusOpen] = useState(false)
  const libraryOpen = useProjectStore((s) => s.assetLibraryOpen)
  const setLibraryOpen = useProjectStore((s) => s.setAssetLibraryOpen)

  return (
    <TooltipProvider delayDuration={280}>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-50 flex items-end justify-center px-3 pb-3">
        <div className="pointer-events-auto flex items-center gap-0.5 rounded-full border border-[#e8c27a]/15 bg-[#16130f]/90 px-1.5 py-1 shadow-[0_8px_40px_rgba(0,0,0,0.45)] backdrop-blur-md">
          <BarTip label="添加节点" shortcut="打开素材与智能体目录">
            <DropdownMenu
              open={plusOpen}
              onOpenChange={(open) => {
                setPlusOpen(open)
                if (open) setLibraryOpen(false)
              }}
            >
              <DropdownMenuTrigger
                aria-label="添加节点"
                data-testid="add-node-trigger"
                className="inline-flex size-8 items-center justify-center rounded-full bg-[#e8c27a] text-[#1a140c] hover:bg-[#f0d39a]"
              >
                <Plus className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="start"
                className="mb-2 border-0 bg-transparent p-0 shadow-none"
              >
                <AddNodePanel
                  onPick={(item) => {
                    if (item.id === "agent-write") {
                      const selected = useProjectStore.getState().nodes.find((n) =>
                        useProjectStore.getState().selectedNodeIds.includes(n.id)
                      )
                      openCreateAgent({
                        flowX: (selected?.position.x ?? 240) + 280,
                        flowY: selected?.position.y ?? 180,
                      })
                      setPlusOpen(false)
                      return
                    }
                    if (item.agentId) addAgent(item.agentId)
                    else if (item.kind) {
                      const id = addNode(item.kind)
                      if (isUploadKind(item.kind)) {
                        void pickAndAttachAsset(
                          id,
                          item.kind,
                          useProjectStore.getState().updateNodeData
                        )
                      }
                    }
                    setPlusOpen(false)
                  }}
                  onStub={(item) => {
                    showToast(`${item.label}为演示占位`)
                    setPlusOpen(false)
                  }}
                  onOpenLibrary={() => {
                    setPlusOpen(false)
                    setLibraryOpen(true)
                  }}
                />
              </DropdownMenuContent>
            </DropdownMenu>
          </BarTip>

          <BarTip label="资产库" shortcut="引用已入库素材到画布">
            <button
              type="button"
              aria-label="资产库"
              data-testid="asset-library-trigger"
              onClick={() => {
                setPlusOpen(false)
                setLibraryOpen(true)
              }}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] text-zinc-200 hover:bg-white/6"
            >
              <FolderOpen className="size-3.5 text-zinc-400" />
              资产库
            </button>
          </BarTip>

          <BarTip label="视频解析" shortcut="添加视频解析智能体">
            <button
              type="button"
              aria-label="视频解析"
              onClick={() => addAgent("parse")}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] text-zinc-200 hover:bg-white/6"
            >
              <Search className="size-3.5 text-zinc-400" />
              视频解析
            </button>
          </BarTip>
          <BarTip label="拆分镜" shortcut="添加拆分镜智能体">
            <button
              type="button"
              aria-label="拆分镜"
              onClick={() => addAgent("storyboard")}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] text-zinc-200 hover:bg-white/6"
            >
              <Table2 className="size-3.5 text-zinc-400" />
              拆分镜
            </button>
          </BarTip>

          <IconTip
            label="移动"
            shortcut="手型平移 · 空格拖动画布"
            onClick={() => setHandTool(!handTool)}
            active={handTool}
          >
            <Hand className="size-4" />
          </IconTip>
          <IconTip
            label="整理画布"
            shortcut="⌥⇧F / Alt+Shift+F"
            onClick={() => autoLayout()}
          >
            <LayoutTemplate className="size-4" />
          </IconTip>
          <IconTip
            label={showMinimap ? "隐藏小图" : "显示小图"}
            shortcut="视口缩略图"
            onClick={() => setShowMinimap(!showMinimap)}
            active={showMinimap}
          >
            <Map className="size-4" />
          </IconTip>
          <IconTip
            label={showStarfield ? "关闭星空" : "弱星空"}
            shortcut="画布背景装饰"
            onClick={() => setShowStarfield(!showStarfield)}
            active={showStarfield}
          >
            <Sparkles className="size-4" />
          </IconTip>
          <BarTip
            label="缩放"
            shortcut="⌘/Ctrl + − / + · ⌘/Ctrl+0 适屏"
          >
            <button
              type="button"
              aria-label="缩放，点击适屏"
              onClick={() => requestFitView()}
              className="min-w-11 rounded-full px-1.5 py-1 text-center text-[11px] tabular-nums text-zinc-400 hover:bg-white/6 hover:text-zinc-200"
            >
              {zoom}%
            </button>
          </BarTip>
        </div>
        {onOpenClassic ? (
          <BarTip label="经典跟拍" shortcut="打开线性跟拍页">
            <button
              type="button"
              onClick={onOpenClassic}
              className="pointer-events-auto absolute right-4 bottom-4 text-[12px] text-zinc-600 hover:text-zinc-400"
            >
              经典跟拍
            </button>
          </BarTip>
        ) : null}
        <AssetLibrarySheet open={libraryOpen} onOpenChange={setLibraryOpen} />
      </div>
    </TooltipProvider>
  )
}
