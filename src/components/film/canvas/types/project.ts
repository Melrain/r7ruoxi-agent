import type { Edge, Node } from "@xyflow/react";

export type AssetKind =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "file"
  | "script"
  | "storyboard"
  | "scene"
  | "character";

export type CatalogAgentId =
  | "parse"
  | "script"
  | "storyboard"
  | "scene"
  | "character"
  | "image"
  | "video";

export type AgentId = CatalogAgentId | string;

export type NodeKind = AssetKind | "agent";

export type NodeRole = "asset" | "agent";

export type EdgeKind = "in" | "out";

export type NodeStatus = "idle" | "uploading" | "running" | "success" | "error";

export type ViewMode = "workflow" | "storyboard";

/** Prompt slot binding: pulls from a connected asset kind, or project meta. */
export interface AgentPromptSlot {
  key: string;
  from: AssetKind | "meta";
  required?: boolean;
}

export interface AgentPrompts {
  system: string;
  userTemplate: string;
  slots: AgentPromptSlot[];
  preview?: string;
}

/** Per-node override of catalog prompts; restore clears this field. */
export type AgentPromptOverride = Partial<AgentPrompts>;

export interface ScriptRow {
  id: string;
  shotId: string;
  duration: string;
  visualDesc: string;
  dialogue: string;
  selected: boolean;
  rowStatus: NodeStatus;
  errorMessage?: string;
  videoAssetUrl?: string;
  imageAssetUrl?: string;
}

export interface CanvasNodeData extends Record<string, unknown> {
  role: NodeRole;
  kind: NodeKind;
  agentId?: AgentId;
  accepts?: AssetKind[];
  emits?: AssetKind;
  label: string;
  status: NodeStatus;
  prompt: string;
  model: string;
  aspect: string;
  duration: string;
  text: string;
  assetUrl?: string;
  /**
   * 入库 id：优先 film.reference（analyze 兼容）；否则全局 Asset.id。
   * 资产库选用时若有 film_reference Link 则写入 refId。
   */
  assetId?: string;
  /** Nest FilmProject id（双写 meta / 旧 library）；analyze 时作 preferredProjectId。 */
  filmProjectId?: string;
  errorMessage?: string;
  /** Short UI progress line, e.g. 上传中… */
  progress?: string;
  scriptRows?: ScriptRow[];
  shotId?: string;
  sourceScriptId?: string;
  sourceRowId?: string;
  groupId?: string;
  /** Catalog prompt override for agent nodes; cleared by 「恢复目录默认」. */
  promptOverride?: AgentPromptOverride;
  /** 文字资产卡角色：角色|场景|道具（区别于拆解镜号卡）。 */
  assetRole?: "character" | "scene" | "prop";
  /** 显式标记为文字资产便签卡（character/scene 也可走 TextAssetCardNode）。 */
  textAssetCard?: boolean;
  /** 卡内出图状态（与节点文案 status 独立，多卡可并行）。 */
  imageStatus?: NodeStatus;
  /** 卡内出图短错；额度/鉴权失败时给人话。 */
  imageError?: string;
  /** Nest/R2 object key；配合 toBrowserMediaUrl 读预览。 */
  s3Key?: string;
}

export type AppNode = Node<CanvasNodeData, NodeKind>;
export type AppEdge = Edge<{ edgeKind?: EdgeKind }>;

export interface AgentMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
}

export interface ProjectMeta {
  id: string;
  title: string;
  updatedAt: number;
}

export interface ProjectDoc {
  version: 4;
  workspaceTitle: string;
  canvasName: string;
  credits: number;
  nodes: AppNode[];
  edges: AppEdge[];
}

export interface InferenceRequest {
  nodeId: string;
  kind: NodeKind;
  prompt: string;
  model: string;
  aspect?: string;
  duration?: string;
}

export interface InferenceResult {
  status: "success" | "error";
  assetUrl?: string;
  /** Server-side asset id (Nest+R2); prefer over blob URLs when available. */
  assetId?: string;
  text?: string;
  scriptRows?: ScriptRow[];
  errorMessage?: string;
}

export interface MockModel {
  id: string;
  label: string;
  kinds: NodeKind[];
  hint: string;
}
