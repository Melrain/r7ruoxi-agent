import {
  isAgentNode,
  isAssetNode,
  isSkillNode,
  type ConnectHandles,
} from "@/components/film/canvas/lib/agent-catalog";
import type { AppEdge, AppNode } from "@/components/film/canvas/types/project";

export type SideHandles = {
  sourceHandle: string;
  targetHandle: string;
};

/**
 * L/R only: pick the nearer side pair from node X positions.
 * Target to the right → source-right + target-left; target to the left → opposite.
 */
export function nearestSideHandles(
  source: AppNode,
  target: AppNode,
  kind: "skill" | "asset"
): SideHandles {
  const targetOnRight = target.position.x >= source.position.x;
  if (kind === "skill") {
    return targetOnRight
      ? { sourceHandle: "out", targetHandle: "skill" }
      : { sourceHandle: "out-l", targetHandle: "skill-r" };
  }
  return targetOnRight
    ? { sourceHandle: "out", targetHandle: "in" }
    : { sourceHandle: "out-l", targetHandle: "in-r" };
}

/**
 * Rewrite connection handles for Skill/Asset → Agent so edges always use the
 * nearest valid L/R ports (ignores which handle the pointer hit).
 */
export function resolveConnectionHandles(
  source: AppNode | undefined,
  target: AppNode | undefined,
  handles?: ConnectHandles
): ConnectHandles {
  if (!source || !target) {
    return {
      sourceHandle: handles?.sourceHandle ?? null,
      targetHandle: handles?.targetHandle ?? null,
    };
  }
  if (isSkillNode(source) && isAgentNode(target)) {
    return nearestSideHandles(source, target, "skill");
  }
  if (isAssetNode(source) && isAgentNode(target)) {
    return nearestSideHandles(source, target, "asset");
  }
  return {
    sourceHandle: handles?.sourceHandle ?? null,
    targetHandle: handles?.targetHandle ?? null,
  };
}

/** Recompute sourceHandle/targetHandle for inbound Skill/Asset → Agent edges. */
export function recomputeEdgeSideHandles(
  nodes: AppNode[],
  edges: AppEdge[]
): AppEdge[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  let changed = false;
  const next = edges.map((edge) => {
    if (edge.data?.edgeKind === "out") return edge;
    const source = byId.get(edge.source);
    const target = byId.get(edge.target);
    if (!source || !target || !isAgentNode(target)) return edge;
    let sides: SideHandles | null = null;
    if (isSkillNode(source)) sides = nearestSideHandles(source, target, "skill");
    else if (isAssetNode(source)) sides = nearestSideHandles(source, target, "asset");
    if (!sides) return edge;
    if (
      edge.sourceHandle === sides.sourceHandle &&
      edge.targetHandle === sides.targetHandle
    ) {
      return edge;
    }
    changed = true;
    return {
      ...edge,
      sourceHandle: sides.sourceHandle,
      targetHandle: sides.targetHandle,
    };
  });
  return changed ? next : edges;
}
