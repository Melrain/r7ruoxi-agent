import type { AppNode, NodeStatus } from "@/components/film/canvas/types/project"

export const FILM_THREE_VIEWS = ["front", "side", "back"] as const
export type FilmThreeViewId = (typeof FILM_THREE_VIEWS)[number]

export const FILM_THREE_VIEW_LABELS: Record<FilmThreeViewId, string> = {
  front: "正",
  side: "侧",
  back: "背",
}

export type FilmThreeViewSlot = {
  url?: string
  s3Key?: string
  assetId?: string
  status?: NodeStatus
  error?: string
}

export type FilmThreeViews = Partial<Record<FilmThreeViewId, FilmThreeViewSlot>>

export function isCharacterAssetCard(node: AppNode): boolean {
  if (node.data.assetRole === "character") return true
  return node.data.kind === "character" && (node.data.textAssetCard === true || Boolean(node.data.assetRole))
}

export function threeViewFilled(slot: FilmThreeViewSlot | undefined): boolean {
  if (!slot) return false
  if (slot.status === "error" || slot.status === "running") return false
  return Boolean((slot.url || "").trim() || (slot.s3Key || "").trim() || (slot.assetId || "").trim())
}

export function characterHasThreeViews(node: AppNode): boolean {
  const views = node.data.threeViews
  if (!views) return false
  return FILM_THREE_VIEWS.every((id) => threeViewFilled(views[id]))
}

export function characterThreeViewGaps(node: AppNode): FilmThreeViewId[] {
  const views = node.data.threeViews
  return FILM_THREE_VIEWS.filter((id) => !threeViewFilled(views?.[id]))
}

export function storyboardThreeViewGate(nodes: AppNode[]): {
  ok: boolean
  reason: string
  missing: string[]
} {
  const characters = nodes.filter(isCharacterAssetCard)
  if (characters.length === 0) {
    return {
      ok: false,
      reason: "没有角色三视，无法写分镜",
      missing: [],
    }
  }
  const missing = characters
    .filter((n) => !characterHasThreeViews(n))
    .map((n) => (n.data.label || "角色").trim() || "角色")
  if (missing.length > 0) {
    return {
      ok: false,
      reason: `分镜需要角色三视（正/侧/背）：${missing.join("、")}`,
      missing,
    }
  }
  return { ok: true, reason: "", missing: [] }
}

export function storyboardOutExists(nodes: AppNode[]): boolean {
  return nodes.some(
    (n) =>
      n.data.kind === "storyboard" &&
      n.data.status === "success" &&
      (n.data.scriptRows?.length ?? 0) > 0,
  )
}

export function makeupLockedReason(makeupLocked: boolean, nodes: AppNode[]): string | null {
  if (makeupLocked || storyboardOutExists(nodes)) {
    return "分镜已出，定妆已锁定"
  }
  return null
}

export const MAKEUP_LOCK_STORAGE_KEY = "r7.film.makeupLocked"

export function readMakeupLocked(): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.localStorage.getItem(MAKEUP_LOCK_STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

export function writeMakeupLocked(locked: boolean) {
  if (typeof window === "undefined") return
  try {
    if (locked) window.localStorage.setItem(MAKEUP_LOCK_STORAGE_KEY, "1")
    else window.localStorage.removeItem(MAKEUP_LOCK_STORAGE_KEY)
  } catch {
    // ignore quota
  }
}
