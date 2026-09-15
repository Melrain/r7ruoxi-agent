import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import { create } from "zustand";
import {
  type AddMenuState,
  type ClipboardPayload,
  type ContextMenuState,
  type GraphSnapshot,
  cloneGraph,
  pasteClipboard,
  selectionClipboard,
} from "@/components/film/canvas/lib/graph-ops";
import { uid } from "@/components/film/canvas/lib/ids";
import {
  assetKindOf,
  composeEffectiveRunPrompt,
  connectRejectReason,
  getAgentSpec,
  isAgentNode,
  isAssetKind,
  isAssetNode,
  missingInputs,
  missingSlots,
  specOf,
} from "@/components/film/canvas/lib/agent-catalog";
import { KIND_LABEL } from "@/components/film/canvas/lib/labels";
import { findClearPosition, layoutGraph, nextFreePosition, sizeForKind } from "@/components/film/canvas/lib/layout";
import { mockScriptFromPrompt, runInference, runRowJob } from "@/components/film/canvas/lib/mock/inference";
import {
  analyzeCanvasVideoReference,
  mapCanvasAnalyzeError,
} from "@/components/film/canvas/lib/canvas-analyze";
import {
  extractTextAssetsFromScript,
  kindForTextAssetRole,
} from "@/components/film/canvas/lib/extract-text-assets";
import { studioErrorMessage } from "@/lib/api/client";
import { generateImage } from "@/lib/api/recruit";
import { toBrowserMediaUrl } from "@/lib/media-url";
import { defaultModelId } from "@/components/film/canvas/lib/mock/models";
import { fallbackPoster } from "@/components/film/canvas/lib/mock/assets";
import {
  clearProject,
  createProjectMeta,
  deleteProjectMeta,
  ensureProjectLibrary,
  listProjects,
  loadProjectDoc,
  renameProjectMeta,
  saveProject,
  saveProjectDoc,
} from "@/components/film/canvas/lib/mock/persist";
import { createEmptyDoc, emptyNodeData } from "@/components/film/canvas/lib/mock/seed";
import type { StarterCard } from "@/components/film/canvas/lib/mock/starters";
import type {
  AgentId,
  AgentMessage,
  AppEdge,
  AppNode,
  AssetKind,
  CanvasNodeData,
  NodeKind,
  ProjectDoc,
  ProjectMeta,
  ScriptRow,
  ViewMode,
} from "@/components/film/canvas/types/project";

const HISTORY_LIMIT = 50;

export interface ProjectState extends ProjectDoc {
  viewMode: ViewMode;
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  agentOpen: boolean;
  storyboardDetailId: string | null;
  zoom: number;
  agentMessages: AgentMessage[];
  fitViewToken: number;
  zoomResetToken: number;
  addMenuOpen: boolean;
  addMenu: AddMenuState | null;
  assetLibraryOpen: boolean;
  createAgentDraft: { flowX: number; flowY: number } | null;
  contextMenu: ContextMenuState | null;
  clipboard: ClipboardPayload | null;
  past: GraphSnapshot[];
  future: GraphSnapshot[];
  lastAddNodeType: NodeKind | null;
  shortcutsOpen: boolean;
  handTool: boolean;
  renamingNodeId: string | null;
  focusPromptToken: number;
  detailNodeId: string | null;
  toast: string | null;
  showMinimap: boolean;
  showStarfield: boolean;
  hideEdges: boolean;
  snapToGrid: boolean;
  connectingFromId: string | null;
  projectId: string | null;
  projectList: ProjectMeta[];
}

export interface ProjectActions {
  hydrateFromStorage: () => void;
  resetDemo: () => void;
  setWorkspaceTitle: (title: string) => void;
  setCanvasName: (name: string) => void;
  setViewMode: (mode: ViewMode) => void;
  setSelectedNodeIds: (ids: string[]) => void;
  setSelection: (nodeIds: string[], edgeIds?: string[]) => void;
  setStoryboardDetailId: (id: string | null) => void;
  toggleAgent: (open?: boolean) => void;
  setZoom: (zoom: number) => void;
  setAddMenuOpen: (open: boolean) => void;
  openAddMenu: (menu: AddMenuState) => void;
  closeAddMenu: () => void;
  setAssetLibraryOpen: (open: boolean) => void;
  openCreateAgent: (at: { flowX: number; flowY: number }) => void;
  closeCreateAgent: () => void;
  addCustomAgent: (
    contract: { label: string; accepts: AssetKind[]; emits: AssetKind },
    options?: { position?: { x: number; y: number } }
  ) => string | null;
  openContextMenu: (menu: ContextMenuState) => void;
  closeContextMenu: () => void;
  setShortcutsOpen: (open: boolean) => void;
  setHandTool: (on: boolean) => void;
  setRenamingNodeId: (id: string | null) => void;
  requestFitView: () => void;
  requestZoomReset: () => void;
  onNodesChange: (changes: NodeChange<AppNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<AppEdge>[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (
    kind: NodeKind,
    options?: {
      position?: { x: number; y: number };
      data?: Partial<CanvasNodeData>;
      select?: boolean;
      history?: boolean;
    }
  ) => string;
  addAgent: (
    agentId: AgentId,
    options?: {
      position?: { x: number; y: number };
      select?: boolean;
      history?: boolean;
    }
  ) => string;
  assignAgent: (assetId: string, agentId: AgentId) => string | null;
  runAgent: (agentNodeId: string) => Promise<void>;
  addStarter: (card: StarterCard) => string;
  updateNodeData: (id: string, patch: Partial<CanvasNodeData>) => void;
  updateScriptRow: (
    nodeId: string,
    rowId: string,
    patch: Partial<NonNullable<CanvasNodeData["scriptRows"]>[number]>
  ) => void;
  generateNode: (nodeId: string) => Promise<void>;
  /** 文字资产卡内出图：不旁挂 image 节点、不建出图智能体 */
  generateStickyImage: (nodeId: string) => Promise<void>;
  generateShotsFromScript: (scriptId: string) => Promise<void>;
  batchGenerateVideos: (scriptId: string) => Promise<void>;
  resetScriptRow: (scriptId: string, rowId: string) => void;
  applyAgentMessage: (text: string) => void;
  autoLayout: () => void;
  clearCanvas: () => void;
  deleteSelection: () => void;
  deleteEdge: (edgeId: string) => void;
  copySelection: (withEdges?: boolean) => void;
  pasteClipboardAt: (position?: { x: number; y: number }) => void;
  duplicateSelection: (withEdges: boolean) => void;
  groupSelection: () => void;
  ungroupSelection: () => void;
  undo: () => void;
  redo: () => void;
  focusNodeEditor: (nodeId: string) => void;
  openNodeDetail: (id: string) => void;
  closeNodeDetail: () => void;
  showToast: (message: string, options?: { durationMs?: number }) => void;
  setShowMinimap: (on: boolean) => void;
  setShowStarfield: (on: boolean) => void;
  setHideEdges: (on: boolean) => void;
  setSnapToGrid: (on: boolean) => void;
  setConnectingFrom: (id: string | null) => void;
  refreshProjectList: () => void;
  createEmptyProject: () => void;
  switchProject: (id: string) => void;
  renameCurrentProject: (title: string) => void;
  deleteCurrentProject: () => void;
}

export type ProjectStore = ProjectState & ProjectActions;


function isTextAssetCardNodeData(data: CanvasNodeData): boolean {
  if (data.assetRole === "character" || data.assetRole === "scene" || data.assetRole === "prop") {
    return true;
  }
  if (data.kind === "character" || data.kind === "scene") {
    return data.textAssetCard === true || Boolean(data.assetRole);
  }
  return data.textAssetCard === true;
}

function toDoc(state: ProjectState): ProjectDoc {
  return {
    version: 4,
    workspaceTitle: state.workspaceTitle,
    canvasName: state.canvasName,
    credits: state.credits,
    nodes: state.nodes,
    edges: state.edges,
  };
}

function uiDefaults(): Pick<
  ProjectState,
  | "viewMode"
  | "selectedNodeIds"
  | "selectedEdgeIds"
  | "agentOpen"
  | "storyboardDetailId"
  | "zoom"
  | "agentMessages"
  | "fitViewToken"
  | "zoomResetToken"
  | "addMenuOpen"
  | "addMenu"
  | "assetLibraryOpen"
  | "createAgentDraft"
  | "contextMenu"
  | "clipboard"
  | "past"
  | "future"
  | "lastAddNodeType"
  | "shortcutsOpen"
  | "handTool"
  | "renamingNodeId"
  | "focusPromptToken"
  | "detailNodeId"
  | "toast"
  | "showMinimap"
  | "showStarfield"
  | "hideEdges"
  | "snapToGrid"
  | "connectingFromId"
  | "projectId"
  | "projectList"
> {
  return {
    viewMode: "workflow",
    selectedNodeIds: [],
    selectedEdgeIds: [],
    agentOpen: false,
    storyboardDetailId: null,
    zoom: 100,
    agentMessages: [],
    fitViewToken: 0,
    zoomResetToken: 0,
    addMenuOpen: false,
    addMenu: null,
    assetLibraryOpen: false,
    createAgentDraft: null,
    contextMenu: null,
    clipboard: null,
    past: [],
    future: [],
    lastAddNodeType: null,
    shortcutsOpen: false,
    handTool: false,
    renamingNodeId: null,
    focusPromptToken: 0,
    detailNodeId: null,
    toast: null,
    showMinimap: true,
    showStarfield: false,
    hideEdges: false,
    snapToGrid: false,
    connectingFromId: null,
    projectId: null,
    projectList: [],
  };
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

function patchNode(
  nodes: AppNode[],
  id: string,
  patch: Partial<CanvasNodeData>
): AppNode[] {
  return nodes.map((node) =>
    node.id === id ? { ...node, data: { ...node.data, ...patch } } : node
  );
}

let persistTimer: ReturnType<typeof setTimeout> | undefined;

function sleepMs(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function connect(
  source: string,
  target: string,
  edgeKind: "in" | "out" = "in"
): AppEdge {
  return {
    id: `e_${source}_${target}_${uid("e")}`,
    source,
    target,
    type: "default",
    data: { edgeKind },
  };
}

function normalizeGraph(nodes: AppNode[], edges: AppEdge[]): {
  nodes: AppNode[];
  edges: AppEdge[];
} {
  const nextNodes = nodes.flatMap((node) => {
    const leftover = (node.data.kind as string) === "shotBreakdown" || (node.data.kind as string) === "smartEdit";
    if (leftover) return [];
    const role =
      node.data.kind === "agent" || node.data.role === "agent"
        ? ("agent" as const)
        : ("asset" as const);
    const catalog =
      role === "agent" ? getAgentSpec(node.data.agentId) : undefined;
    return [{
      ...node,
      selected: false,
      data: {
        ...node.data,
        role,
        // Keep catalog agent display names in sync (e.g. 解析 → 视频解析).
        ...(catalog ? { label: catalog.label } : null),
      },
    }];
  });
  const byId = new Map(nextNodes.map((node) => [node.id, node]));
  const nextEdges = edges.flatMap((edge) => {
    const src = byId.get(edge.source);
    const tgt = byId.get(edge.target);
    if (!src || !tgt) return [];
    const edgeKind =
      edge.data?.edgeKind ??
      (isAgentNode(src) && isAssetNode(tgt) ? "out" : "in");
    // Drop stale inbound edges that no longer match agent accepts (e.g. image→parse).
    if (edgeKind === "in" && connectRejectReason(src, tgt)) return [];
    return [{
      ...edge,
      type: edge.type === "bezier" ? "default" : edge.type,
      data: { ...edge.data, edgeKind },
    }];
  });
  return { nodes: nextNodes, edges: nextEdges };
}

function schedulePersist(state: ProjectState) {
  if (typeof window === "undefined") return;
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    const ok = saveProject(toDoc(state));
    if (!ok) {
      useProjectStore.getState().showToast("本地存不下，刷新后图会丢");
    }
  }, 600);
}

export const useProjectStore = create<ProjectStore>((set, get) => {
  const pushHistory = () => {
    const snap = cloneGraph(get().nodes, get().edges);
    set({
      past: [...get().past.slice(-(HISTORY_LIMIT - 1)), snap],
      future: [],
    });
  };

  return {
    ...createEmptyDoc(),
    ...uiDefaults(),

    hydrateFromStorage: () => {
      const lib = ensureProjectLibrary(createEmptyDoc());
      const graph = normalizeGraph(lib.doc.nodes, lib.doc.edges);
      const nodes = graph.nodes.map((n) =>
        n.data.status === "uploading"
          ? {
              ...n,
              data: {
                ...n.data,
                status: "idle" as const,
                progress: undefined,
              },
            }
          : n,
      );
      set({
        projectId: lib.currentId,
        projectList: lib.projects,
        workspaceTitle: lib.doc.workspaceTitle,
        canvasName: lib.doc.canvasName,
        credits: lib.doc.credits,
        nodes,
        edges: graph.edges,
      });
    },

    refreshProjectList: () => set({ projectList: listProjects() }),

    createEmptyProject: () => {
      const state = get();
      if (state.projectId) {
        const ok = saveProjectDoc(
          state.projectId,
          toDoc(state),
          state.workspaceTitle,
        );
        if (!ok) {
          get().showToast("本地存不下，刷新后图会丢");
          if (
            !window.confirm(
              "当前项目保存失败，仍要新建并丢弃未保存更改吗？",
            )
          ) {
            return;
          }
        }
      }
      const named =
        typeof window !== "undefined"
          ? window.prompt("项目名称", "未命名影片")
          : "未命名影片";
      if (named === null) return;
      const meta = createProjectMeta(named.trim() || "未命名影片");
      const empty: ProjectDoc = {
        ...createEmptyDoc(),
        workspaceTitle: meta.title,
        canvasName: meta.title,
        credits: state.credits,
        nodes: [],
        edges: [],
      };
      saveProjectDoc(meta.id, empty, meta.title);
      set({
        ...uiDefaults(),
        projectId: meta.id,
        projectList: listProjects(),
        workspaceTitle: meta.title,
        canvasName: meta.title,
        credits: state.credits,
        nodes: [],
        edges: [],
        fitViewToken: state.fitViewToken + 1,
      });
      get().showToast("已新建空画布");
    },

    switchProject: (id) => {
      if (!id || id === get().projectId) return;
      const state = get();
      if (state.projectId) {
        const ok = saveProjectDoc(
          state.projectId,
          toDoc(state),
          state.workspaceTitle,
        );
        if (!ok) {
          get().showToast("本地存不下，刷新后图会丢");
          if (
            !window.confirm(
              "当前项目保存失败，仍要切换并丢弃未保存更改吗？",
            )
          ) {
            return;
          }
        }
      }
      const doc = loadProjectDoc(id);
      if (!doc) {
        get().showToast("项目打不开");
        return;
      }
      const graph = normalizeGraph(doc.nodes, doc.edges);
      const nodes = graph.nodes.map((n) =>
        n.data.status === "uploading"
          ? {
              ...n,
              data: {
                ...n.data,
                status: "idle" as const,
                progress: undefined,
              },
            }
          : n,
      );
      // touch current + recent ordering
      saveProjectDoc(id, doc, doc.workspaceTitle);
      set({
        ...uiDefaults(),
        projectId: id,
        projectList: listProjects(),
        workspaceTitle: doc.workspaceTitle,
        canvasName: doc.canvasName,
        credits: doc.credits,
        nodes,
        edges: graph.edges,
        fitViewToken: state.fitViewToken + 1,
      });
    },

    renameCurrentProject: (title) => {
      const id = get().projectId;
      if (!id) return;
      const next = title.trim() || "未命名影片";
      renameProjectMeta(id, next);
      set({
        workspaceTitle: next,
        canvasName: next,
        projectList: listProjects(),
      });
    },

    deleteCurrentProject: () => {
      const id = get().projectId;
      if (!id) return;
      const list = listProjects();
      if (list.length <= 1) {
        get().showToast("至少保留一个项目");
        return;
      }
      const nextId = deleteProjectMeta(id);
      if (!nextId) {
        get().createEmptyProject();
        return;
      }
      const doc = loadProjectDoc(nextId);
      if (!doc) {
        get().createEmptyProject();
        return;
      }
      const graph = normalizeGraph(doc.nodes, doc.edges);
      set({
        ...uiDefaults(),
        projectId: nextId,
        projectList: listProjects(),
        workspaceTitle: doc.workspaceTitle,
        canvasName: doc.canvasName,
        credits: doc.credits,
        nodes: graph.nodes,
        edges: graph.edges,
        fitViewToken: get().fitViewToken + 1,
      });
      get().showToast("已删除项目");
    },

    resetDemo: () => {
      clearProject();
      const lib = ensureProjectLibrary(createEmptyDoc());
      set({
        ...createEmptyDoc(),
        ...uiDefaults(),
        projectId: lib.currentId,
        projectList: lib.projects,
        fitViewToken: get().fitViewToken + 1,
      });
    },

    setWorkspaceTitle: (workspaceTitle) => {
      set({ workspaceTitle });
      const id = get().projectId;
      if (id) renameProjectMeta(id, workspaceTitle);
      set({ projectList: listProjects() });
    },
    setCanvasName: (canvasName) => set({ canvasName }),
    setViewMode: (viewMode) => set({ viewMode }),
    setSelectedNodeIds: (selectedNodeIds) =>
      set({
        selectedNodeIds,
        storyboardDetailId: selectedNodeIds[0] ?? get().storyboardDetailId,
      }),
    setSelection: (selectedNodeIds, selectedEdgeIds = []) =>
      set({
        selectedNodeIds,
        selectedEdgeIds,
        storyboardDetailId: selectedNodeIds[0] ?? get().storyboardDetailId,
      }),
    setStoryboardDetailId: (storyboardDetailId) =>
      set({
        storyboardDetailId,
        selectedNodeIds: storyboardDetailId ? [storyboardDetailId] : [],
        nodes: get().nodes.map((n) => ({
          ...n,
          selected: n.id === storyboardDetailId,
        })),
      }),
    toggleAgent: (open) => set({ agentOpen: open ?? !get().agentOpen }),
    setZoom: (zoom) => set({ zoom }),
    setAddMenuOpen: (addMenuOpen) => set({ addMenuOpen, addMenu: addMenuOpen ? get().addMenu : null }),
    openAddMenu: (addMenu) =>
      set({ addMenu, addMenuOpen: true, contextMenu: null, assetLibraryOpen: false }),
    closeAddMenu: () => set({ addMenu: null, addMenuOpen: false }),
    setAssetLibraryOpen: (assetLibraryOpen) => set({ assetLibraryOpen }),
    openCreateAgent: (at) =>
      set({
        createAgentDraft: at,
        addMenu: null,
        addMenuOpen: false,
        contextMenu: null,
      }),
    closeCreateAgent: () => set({ createAgentDraft: null }),
    addCustomAgent: (contract, options) => {
      const accepts = contract.accepts.filter(isAssetKind);
      const emits = isAssetKind(contract.emits) ? contract.emits : null;
      if (!accepts.length || !emits) {
        get().showToast("合同要至少入一种，出恰好一种");
        return null;
      }
      const draft = get().createAgentDraft;
      const id = get().addNode("agent", {
        position: options?.position ?? (draft ? { x: draft.flowX, y: draft.flowY } : undefined),
        data: {
          role: "agent",
          agentId: uid("agent"),
          label: contract.label.trim() || "未命名智能体",
          accepts,
          emits,
          status: "idle",
        },
      });
      set({ createAgentDraft: null });
      return id;
    },
    openContextMenu: (contextMenu) =>
      set({ contextMenu, addMenu: null, addMenuOpen: false }),
    closeContextMenu: () => set({ contextMenu: null }),
    setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
    setHandTool: (handTool) => set({ handTool }),
    setRenamingNodeId: (renamingNodeId) => set({ renamingNodeId }),
    requestFitView: () => set({ fitViewToken: get().fitViewToken + 1 }),
    requestZoomReset: () => set({ zoomResetToken: get().zoomResetToken + 1 }),
    setShowMinimap: (showMinimap) => set({ showMinimap }),
    setShowStarfield: (showStarfield) => set({ showStarfield }),
    setHideEdges: (hideEdges) => set({ hideEdges }),
    setSnapToGrid: (snapToGrid) => set({ snapToGrid }),
    setConnectingFrom: (connectingFromId) => set({ connectingFromId }),
    showToast: (toast, options) => {
      const message = (toast ?? "").trim() || "操作失败，请重试";
      clearTimeout(toastTimer);
      set({ toast: message });
      const ms = options?.durationMs ?? (message.length > 24 ? 5200 : 2800);
      toastTimer = setTimeout(() => set({ toast: null }), ms);
    },
    openNodeDetail: (detailNodeId) =>
      set({
        detailNodeId,
        selectedNodeIds: [detailNodeId],
        storyboardDetailId: detailNodeId,
        nodes: get().nodes.map((n) => ({ ...n, selected: n.id === detailNodeId })),
        contextMenu: null,
        addMenu: null,
        addMenuOpen: false,
      }),
    closeNodeDetail: () => set({ detailNodeId: null }),

    onNodesChange: (changes) => {
      const current = get().nodes;
      // Only record remove if the node is still present — avoids a second
      // pushHistory after deleteSelection already removed it (undo would no-op).
      const removingExisting = changes.some(
        (change) =>
          change.type === "remove" && current.some((n) => n.id === change.id)
      );
      const dragEnded = changes.some(
        (change) => change.type === "position" && change.dragging === false
      );
      if (removingExisting || dragEnded) pushHistory();
      set({ nodes: applyNodeChanges(changes, current) });
    },
    onEdgesChange: (changes) => {
      const current = get().edges;
      const removingExisting = changes.some(
        (change) =>
          change.type === "remove" && current.some((e) => e.id === change.id)
      );
      if (removingExisting) pushHistory();
      set({ edges: applyEdgeChanges(changes, current) });
    },
    onConnect: (connection) => {
      if (!connection.source || !connection.target) return;
      const source = get().nodes.find((n) => n.id === connection.source);
      const target = get().nodes.find((n) => n.id === connection.target);
      const reason = connectRejectReason(source, target);
      if (reason) {
        get().showToast(reason);
        return;
      }
      const dup = get().edges.some(
        (edge) =>
          edge.source === connection.source &&
          edge.target === connection.target
      );
      if (dup) {
        get().showToast("已经连过了");
        return;
      }
      pushHistory();
      set({
        edges: addEdge(
          {
            ...connection,
            type: "default",
            data: { edgeKind: "in" },
          },
          get().edges
        ),
      });
    },

    addNode: (kind, options) => {
      const id = uid(kind);
      const selected = get().nodes.find((n) =>
        get().selectedNodeIds.includes(n.id)
      );
      const preferred =
        options?.position ??
        nextFreePosition(get().nodes, { x: 0, y: 0 }, selected);
      const position = findClearPosition(
        get().nodes,
        preferred,
        sizeForKind(kind)
      );
      const select = options?.select ?? true;
      if (options?.history !== false) pushHistory();
      const node: AppNode = {
        id,
        type: kind,
        position,
        selected: select,
        data: emptyNodeData(kind, {
          role: kind === "agent" ? "agent" : "asset",
          label: options?.data?.label ?? KIND_LABEL[kind],
          model: defaultModelId(kind),
          ...options?.data,
        }),
      };
      set({
        nodes: [
          ...get().nodes.map((n) => ({
            ...n,
            selected: select ? false : n.selected,
          })),
          node,
        ],
        selectedNodeIds: select ? [id] : get().selectedNodeIds,
        storyboardDetailId: select ? id : get().storyboardDetailId,
        addMenuOpen: false,
        addMenu: null,
        lastAddNodeType: kind,
        fitViewToken:
          select && !options?.position
            ? get().fitViewToken + 1
            : get().fitViewToken,
      });
      return id;
    },

    addAgent: (agentId, options) => {
      const spec = getAgentSpec(agentId);
      return get().addNode("agent", {
        position: options?.position,
        select: options?.select ?? true,
        history: options?.history,
        data: {
          role: "agent",
          agentId,
          label: spec?.label ?? "智能体",
          status: "idle",
        },
      });
    },

    assignAgent: (assetId, agentId) => {
      const asset = get().nodes.find((n) => n.id === assetId);
      const spec = getAgentSpec(agentId);
      if (!asset || !spec) return null;
      const kind = assetKindOf(asset);
      if (!kind || !spec.accepts.includes(kind)) {
        get().showToast(
          spec ? `${spec.label}不入这个资产` : "找不到智能体"
        );
        return null;
      }
      pushHistory();
      const agentNodeId = get().addAgent(agentId, {
        position: { x: asset.position.x + 320, y: asset.position.y },
        select: true,
        history: false,
      });
      set({
        edges: addEdge(connect(assetId, agentNodeId, "in"), get().edges),
        fitViewToken: get().fitViewToken + 1,
        contextMenu: null,
      });
      return agentNodeId;
    },

    runAgent: async (agentNodeId) => {
      const agent = get().nodes.find((n) => n.id === agentNodeId);
      const spec = specOf(agent);
      if (!agent || !spec || !isAgentNode(agent)) return;
      if (agent.data.status === "running") return;

      const inboundKinds: AssetKind[] = [];
      const inboundTexts: string[] = [];
      const valuesByKind: Partial<Record<AssetKind, string>> = {};
      for (const edge of get().edges) {
        if (edge.target !== agentNodeId) continue;
        if (edge.data?.edgeKind === "out") continue;
        const src = get().nodes.find((n) => n.id === edge.source);
        const kind = assetKindOf(src);
        if (!kind || !src) continue;
        inboundKinds.push(kind);
        const chunk = src.data.text || src.data.prompt || src.data.label;
        if (chunk) {
          inboundTexts.push(chunk);
          const prev = valuesByKind[kind];
          valuesByKind[kind] = prev ? `${prev}\n${chunk}` : chunk;
        } else if (!valuesByKind[kind]) {
          valuesByKind[kind] = src.data.label || KIND_LABEL[kind];
        }
      }
      const missing = missingInputs(spec, inboundKinds);
      if (missing.length > 0) {
        const need = missing.map((k) => KIND_LABEL[k]).join("、");
        get().showToast(
          inboundKinds.length === 0
            ? `${spec.label}还没连上输入（需要${need}）`
            : `${spec.label}只入${need}，当前连的对不上`,
        );
        return;
      }
      const slotGaps = missingSlots(spec, agent.data.promptOverride, inboundKinds);
      if (slotGaps.length > 0) {
        get().showToast(
          `缺槽：${slotGaps.map((s) => s.key).join("、")}，请先连上对应输入`
        );
        return;
      }

      for (const edge of get().edges) {
        if (edge.target !== agentNodeId) continue;
        if (edge.data?.edgeKind === "out") continue;
        const src = get().nodes.find((n) => n.id === edge.source);
        if (!src) continue;
        const kind = src.data.kind;
        const isUpload =
          kind === "file" ||
          kind === "image" ||
          kind === "video" ||
          kind === "audio";
        if (!isUpload) continue;
        if (src.data.assetId?.trim()) continue;
        const url = src.data.assetUrl?.trim() ?? "";
        const looksLocalUpload =
          url.startsWith("blob:") ||
          (url.startsWith("data:") && !url.startsWith("data:image/svg+xml"));
        // Persist may have stripped blob/data; success without durable id/url = dead upload.
        const strippedUpload =
          src.data.status === "success" &&
          !url.startsWith("http://") &&
          !url.startsWith("https://") &&
          !url.startsWith("/api/backend/") &&
          !url.startsWith("data:image/svg+xml");
        // Failed / in-flight cloud upload must not pretend to be a usable input.
        const badUploadState =
          src.data.status === "error" || src.data.status === "running" || src.data.status === "uploading";
        if (looksLocalUpload || strippedUpload || badUploadState) {
          const msg = "输入资产未入库（缺 assetId），请重新上传视频";
          get().updateNodeData(agentNodeId, {
            status: "error",
            errorMessage: msg,
          });
          get().showToast(msg, { durationMs: 5600 });
          return;
        }
      }

      // Parse: require inbound video with durable assetId (Nest reference id).
      if (spec.id === "parse") {
        const failParse = (raw: string) => {
          const msg =
            (raw ?? "").trim() || "视频解析失败，请重试或重新上传视频";
          get().updateNodeData(agentNodeId, {
            status: "error",
            errorMessage: msg,
          });
          get().showToast(msg, { durationMs: 5600 });
        };

        let videoAssetId: string | undefined;
        let videoFilmProjectId: string | undefined;
        let hasVideo = false;
        for (const edge of get().edges) {
          if (edge.target !== agentNodeId) continue;
          if (edge.data?.edgeKind === "out") continue;
          const src = get().nodes.find((n) => n.id === edge.source);
          if (!src || src.data.kind !== "video") continue;
          hasVideo = true;
          const id = src.data.assetId?.trim();
          if (id && !videoAssetId) {
            videoAssetId = id;
            videoFilmProjectId = src.data.filmProjectId?.trim() || undefined;
          }
        }
        if (!hasVideo) {
          failParse("视频解析需要连上已入库的视频节点");
          return;
        }
        if (!videoAssetId) {
          failParse("输入资产未入库（缺 assetId），请重新上传视频");
          return;
        }

        pushHistory();
        get().updateNodeData(agentNodeId, {
          status: "running",
          errorMessage: undefined,
        });

        // Ensure emit node early → 拆解卡骨架（scriptRows 列表，非空黑块）
        const ensureParseOut = (): string => {
          const existingOut = get().edges.find(
            (e) => e.source === agentNodeId && e.data?.edgeKind === "out"
          );
          let outId = existingOut?.target;
          if (!outId || !get().nodes.some((n) => n.id === outId)) {
            outId = get().addNode(spec.emits, {
              position: {
                x: agent.position.x + 320,
                y: agent.position.y,
              },
              select: false,
              history: false,
              data: {
                role: "asset",
                label: "拆解",
                status: "running",
                text: "",
                scriptRows: [],
              },
            });
            set({
              edges: addEdge(connect(agentNodeId, outId, "out"), get().edges),
            });
          } else {
            get().updateNodeData(outId, {
              label: "拆解",
              status: "running",
              errorMessage: undefined,
              scriptRows: get().nodes.find((n) => n.id === outId)?.data.scriptRows ?? [],
            });
          }
          return outId;
        };

        const outId = ensureParseOut();
        try {
          const analyzed = await analyzeCanvasVideoReference(
            videoAssetId,
            { filmProjectId: videoFilmProjectId },
          );
          const { text, scriptRows } = analyzed;
          get().updateNodeData(outId, {
            label: "拆解",
            status: "success",
            text,
            scriptRows,
            errorMessage: undefined,
          });
          get().updateNodeData(agentNodeId, {
            status: "success",
            errorMessage: undefined,
          });
          get().showToast("解析完成 · 正在写剧本", { durationMs: 3000 });

          // —— 第3刀：无感续写剧本 + 挂文字资产（勿弹交给）——
          const parseAgent = get().nodes.find((n) => n.id === agentNodeId);
          const breakdownNode = get().nodes.find((n) => n.id === outId);
          if (!parseAgent || !breakdownNode) return;

          // Ensure / create 「生成剧本」智能体，并挂上拆解 → script
          let scriptAgentId: string | undefined;
          for (const edge of get().edges) {
            if (edge.source !== outId) continue;
            if (edge.data?.edgeKind === "out") continue;
            const tgt = get().nodes.find((n) => n.id === edge.target);
            if (tgt && isAgentNode(tgt) && tgt.data.agentId === "script") {
              scriptAgentId = tgt.id;
              break;
            }
          }
          if (!scriptAgentId) {
            scriptAgentId = get().addAgent("script", {
              position: {
                x: breakdownNode.position.x + 360,
                y: breakdownNode.position.y,
              },
              select: false,
              history: false,
            });
            set({
              edges: addEdge(connect(outId, scriptAgentId, "in"), get().edges),
            });
          }

          get().updateNodeData(scriptAgentId, {
            status: "running",
            errorMessage: undefined,
          });

          const ensureScriptOut = (): string => {
            const scriptAgent = get().nodes.find((n) => n.id === scriptAgentId);
            const existingScriptOut = get().edges.find((e) => {
              if (e.source !== scriptAgentId || e.data?.edgeKind !== "out") return false;
              const tgt = get().nodes.find((n) => n.id === e.target);
              return tgt?.data.kind === "script";
            });
            let scriptOutId = existingScriptOut?.target;
            if (!scriptOutId || !get().nodes.some((n) => n.id === scriptOutId)) {
              scriptOutId = get().addNode("script", {
                position: {
                  x: (scriptAgent?.position.x ?? breakdownNode.position.x + 360) + 320,
                  y: scriptAgent?.position.y ?? breakdownNode.position.y,
                },
                select: false,
                history: false,
                data: {
                  role: "asset",
                  label: "剧本",
                  status: "running",
                  text: "",
                },
              });
              set({
                edges: addEdge(
                  connect(scriptAgentId!, scriptOutId, "out"),
                  get().edges,
                ),
              });
            } else {
              get().updateNodeData(scriptOutId, {
                label: "剧本",
                status: "running",
                errorMessage: undefined,
              });
            }
            return scriptOutId;
          };

          const scriptOutId = ensureScriptOut();

          try {
            await sleepMs(420);
            const nest = analyzed.script;
            const usedNest = Boolean(nest?.body?.trim());
            const body = nest?.body?.trim()
              ? nest.body.trim()
              : mockScriptFromPrompt(text || "拆解");
            const title =
              (nest?.title?.trim() || "") ||
              body.split("\n").map((l) => l.trim()).find((l) => l.startsWith("《")) ||
              "剧本";
            const scriptText = body.includes(title) ? body : `${title}\n${body}`;

            get().updateNodeData(scriptOutId, {
              label: title.replace(/[《》]/g, "").slice(0, 24) || "剧本",
              status: "success",
              text: scriptText,
              errorMessage: undefined,
            });
            get().updateNodeData(scriptAgentId, {
              status: "success",
              errorMessage: undefined,
            });
            get().showToast(
              usedNest
                ? "剧本就绪 · 正在挂资产"
                : "剧本就绪（mock 兜底）· 正在挂资产",
              { durationMs: 3000 },
            );

            // 抽文字资产：勿假数据
            try {
              const assets = extractTextAssetsFromScript(scriptText);
              if (assets.length === 0) {
                get().showToast("未抽出文字资产（文中无明确角色/场景/道具）", {
                  durationMs: 3600,
                });
                return;
              }

              const scriptNode = get().nodes.find((n) => n.id === scriptOutId);
              const baseX =
                (scriptNode?.position.x ?? breakdownNode.position.x) + 360;
              const baseY = scriptNode?.position.y ?? breakdownNode.position.y;

              // 清掉本 script agent 先前挂的文字资产出边（重跑不堆）
              const staleAssetIds: string[] = [];
              for (const edge of get().edges) {
                if (edge.source !== scriptAgentId || edge.data?.edgeKind !== "out") continue;
                const tgt = get().nodes.find((n) => n.id === edge.target);
                if (!tgt) continue;
                if (tgt.data.kind === "script") continue;
                if (tgt.data.textAssetCard || tgt.data.assetRole) {
                  staleAssetIds.push(tgt.id);
                }
              }
              if (staleAssetIds.length) {
                const drop = new Set(staleAssetIds);
                set({
                  nodes: get().nodes.filter((n) => !drop.has(n.id)),
                  edges: get().edges.filter(
                    (e) => !drop.has(e.source) && !drop.has(e.target),
                  ),
                });
              }

              let hung = 0;
              for (let i = 0; i < assets.length; i++) {
                const item = assets[i]!;
                const kind = kindForTextAssetRole(item.role);
                const assetId = get().addNode(kind, {
                  position: {
                    x: baseX + (i % 3) * 220,
                    y: baseY + Math.floor(i / 3) * 240,
                  },
                  select: false,
                  history: false,
                  data: {
                    role: "asset",
                    label: item.title,
                    status: "success",
                    text: item.description,
                    assetRole: item.role,
                    textAssetCard: true,
                  },
                });
                set({
                  edges: addEdge(
                    connect(scriptAgentId!, assetId, "out"),
                    get().edges,
                  ),
                });
                hung += 1;
                if (i < assets.length - 1) await sleepMs(160);
              }
              get().showToast(`已挂 ${hung} 张文字资产`, { durationMs: 3000 });
            } catch (assetCaught) {
              const msg =
                assetCaught instanceof Error && assetCaught.message.trim()
                  ? assetCaught.message.trim()
                  : "挂文字资产失败";
              get().showToast(msg, { durationMs: 5600 });
              // 停在资产步：剧本已成功，不假成功下游
            }
          } catch (scriptCaught) {
            const msg =
              scriptCaught instanceof Error && scriptCaught.message.trim()
                ? scriptCaught.message.trim()
                : "写剧本失败，可从拆解后重跑";
            get().updateNodeData(scriptOutId, {
              status: "error",
              errorMessage: msg,
            });
            get().updateNodeData(scriptAgentId, {
              status: "error",
              errorMessage: msg,
            });
            get().showToast(msg, { durationMs: 5600 });
            // 停在剧本步，不继续挂资产
          }
        } catch (caught) {
          const msg = mapCanvasAnalyzeError(caught);
          get().updateNodeData(outId, {
            label: "拆解",
            status: "error",
            errorMessage: msg,
            // Keep prior rows if any; do not invent fake shots.
          });
          failParse(msg);
        }
        return;
      }

      pushHistory();
      const prompt = composeEffectiveRunPrompt(
        spec,
        agent.data.promptOverride,
        valuesByKind,
        inboundTexts.join("\n") || spec.label
      );
      get().updateNodeData(agentNodeId, {
        status: "running",
        errorMessage: undefined,
        prompt,
      });
      try {
        const result = await runInference({
          nodeId: agentNodeId,
          kind: spec.emits,
          prompt,
          model: agent.data.model,
        });
        const text =
          spec.emits === "script" ||
          spec.emits === "scene" ||
          spec.emits === "character"
            ? mockScriptFromPrompt(prompt)
            : result.text;
        const scriptRows: ScriptRow[] | undefined =
          spec.emits === "storyboard"
            ? [
                {
                  id: "row_s01",
                  shotId: "S01",
                  duration: "3s",
                  visualDesc: "开场钩子，近景",
                  dialogue: "就这一笔。",
                  selected: true,
                  rowStatus: "success",
                },
                {
                  id: "row_s02",
                  shotId: "S02",
                  duration: "4s",
                  visualDesc: "转入新世界",
                  dialogue: "（鼓点）",
                  selected: true,
                  rowStatus: "success",
                },
                {
                  id: "row_s03",
                  shotId: "S03",
                  duration: "5s",
                  visualDesc: prompt.slice(0, 24) || "高潮镜头",
                  dialogue: "这一笔，改写山河。",
                  selected: true,
                  rowStatus: "success",
                },
              ]
            : result.scriptRows;
        const assetUrl =
          spec.emits === "image" || spec.emits === "video" || spec.emits === "audio"
            ? result.assetUrl ?? fallbackPoster(spec.emits, prompt)
            : result.assetUrl;

        const existingOut = get().edges.find(
          (e) => e.source === agentNodeId && e.data?.edgeKind === "out"
        );
        let outId = existingOut?.target;
        if (!outId || !get().nodes.some((n) => n.id === outId)) {
          outId = get().addNode(spec.emits, {
            position: {
              x: agent.position.x + 320,
              y: agent.position.y,
            },
            select: false,
            history: false,
            data: {
              role: "asset",
              label: KIND_LABEL[spec.emits],
              status: "success",
              text: text ?? "",
              prompt,
              assetUrl,
              scriptRows,
            },
          });
          set({
            edges: addEdge(connect(agentNodeId, outId, "out"), get().edges),
          });
        } else {
          get().updateNodeData(outId, {
            status: "success",
            text: text ?? "",
            prompt,
            assetUrl,
            scriptRows,
            errorMessage: undefined,
          });
        }
        get().updateNodeData(agentNodeId, { status: "success" });
        get().showToast(`${spec.label}已出${KIND_LABEL[spec.emits]}`);
      } catch {
        get().updateNodeData(agentNodeId, {
          status: "error",
          errorMessage: "演示推理中断，请重试",
        });
      }
    },

    clearCanvas: () => {
      pushHistory();
      set({
        nodes: [],
        edges: [],
        selectedNodeIds: [],
        selectedEdgeIds: [],
        storyboardDetailId: null,
      });
    },

    addStarter: (card) => {
      return get().addNode(card.kind, {
        data: {
          label: card.label,
          prompt: card.prompt,
          status: "idle",
        },
        select: true,
      });
    },

    updateNodeData: (id, patch) => {
      set({ nodes: patchNode(get().nodes, id, patch) });
    },

    updateScriptRow: (nodeId, rowId, patch) => {
      const node = get().nodes.find((n) => n.id === nodeId);
      if (!node?.data.scriptRows) return;
      set({
        nodes: patchNode(get().nodes, nodeId, {
          scriptRows: node.data.scriptRows.map((row) =>
            row.id === rowId ? { ...row, ...patch } : row
          ),
        }),
      });
    },

    generateNode: async (nodeId) => {
      const node = get().nodes.find((n) => n.id === nodeId);
      if (!node || !node.data.prompt.trim()) return;
      get().updateNodeData(nodeId, { status: "running", errorMessage: undefined });
      try {
        const result = await runInference({
          nodeId,
          kind: node.data.kind,
          prompt: node.data.prompt,
          model: node.data.model,
          aspect: node.data.aspect,
          duration: node.data.duration,
        });
        get().updateNodeData(nodeId, {
          status: result.status,
          assetUrl: result.assetUrl ?? node.data.assetUrl,
          text: result.text ?? node.data.text,
          errorMessage: result.errorMessage,
        });
      } catch {
        get().updateNodeData(nodeId, {
          status: "error",
          errorMessage: "演示推理中断，请重试",
        });
      }
    },

    /** 第4刀：文字资产卡内出图，结果写本卡字段，严禁旁挂 image 节点 */
    generateStickyImage: async (nodeId) => {
      const node = get().nodes.find((n) => n.id === nodeId);
      if (!node || !isTextAssetCardNodeData(node.data)) return;
      if (node.data.imageStatus === "running") return;

      const title = (node.data.label || "").trim();
      const body = (node.data.text || node.data.prompt || "").trim();
      const prompt = [title, body].filter(Boolean).join("\n") || "便签出图";

      get().updateNodeData(nodeId, {
        imageStatus: "running",
        imageError: undefined,
      });

      try {
        const result = await generateImage({ prompt, count: 1 });
        const output = result.outputs[0];
        if (!output) {
          throw new Error("后端没有返回图片");
        }
        const assetUrl =
          toBrowserMediaUrl(output.url, output.s3Key) ?? output.url ?? undefined;
        if (!assetUrl && !output.s3Key) {
          throw new Error("后端返回的媒体缺少地址");
        }
        // 再读一次，避免并发写覆盖其它字段
        const still = get().nodes.find((n) => n.id === nodeId);
        if (!still) return;
        get().updateNodeData(nodeId, {
          imageStatus: "success",
          imageError: undefined,
          assetUrl: assetUrl || still.data.assetUrl,
          assetId: output.assetId ?? still.data.assetId,
          s3Key: output.s3Key?.trim() || still.data.s3Key,
        });
      } catch (caught) {
        const msg = studioErrorMessage(caught) || "出图失败，可重试";
        get().updateNodeData(nodeId, {
          imageStatus: "error",
          imageError: msg,
        });
        get().showToast(msg, { durationMs: 5600 });
      }
    },

    generateShotsFromScript: async (scriptId) => {
      const script = get().nodes.find((n) => n.id === scriptId);
      const rows = script?.data.scriptRows?.filter((r) => r.selected) ?? [];
      if (!script || rows.length === 0) return;
      pushHistory();

      for (const [index, row] of rows.entries()) {
        const existing = get().nodes.find(
          (n) => n.data.sourceRowId === row.id && n.data.kind === "image"
        );
        const id =
          existing?.id ??
          get().addNode("image", {
            position: {
              x: script.position.x + 360,
              y: script.position.y + index * 210,
            },
            data: {
              label: `分镜 ${row.shotId}`,
              prompt: row.visualDesc,
              shotId: row.shotId,
              sourceScriptId: scriptId,
              sourceRowId: row.id,
            },
            select: false,
          });
        if (!get().edges.some((e) => e.source === scriptId && e.target === id)) {
          set({
            edges: addEdge(connect(scriptId, id), get().edges),
          });
        }
        get().updateNodeData(id, { prompt: row.visualDesc, status: "running" });
        await get().generateNode(id);
        const image = get().nodes.find((n) => n.id === id);
        get().updateScriptRow(scriptId, row.id, {
          imageAssetUrl: image?.data.assetUrl,
        });
      }
    },

    batchGenerateVideos: async (scriptId) => {
      const script = get().nodes.find((n) => n.id === scriptId);
      const rows = script?.data.scriptRows?.filter((r) => r.selected) ?? [];
      if (!script || rows.length === 0) return;
      pushHistory();

      const failIndex = rows.length > 1 ? 1 : 0;
      for (const [index, row] of rows.entries()) {
        get().updateScriptRow(scriptId, row.id, {
          rowStatus: "running",
          errorMessage: undefined,
        });
        const result = await runRowJob(index === failIndex);
        if (result.status === "error") {
          get().updateScriptRow(scriptId, row.id, {
            rowStatus: "error",
            errorMessage: result.errorMessage,
          });
          continue;
        }

        const existing = get().nodes.find(
          (n) => n.data.sourceRowId === row.id && n.data.kind === "video"
        );
        const id =
          existing?.id ??
          get().addNode("video", {
            position: {
              x: script.position.x + 720,
              y: script.position.y + index * 210,
            },
            data: {
              label: `成片 ${row.shotId}`,
              prompt: row.visualDesc,
              shotId: row.shotId,
              sourceScriptId: scriptId,
              sourceRowId: row.id,
              duration: row.duration,
              assetUrl: result.assetUrl,
              status: "success",
            },
            select: false,
          });
        get().updateNodeData(id, {
          assetUrl: result.assetUrl,
          status: "success",
          prompt: row.visualDesc,
        });
        if (!get().edges.some((e) => e.source === scriptId && e.target === id)) {
          set({
            edges: addEdge(connect(scriptId, id), get().edges),
          });
        }
        get().updateScriptRow(scriptId, row.id, {
          rowStatus: "success",
          videoAssetUrl: result.assetUrl,
        });
      }
    },

    resetScriptRow: (scriptId, rowId) => {
      get().updateScriptRow(scriptId, rowId, {
        rowStatus: "idle",
        errorMessage: undefined,
        videoAssetUrl: undefined,
      });
    },

    applyAgentMessage: (text) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const user: AgentMessage = {
        id: uid("m"),
        role: "user",
        content: trimmed,
        createdAt: Date.now(),
      };
      set({ agentMessages: [...get().agentMessages, user], agentOpen: true });
      pushHistory();

      const origin = nextFreePosition(get().nodes, { x: 40, y: 80 });
      const ids: string[] = [];

      const add = (
        kind: NodeKind,
        position: { x: number; y: number },
        data: Partial<CanvasNodeData>
      ) => {
        const id = get().addNode(kind, { position, data, select: false });
        ids.push(id);
        return id;
      };

      const topic = trimmed.slice(0, 24);
      if (trimmed.includes("三视图") || trimmed.includes("角色")) {
        add("text", origin, {
          label: "角色设定",
          prompt: trimmed,
          text: `角色小传\n${trimmed}\n正 / 侧 / 背三视图，统一灯光。`,
          status: "success",
        });
        add(
          "image",
          { x: origin.x + 340, y: origin.y },
          {
            label: "角色三视图",
            prompt: `${topic} 三视图，白底，统一比例`,
          }
        );
        add(
          "image",
          { x: origin.x + 340, y: origin.y + 220 },
          {
            label: "表情差分",
            prompt: `${topic} 表情三格：冷、怒、笑`,
          }
        );
      } else if (trimmed.includes("音频") || trimmed.includes("配乐")) {
        const a = add("audio", origin, {
          label: "音频轨",
          prompt: trimmed,
        });
        const v = add(
          "video",
          { x: origin.x + 340, y: origin.y },
          {
            label: "音频生视频",
            prompt: `跟随音频节奏：${topic}`,
          }
        );
        set({
          edges: addEdge(connect(a, v), get().edges),
        });
      } else {
        const t = add("text", origin, {
          label: "Agent 剧本",
          prompt: trimmed,
          text: `【Agent 落图】\n${trimmed}\n\n已写成可编辑节点，而不是聊天记录。`,
          status: "success",
        });
        const i = add(
          "image",
          { x: origin.x + 340, y: origin.y },
          {
            label: "参考图",
            prompt: `${topic}，电影感静帧，16:9`,
          }
        );
        const v = add(
          "video",
          { x: origin.x + 680, y: origin.y },
          {
            label: "成片",
            prompt: `由参考图生成 5 秒镜头：${topic}`,
            duration: "5s",
          }
        );
        set({
          edges: addEdge(connect(i, v), addEdge(connect(t, i), get().edges)),
        });
      }

      const assistant: AgentMessage = {
        id: uid("m"),
        role: "assistant",
        content: `已把「${topic}」写成 ${ids.length} 个可编辑节点并连上边。图是唯一真相——去画布里改提示词或点生成。`,
        createdAt: Date.now(),
      };
      set({
        agentMessages: [...get().agentMessages, assistant],
        selectedNodeIds: ids.slice(0, 1),
        nodes: get().nodes.map((n) => ({ ...n, selected: n.id === ids[0] })),
        storyboardDetailId: ids[0] ?? null,
        viewMode: "workflow",
        fitViewToken: get().fitViewToken + 1,
      });
    },

    autoLayout: () => {
      pushHistory();
      set({
        nodes: layoutGraph(get().nodes, get().edges),
        fitViewToken: get().fitViewToken + 1,
        contextMenu: null,
      });
    },

    deleteSelection: () => {
      const nodeIds = new Set(get().selectedNodeIds);
      const edgeIds = new Set(get().selectedEdgeIds);
      if (nodeIds.size === 0 && edgeIds.size === 0) return;
      pushHistory();
      const detailNodeId = get().detailNodeId;
      const storyboardDetailId = get().storyboardDetailId;
      set({
        nodes: get().nodes.filter((n) => !nodeIds.has(n.id)),
        edges: get().edges.filter(
          (e) =>
            !edgeIds.has(e.id) &&
            !nodeIds.has(e.source) &&
            !nodeIds.has(e.target)
        ),
        selectedNodeIds: [],
        selectedEdgeIds: [],
        contextMenu: null,
        // Keep shortcuts usable after delete; stale detail id blocked ⌘Z.
        detailNodeId:
          detailNodeId && nodeIds.has(detailNodeId) ? null : detailNodeId,
        storyboardDetailId:
          storyboardDetailId && nodeIds.has(storyboardDetailId)
            ? null
            : storyboardDetailId,
        renamingNodeId: null,
      });
      get().showToast("已删除，⌘Z / Ctrl+Z 撤销");
    },

    deleteEdge: (edgeId) => {
      pushHistory();
      set({
        edges: get().edges.filter((e) => e.id !== edgeId),
        selectedEdgeIds: get().selectedEdgeIds.filter((id) => id !== edgeId),
        contextMenu: null,
      });
    },

    copySelection: (withEdges = false) => {
      const payload = selectionClipboard(
        get().nodes,
        get().edges,
        get().selectedNodeIds,
        { withEdges }
      );
      if (!payload) return;
      set({ clipboard: payload, contextMenu: null });
    },

    duplicateSelection: (withEdges) => {
      const payload = selectionClipboard(
        get().nodes,
        get().edges,
        get().selectedNodeIds,
        { withEdges }
      );
      if (!payload) return;
      const origin = nextFreePosition(get().nodes, { x: 40, y: 40 });
      const pasted = pasteClipboard(payload, {
        x: origin.x + 36,
        y: origin.y + 36,
      });
      pushHistory();
      set({
        nodes: [
          ...get().nodes.map((n) => ({ ...n, selected: false })),
          ...pasted.nodes,
        ],
        edges: [...get().edges, ...pasted.edges],
        selectedNodeIds: pasted.ids,
        contextMenu: null,
      });
    },

    pasteClipboardAt: (position) => {
      const clipboard = get().clipboard;
      if (!clipboard) return;
      const origin =
        position ??
        nextFreePosition(get().nodes, { x: 40, y: 40 });
      const pasted = pasteClipboard(clipboard, origin);
      pushHistory();
      set({
        nodes: [
          ...get().nodes.map((n) => ({ ...n, selected: false })),
          ...pasted.nodes,
        ],
        edges: [...get().edges, ...pasted.edges],
        selectedNodeIds: pasted.ids,
        contextMenu: null,
      });
    },

    groupSelection: () => {
      const ids = get().selectedNodeIds;
      if (ids.length < 2) return;
      const groupId = uid("g");
      pushHistory();
      set({
        nodes: get().nodes.map((n) =>
          ids.includes(n.id)
            ? { ...n, data: { ...n.data, groupId } }
            : n
        ),
        contextMenu: null,
      });
    },

    ungroupSelection: () => {
      const ids = new Set(get().selectedNodeIds);
      if (ids.size === 0) return;
      pushHistory();
      set({
        nodes: get().nodes.map((n) =>
          ids.has(n.id)
            ? { ...n, data: { ...n.data, groupId: undefined } }
            : n
        ),
        contextMenu: null,
      });
    },

    undo: () => {
      const { past, future, nodes, edges, detailNodeId } = get();
      if (past.length === 0) return;
      const prev = past[past.length - 1];
      const detailStillThere =
        detailNodeId != null && prev.nodes.some((n) => n.id === detailNodeId);
      set({
        past: past.slice(0, -1),
        future: [...future, cloneGraph(nodes, edges)],
        nodes: prev.nodes,
        edges: prev.edges,
        selectedNodeIds: [],
        selectedEdgeIds: [],
        detailNodeId: detailStillThere ? detailNodeId : null,
        contextMenu: null,
        addMenu: null,
        addMenuOpen: false,
      });
    },

    redo: () => {
      const { past, future, nodes, edges, detailNodeId } = get();
      if (future.length === 0) return;
      const next = future[future.length - 1];
      const detailStillThere =
        detailNodeId != null && next.nodes.some((n) => n.id === detailNodeId);
      set({
        future: future.slice(0, -1),
        past: [...past, cloneGraph(nodes, edges)],
        nodes: next.nodes,
        edges: next.edges,
        selectedNodeIds: [],
        selectedEdgeIds: [],
        detailNodeId: detailStillThere ? detailNodeId : null,
        contextMenu: null,
        addMenu: null,
        addMenuOpen: false,
      });
    },

    focusNodeEditor: (nodeId) => {
      const node = get().nodes.find((n) => n.id === nodeId);
      if (!node) return;
      set({
        selectedNodeIds: [nodeId],
        storyboardDetailId: nodeId,
        detailNodeId: nodeId,
        nodes: get().nodes.map((n) => ({ ...n, selected: n.id === nodeId })),
        focusPromptToken: get().focusPromptToken + 1,
        viewMode: "workflow",
        contextMenu: null,
      });
    },
  };
});

if (typeof window !== "undefined") {
  useProjectStore.subscribe((state) => schedulePersist(state));
}

export function useSelectedNode(): AppNode | undefined {
  return useProjectStore((s) => {
    const id = s.selectedNodeIds[0];
    return s.nodes.find((n) => n.id === id);
  });
}
