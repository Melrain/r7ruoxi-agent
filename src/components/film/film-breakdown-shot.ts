/** Shot display helpers shared by Melrain canvas (ported from web film-breakdown-list). */

export type FilmBreakdownCardLike = {
  id?: string
  title: string
  body: string
  kind?: string
  shotNo?: string
  visual?: string
  "画面"?: string
  dialogue?: string
  "对白"?: string
  mode?: string
  stub?: boolean
  blocked?: boolean
  hadFrames?: boolean
}

type ShotDisplay = {
  shotTitle: string
  visual: string
  dialogue: string
  badges: string[]
}

function splitBodyVisualDialogue(body: string): { visual: string; dialogue: string } {
  const text = body.trim()
  if (!text) return { visual: "", dialogue: "" }

  const visualMatch = text.match(/(?:^|\n)\s*画面\s*[:：]\s*/m)
  const dialogueMatch = text.match(/(?:^|\n)\s*对白\s*[:：]\s*/m)

  if (!visualMatch && !dialogueMatch) {
    return { visual: text, dialogue: "" }
  }

  let visual = ""
  let dialogue = ""

  if (visualMatch && dialogueMatch) {
    const vStart = (visualMatch.index ?? 0) + visualMatch[0].length
    const dIdx = dialogueMatch.index ?? 0
    const dStart = dIdx + dialogueMatch[0].length
    if (vStart <= dIdx) {
      visual = text.slice(vStart, dIdx).trim()
      dialogue = text.slice(dStart).trim()
    } else {
      dialogue = text.slice(dStart, visualMatch.index ?? text.length).trim()
      visual = text.slice(vStart).trim()
    }
  } else if (visualMatch) {
    const vStart = (visualMatch.index ?? 0) + visualMatch[0].length
    visual = text.slice(vStart).trim()
    const before = text.slice(0, visualMatch.index ?? 0).trim()
    if (before) visual = `${before}\n${visual}`.trim()
  } else if (dialogueMatch) {
    const dStart = (dialogueMatch.index ?? 0) + dialogueMatch[0].length
    dialogue = text.slice(dStart).trim()
    visual = text.slice(0, dialogueMatch.index ?? 0).trim()
  }

  return { visual, dialogue }
}

/**
 * Nest 契约：title =「镜号 N」；body 含「画面：」「对白：」分段。
 * 若后端另给 visual/dialogue/shotNo 等字段则优先用结构化值。
 */
export function resolveBreakdownShotDisplay(item: FilmBreakdownCardLike): ShotDisplay {
  const row = item as FilmBreakdownCardLike & Record<string, unknown>
  const shotNo =
    (typeof item.shotNo === "string" && item.shotNo.trim()) ||
    (typeof item.title === "string" && item.title.trim()) ||
    "镜头"

  const structuredVisual =
    (typeof item.visual === "string" && item.visual.trim()) ||
    (typeof row["画面"] === "string" && String(row["画面"]).trim()) ||
    ""
  const structuredDialogue =
    (typeof item.dialogue === "string" && item.dialogue.trim()) ||
    (typeof row["对白"] === "string" && String(row["对白"]).trim()) ||
    ""

  const parsed = splitBodyVisualDialogue(item.body ?? "")
  const visual = structuredVisual || parsed.visual
  const dialogue = structuredDialogue || parsed.dialogue

  const badges: string[] = []
  if (typeof item.mode === "string" && item.mode.trim()) {
    badges.push(`mode:${item.mode.trim()}`)
  }
  if (item.stub === true) badges.push("stub")
  if (item.blocked === true) badges.push("blocked")
  if (item.hadFrames === true) badges.push("hadFrames")
  if (item.hadFrames === false) badges.push("noFrames")

  return {
    shotTitle: shotNo,
    visual,
    dialogue,
    badges,
  }
}
