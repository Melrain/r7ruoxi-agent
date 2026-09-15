import { uid } from "@/components/film/canvas/lib/ids";
import type { AppEdge, AppNode, NodeKind } from "@/components/film/canvas/types/project";

export interface GraphSnapshot {
  nodes: AppNode[];
  edges: AppEdge[];
}

export interface ClipboardPayload {
  nodes: AppNode[];
  edges: AppEdge[];
}

export type ContextMenuKind = "pane" | "node" | "edge";

export interface ContextMenuState {
  x: number;
  y: number;
  kind: ContextMenuKind;
  targetId?: string;
  flowX?: number;
  flowY?: number;
}

export interface AddMenuState {
  x: number;
  y: number;
  flowX: number;
  flowY: number;
}

export function cloneGraph(nodes: AppNode[], edges: AppEdge[]): GraphSnapshot {
  return {
    nodes: structuredClone(nodes),
    edges: structuredClone(edges),
  };
}

export function selectionClipboard(
  nodes: AppNode[],
  edges: AppEdge[],
  selectedIds: string[],
  options?: { withEdges?: boolean }
): ClipboardPayload | null {
  const selected = new Set(selectedIds);
  const clippedNodes = nodes.filter((n) => selected.has(n.id));
  if (clippedNodes.length === 0) return null;
  const clippedEdges =
    options?.withEdges === false
      ? []
      : edges.filter(
          (e) => selected.has(e.source) && selected.has(e.target)
        );
  return {
    nodes: structuredClone(clippedNodes),
    edges: structuredClone(clippedEdges),
  };
}

export function pasteClipboard(
  clipboard: ClipboardPayload,
  origin: { x: number; y: number }
): { nodes: AppNode[]; edges: AppEdge[]; ids: string[] } {
  const idMap = new Map<string, string>();
  const minX = Math.min(...clipboard.nodes.map((n) => n.position.x));
  const minY = Math.min(...clipboard.nodes.map((n) => n.position.y));

  const nodes = clipboard.nodes.map((node) => {
    const nextId = uid(node.data.kind);
    idMap.set(node.id, nextId);
    return {
      ...node,
      id: nextId,
      selected: true,
      position: {
        x: origin.x + (node.position.x - minX),
        y: origin.y + (node.position.y - minY),
      },
    };
  });

  const edges = clipboard.edges.flatMap((edge) => {
    const source = idMap.get(edge.source);
    const target = idMap.get(edge.target);
    if (!source || !target) return [];
    return [
      {
        ...edge,
        id: `e_${source}_${target}_${uid("e")}`,
        source,
        target,
      },
    ];
  });

  return { nodes, edges, ids: nodes.map((n) => n.id) };
}

export type AddMenuSection = "asset" | "agent" | "resource";

export type AddMenuItem = {
  id: string;
  label: string;
  kind?: NodeKind;
  agentId?: import("@/components/film/canvas/types/project").AgentId;
  badge?: string;
  stub?: boolean;
  section: AddMenuSection;
};

export const ADD_MENU_ITEMS: AddMenuItem[] = [
  { id: "text", label: "文本", kind: "text", section: "asset" },
  { id: "image", label: "图片", kind: "image", section: "asset" },
  { id: "video", label: "视频", kind: "video", section: "asset" },
  { id: "audio", label: "音频", kind: "audio", section: "asset" },
  { id: "file", label: "文件", kind: "file", section: "asset" },
  { id: "agent-parse", label: "视频解析", agentId: "parse", section: "agent" },
  { id: "agent-write", label: "写一份合同", section: "agent" },
  { id: "agent-script", label: "生成剧本", agentId: "script", section: "agent" },
  { id: "agent-storyboard", label: "拆分镜", agentId: "storyboard", section: "agent" },
  { id: "agent-scene", label: "场景", agentId: "scene", section: "agent" },
  { id: "agent-character", label: "角色/资产", agentId: "character", section: "agent" },
  { id: "agent-image", label: "出图", agentId: "image", section: "agent" },
  { id: "agent-video", label: "出视频", agentId: "video", section: "agent" },
  { id: "upload", label: "上传", stub: true, section: "resource" },
  { id: "history", label: "从生成历史选择", stub: true, section: "resource" },
];

export const ADD_NODE_GROUPS: {
  id: string;
  label: string;
  items: { kind: NodeKind; hint: string }[];
}[] = [
  { id: "text", label: "文本", items: [{ kind: "text", hint: "提示词 / 剧本正文" }] },
  { id: "image", label: "图片", items: [{ kind: "image", hint: "参考图或分镜静帧" }] },
  { id: "video", label: "视频", items: [{ kind: "video", hint: "镜头成片" }] },
  { id: "audio", label: "音频", items: [{ kind: "audio", hint: "对白 / 配乐" }] },
  { id: "script", label: "脚本", items: [{ kind: "script", hint: "分镜表（可批量出图出片）" }] },
];
