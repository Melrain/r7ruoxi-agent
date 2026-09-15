import { defaultModelId } from "@/components/film/canvas/lib/mock/models";
import type {
  AgentId,
  AppEdge,
  AppNode,
  AssetKind,
  CanvasNodeData,
  EdgeKind,
  NodeKind,
  NodeRole,
  ProjectDoc,
} from "@/components/film/canvas/types/project";

function roleOf(kind: NodeKind): NodeRole {
  if (kind === "agent") return "agent";
  if (kind === "skill") return "skill";
  return "asset";
}

function data(
  kind: NodeKind,
  partial: Partial<CanvasNodeData>
): CanvasNodeData {
  return {
    role: partial.role ?? roleOf(kind),
    kind,
    label: partial.label ?? "节点",
    status: partial.status ?? "idle",
    prompt: partial.prompt ?? "",
    model: partial.model ?? defaultModelId(kind),
    aspect: partial.aspect ?? "16:9",
    duration: partial.duration ?? (kind === "video" ? "5s" : ""),
    text: partial.text ?? "",
    ...partial,
  };
}

const _SEED_TEXT = `《我在盛唐写下天下》
类型：古风 / 穿越 / 爽文漫剧
时长建议：60–90秒
基调：热血 × 盛唐史诗感 × 爽点节奏
【序幕】现代深夜办公室。
【转折】墨迹化开，坠入长安夜市。
【高潮】城墙上写下《天下》。`;

function _asset(
  id: string,
  kind: AssetKind,
  position: { x: number; y: number },
  partial: Partial<CanvasNodeData>
): AppNode {
  return {
    id,
    type: kind,
    position,
    data: data(kind, { role: "asset", ...partial }),
  };
}

function _agent(
  id: string,
  agentId: AgentId,
  label: string,
  position: { x: number; y: number }
): AppNode {
  return {
    id,
    type: "agent",
    position,
    data: data("agent", {
      role: "agent",
      agentId,
      label,
      status: "success",
    }),
  };
}

function _edge(
  id: string,
  source: string,
  target: string,
  edgeKind: EdgeKind
): AppEdge {
  return { id, source, target, type: "default", data: { edgeKind } };
}

/** Empty canvas — no demo nodes/edges. */
export function createEmptyDoc(): ProjectDoc {
  return {
    version: 4,
    workspaceTitle: "未命名影片",
    canvasName: "画布 1",
    credits: 100,
    nodes: [],
    edges: [],
  };
}

/** @deprecated Prefer createEmptyDoc — demo seed removed. */
export function createSeedDoc(): ProjectDoc {
  return createEmptyDoc();
}

export function emptyNodeData(
  kind: NodeKind,
  overrides: Partial<CanvasNodeData> = {}
): CanvasNodeData {
  return data(kind, overrides);
}

void _SEED_TEXT
void _asset
void _agent
void _edge
