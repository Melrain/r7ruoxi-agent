type LoopNode = {
  id: string
  data: {
    role?: string
    kind?: string
    agentId?: string
    status?: string
    text?: string
    scriptRows?: unknown[]
    assetUrl?: string
    assetId?: string
    textAssetCard?: boolean
    assetRole?: string
    sourceScriptId?: string
    filmProjectId?: string
  }
}

type LoopEdge = {
  source: string
  target: string
  data?: { edgeKind?: string }
}

function isAgentNode(node: LoopNode | undefined): boolean {
  return node?.data.role === "agent" || node?.data.kind === "agent"
}

/**
 * Director six-loop (web fill-in skeleton / run-next).
 * 参考片之后：拆解 → 剧本 → 素材 → 分镜 → 关键帧 → 片段
 */
export const FILM_SIX_LOOPS = [
  "parse",
  "script",
  "assets",
  "storyboard",
  "image",
  "video",
] as const

export type FilmSixLoopId = (typeof FILM_SIX_LOOPS)[number]

export const FILM_SIX_LOOP_LABELS: Record<FilmSixLoopId, string> = {
  parse: "拆解",
  script: "剧本",
  assets: "素材",
  storyboard: "分镜",
  image: "关键帧",
  video: "片段",
}

/** Agent ids the director skeleton must place (assets hang off script cards). */
export const FILM_DIRECTOR_SKELETON_AGENTS = [
  "parse",
  "script",
  "storyboard",
  "image",
  "video",
] as const

export type FilmDirectorSkeletonAgent = (typeof FILM_DIRECTOR_SKELETON_AGENTS)[number]

export function isFilmSixLoopId(value: unknown): value is FilmSixLoopId {
  return typeof value === "string" && (FILM_SIX_LOOPS as readonly string[]).includes(value)
}

function nodeHasBody(node: LoopNode | undefined): boolean {
  if (!node) return false
  if (node.data.status === "error" || node.data.status === "running") return false
  const text = (node.data.text || "").trim()
  const rows = node.data.scriptRows ?? []
  const url = (node.data.assetUrl || "").trim()
  return Boolean(text || rows.length > 0 || url)
}

function findAgent(nodes: LoopNode[], agentId: string): LoopNode | undefined {
  return nodes.find((n) => isAgentNode(n) && n.data.agentId === agentId)
}

function findOutAsset(
  nodes: LoopNode[],
  edges: LoopEdge[],
  agentId: string,
  kind?: string,
): LoopNode | undefined {
  const agent = findAgent(nodes, agentId)
  if (!agent) return undefined
  for (const edge of edges) {
    if (edge.source !== agent.id || edge.data?.edgeKind !== "out") continue
    const tgt = nodes.find((n) => n.id === edge.target)
    if (!tgt) continue
    if (kind && tgt.data.kind !== kind) continue
    return tgt
  }
  return undefined
}

export function filmLoopComplete(
  loop: FilmSixLoopId,
  nodes: LoopNode[],
  edges: LoopEdge[],
): boolean {
  if (loop === "parse") {
    const out = findOutAsset(nodes, edges, "parse")
    return Boolean(out && (out.data.scriptRows?.length || (out.data.text || "").trim()))
  }
  if (loop === "script") {
    const out = findOutAsset(nodes, edges, "script", "script")
    return Boolean(out && (out.data.text || "").trim() && out.data.status === "success")
  }
  if (loop === "assets") {
    return nodes.some(
      (n) =>
        n.data.textAssetCard ||
        n.data.assetRole === "character" ||
        n.data.assetRole === "scene" ||
        n.data.assetRole === "prop",
    )
  }
  if (loop === "storyboard") {
    const out = findOutAsset(nodes, edges, "storyboard", "storyboard")
    return Boolean(out && (out.data.scriptRows?.length ?? 0) > 0 && out.data.status === "success")
  }
  if (loop === "image") {
    return nodes.some(
      (n) =>
        n.data.kind === "image" &&
        n.data.status === "success" &&
        ((n.data.assetUrl || "").trim() || (n.data.assetId || "").trim()),
    )
  }
  const out = findOutAsset(nodes, edges, "video", "video")
  if (out && out.data.status === "success") {
    return Boolean((out.data.assetUrl || "").trim() || (out.data.assetId || "").trim())
  }
  return nodes.some(
    (n) =>
      n.data.kind === "video" &&
      n.data.status === "success" &&
      Boolean(n.data.sourceScriptId) &&
      ((n.data.assetUrl || "").trim() || (n.data.assetId || "").trim()),
  )
}

export function nextFilmSixLoop(
  nodes: LoopNode[],
  edges: LoopEdge[],
): FilmSixLoopId | null {
  for (const loop of FILM_SIX_LOOPS) {
    if (!filmLoopComplete(loop, nodes, edges)) return loop
  }
  return null
}

export function missingDirectorSkeletonAgents(nodes: LoopNode[]): FilmDirectorSkeletonAgent[] {
  return FILM_DIRECTOR_SKELETON_AGENTS.filter((id) => !findAgent(nodes, id))
}

export function filmSixLoopAgentId(loop: FilmSixLoopId): string | null {
  if (loop === "assets") return null
  return loop
}

export function describeNextFilmLoop(loop: FilmSixLoopId | null): string {
  if (!loop) return "六环已齐"
  return `下一步：${FILM_SIX_LOOP_LABELS[loop]}`
}

export function nodeLooksFilled(node: LoopNode | undefined) {
  return nodeHasBody(node)
}
