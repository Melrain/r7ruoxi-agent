import type { AppEdge, AppNode } from "@/components/film/canvas/types/project";
import { isBreakdownAssetData } from "@/components/film/canvas/lib/breakdown-script-rows";

const COL = 440;
const ROW = 360;
const ORIGIN_X = 72;
const ORIGIN_Y = 72;

export function layoutGraph(nodes: AppNode[], edges: AppEdge[]): AppNode[] {
  if (nodes.length === 0) return nodes;

  const incoming = new Map<string, number>();
  const outgoing = new Map<string, string[]>();
  for (const node of nodes) {
    incoming.set(node.id, 0);
    outgoing.set(node.id, []);
  }
  for (const edge of edges) {
    if (!incoming.has(edge.target) || !outgoing.has(edge.source)) continue;
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
    outgoing.get(edge.source)?.push(edge.target);
  }

  const placed = new Set<string>();
  const layers: string[][] = [];
  let current = nodes.filter((n) => (incoming.get(n.id) ?? 0) === 0).map((n) => n.id);
  if (current.length === 0) current = [nodes[0].id];

  while (current.length > 0) {
    layers.push(current);
    current.forEach((id) => placed.add(id));
    const next: string[] = [];
    for (const id of current) {
      for (const target of outgoing.get(id) ?? []) {
        if (!placed.has(target) && !next.includes(target)) next.push(target);
      }
    }
    current = next;
  }

  const leftover = nodes.filter((n) => !placed.has(n.id)).map((n) => n.id);
  if (leftover.length > 0) layers.push(leftover);

  const index = new Map<string, { layer: number; order: number }>();
  layers.forEach((layer, li) => {
    layer.forEach((id, oi) => index.set(id, { layer: li, order: oi }));
  });

  return nodes.map((node) => {
    const pos = index.get(node.id) ?? { layer: 0, order: 0 };
    return {
      ...node,
      position: {
        x: ORIGIN_X + pos.layer * COL,
        y: ORIGIN_Y + pos.order * ROW,
      },
    };
  });
}

export function nextFreePosition(
  nodes: AppNode[],
  offset = { x: 0, y: 0 },
  anchor?: AppNode
): { x: number; y: number } {
  if (nodes.length === 0) return { x: 220 + offset.x, y: 160 + offset.y };
  const base = anchor ?? nodes[nodes.length - 1];
  return findClearPosition(
    nodes,
    {
      x: base.position.x + 48 + offset.x,
      y: base.position.y + 240 + offset.y,
    }
  );
}

const PAD = 28;
const STEP = 48;

function sizeForNode(node: AppNode) {
  const kind = node.data.kind ?? node.type;
  if (node.data.role === "agent" || kind === "agent") return { w: 280, h: 150 };
  if (kind === "script") return { w: 340, h: 380 };
  if (kind === "storyboard") return { w: 400, h: 300 };
  if (kind === "text" && isBreakdownAssetData(node.data)) {
    return { w: 320, h: 360 };
  }
  if (
    node.data.textAssetCard ||
    node.data.assetRole ||
    ((kind === "character" || kind === "scene") && node.data.textAssetCard !== false && node.data.assetRole)
  ) {
    return { w: 200, h: 220 };
  }
  if (kind === "text" || kind === "image" || kind === "video" || kind === "audio" || kind === "file") {
    return { w: 108, h: 140 };
  }
  return { w: 300, h: 280 };
}

function nodeBox(node: AppNode) {
  const { w, h } = sizeForNode(node);
  return { x: node.position.x, y: node.position.y, w, h };
}

function overlaps(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number }
) {
  return (
    a.x < b.x + b.w + PAD &&
    a.x + a.w + PAD > b.x &&
    a.y < b.y + b.h + PAD &&
    a.y + a.h + PAD > b.y
  );
}

export function sizeForKind(kind: AppNode["type"] | undefined) {
  if (kind === "agent") return { w: 280, h: 150 };
  if (kind === "script") return { w: 340, h: 380 };
  if (kind === "storyboard") return { w: 400, h: 300 };
  if (kind === "text" || kind === "image" || kind === "video" || kind === "audio" || kind === "file") {
    return { w: 108, h: 140 };
  }
  return { w: 300, h: 280 };
}

/** Prefer the given point; if occupied, walk a right-biased spiral. */
export function findClearPosition(
  nodes: AppNode[],
  preferred: { x: number; y: number },
  size = { w: 280, h: 240 }
): { x: number; y: number } {
  const boxes = nodes.map(nodeBox);
  const free = (x: number, y: number) =>
    !boxes.some((box) => overlaps({ x, y, w: size.w, h: size.h }, box));
  if (free(preferred.x, preferred.y)) return preferred;

  for (let ring = 1; ring <= 28; ring++) {
    const tries: { x: number; y: number }[] = [];
    for (let col = ring; col >= 0; col--) {
      tries.push({ x: preferred.x + col * STEP, y: preferred.y });
      if (ring > 0) {
        tries.push({ x: preferred.x + col * STEP, y: preferred.y + ring * STEP });
        tries.push({ x: preferred.x + col * STEP, y: preferred.y - ring * STEP });
      }
    }
    for (const point of tries) {
      if (free(point.x, point.y)) return point;
    }
  }
  return { x: preferred.x + STEP * 8, y: preferred.y + STEP * 4 };
}
