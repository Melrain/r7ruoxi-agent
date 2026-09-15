import { assetKindOf } from "@/components/film/canvas/lib/agent-catalog";
import type { AppEdge, AppNode, AssetKind, EdgeKind } from "@/components/film/canvas/types/project";

export function decorateCanvasEdge(edge: AppEdge, nodes: AppNode[]) {
  const isOut = edge.data?.edgeKind === "out";
  const src = nodes.find((n) => n.id === edge.source);
  const tgt = nodes.find((n) => n.id === edge.target);
  const kind = isOut ? assetKindOf(tgt) : assetKindOf(src);
  const running =
    src?.data.status === "running" || src?.data.status === "uploading" || tgt?.data.status === "running" || tgt?.data.status === "uploading";

  return {
    ...edge,
    type: "topology" as const,
    data: {
      ...edge.data,
      edgeKind: (edge.data?.edgeKind ?? (isOut ? "out" : "in")) as EdgeKind,
      running,
      labelKind: kind as AssetKind | undefined,
    },
  };
}
