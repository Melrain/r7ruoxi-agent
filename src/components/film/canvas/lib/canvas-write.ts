import type { ScriptRow } from "@/components/film/canvas/types/project"
import type { FilmBreakdownItem } from "@/lib/film-package"
import { filmBreakdownPresentation } from "@/lib/film-package"

export function scriptRowsFromBreakdown(items: FilmBreakdownItem[]): ScriptRow[] {
  return items.map((item, index) => {
    const presented = filmBreakdownPresentation(item, index)
    const visual =
      (item.visual ?? item["画面"] ?? "").trim() ||
      presented.body?.match(/画面：([^\n]*)/)?.[1]?.trim() ||
      ""
    const dialogue =
      (item.dialogue ?? item["对白"] ?? "").trim() ||
      presented.body?.match(/对白：([^\n]*)/)?.[1]?.trim() ||
      ""
    const shotId = (item.shotNo ?? "").trim() || `S${String(index + 1).padStart(2, "0")}`
    return {
      id: item.id?.trim() || `row_${shotId.toLowerCase()}_${index}`,
      shotId,
      duration: "",
      visualDesc: visual,
      dialogue,
      selected: true,
      rowStatus: "success" as const,
    }
  })
}

export function collectInboundVisionAssetIds(
  nodes: { id: string; data: { kind?: string; assetId?: string } }[],
  inboundNodeIds: string[],
): string[] {
  const allow = new Set(inboundNodeIds)
  const ids: string[] = []
  for (const node of nodes) {
    if (!allow.has(node.id)) continue
    if (node.data.kind !== "image" && node.data.kind !== "video") continue
    const id = node.data.assetId?.trim()
    if (id) ids.push(id)
  }
  return [...new Set(ids)]
}
