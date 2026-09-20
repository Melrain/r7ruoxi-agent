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
  isSkillNode,
  resolveEquippedSkill,
  skillAssembleRejectReason,
  isAssetKind,
  isAssetNode,
  missingInputs,
  missingSlots,
  specOf,
} from "@/components/film/canvas/lib/agent-catalog";
import {
  nearestSideHandles,
  recomputeEdgeSideHandles,
  resolveConnectionHandles,
} from "@/components/film/canvas/lib/nearest-handles";
import { KIND_LABEL } from "@/components/film/canvas/lib/labels";
import { findClearPosition, layoutGraph, nextFreePosition, sizeForKind } from "@/components/film/canvas/lib/layout";
import {
  analyzeCanvasVideoReference,
  mapCanvasAnalyzeError,
} from "@/components/film/canvas/lib/canvas-analyze";
import {
  collectInboundVisionAssetIds,
  scriptRowsFromBreakdown,
} from "@/components/film/canvas/lib/canvas-write";
import {
  extractTextAssetsFromScript,
  kindForTextAssetRole,
} from "@/components/film/canvas/lib/extract-text-assets";
import { isAbortError, studioErrorMessage, StudioApiError } from "@/lib/api/client";
import {
  requireFilmScriptBody,
  storyboardRowsFromProject,
  writeFilmScript,
  writeFilmStoryboard,
} from "@/lib/api/film-write";
import { generateImage } from "@/lib/api/recruit";
import { toBrowserMediaUrl } from "@/lib/media-url";
import { createFilmRunToken, stillMine } from "@/lib/film-race";
import {
  FILM_DIRECTOR_SKELETON_AGENTS,
  FILM_SIX_LOOP_LABELS,
  missingDirectorSkeletonAgents,
  nextFilmSixLoop,
  type FilmSixLoopId,
} from "@/lib/film-six-loop";
import {
  FILM_THREE_VIEW_LABELS,
  FILM_THREE_VIEWS,
  isCharacterAssetCard,
  makeupLockedReason,
  storyboardThreeViewGate,
  writeMakeupLocked,
  type FilmThreeViewId,
} from "@/lib/film-makeup-gate";
import { defaultModelId } from "@/components/film/canvas/lib/mock/models";
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
  skillLibraryOpen: boolean;
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
  makeupLocked: boolean;
  runEpoch: number;
  assetLibraryMode: "library" | "filmOnly";
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
  setSkillLibraryOpen: (open: boolean) => void;
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
  assignSkill: (skillNodeId: string, agentId: AgentId) => string | null;
  runAgent: (agentNodeId: string) => Promise<void>;
  /** Abort in-flight run and clear running UI (parse/agent + emit nodes). */
  cancelAgentRun: (agentNodeId: string) => void;
  /** 导演补六环骨架（缺的智能体/空产出卡）。 */
  fillDirectorSkeleton: () => void;
  /** 六环 run-next：只跑下一未完成环，不假装成功。 */
  runNext: () => Promise<void>;
  dismissStickyImage: (nodeId: string) => void;
  cancelStickyImage: (nodeId: string) => void;
  setAssetLibraryMode: (mode: "library" | "filmOnly") => void;
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
    makeupLocked: state.makeupLocked,
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
  | "skillLibraryOpen"
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
  | "makeupLocked"
  | "runEpoch"
  | "assetLibraryMode"
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
    skillLibraryOpen: false,
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
    makeupLocked: false,
    runEpoch: 0,
    assetLibraryMode: "library",
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

/** In-flight parse/agent AbortControllers — cancel clears FE running + aborts fetch. */
const agentRunAbortById = new Map<string, AbortController>();
const imageRunAbortById = new Map<string, AbortController>();

function abortAllInFlightRuns() {
  for (const ac of agentRunAbortById.values()) ac.abort();
  agentRunAbortById.clear();
  for (const ac of imageRunAbortById.values()) ac.abort();
  imageRunAbortById.clear();
}

function clearStaleRunningNodes<T extends {
  data: {
    status?: string;
    errorMessage?: string;
    imageStatus?: string;
    imageError?: string;
    imageRunId?: string;
    threeViews?: AppNode["data"]["threeViews"];
  };
}>(nodes: T[]): T[] {
  return nodes.map((n) => {
    const staleNode = n.data.status === "running" || n.data.status === "uploading";
    const staleImage = n.data.imageStatus === "running";
    const views = n.data.threeViews;
    let nextViews = views;
    if (views) {
      nextViews = { ...views };
      for (const key of FILM_THREE_VIEWS) {
        if (nextViews[key]?.status === "running") {
          nextViews[key] = {
            ...nextViews[key],
            status: "idle",
            error: "上次出图中断，可重试",
          };
        }
      }
    }
    if (!staleNode && !staleImage && nextViews === views) return n;
    return {
      ...n,
      data: {
        ...n.data,
        ...(staleNode
          ? {
              status: "idle" as const,
              progress: undefined,
              errorMessage:
                n.data.status === "running"
                  ? "上次生成中断（刷新或超时后状态卡住），请重试"
                  : n.data.errorMessage,
            }
          : {}),
        ...(staleImage
          ? {
              imageStatus: "idle" as const,
              imageError: "上次出图中断（刷新或超时后状态卡住），可关闭或重试",
              imageRunId: undefined,
            }
          : {}),
        ...(nextViews !== views ? { threeViews: nextViews } : {}),
      },
    };
  });
}

function resolveCanvasNestProjectId(nodes: AppNode[]): string | undefined {
  for (const node of nodes) {
    const id = node.data.filmProjectId?.trim();
    if (id) return id;
  }
  return undefined;
}

function failClosedMessage(label: string) {
  return `${label}后端尚未接线，无法假装成功`;
}


function connect(
  source: string,
  target: string,
  edgeKind: "in" | "out" = "in",
  handles?: { sourceHandle?: string | null; targetHandle?: string | null }
): AppEdge {
  return {
    id: `e_${source}_${target}_${uid("e")}`,
    source,
    target,
    sourceHandle: handles?.sourceHandle ?? undefined,
    targetHandle: handles?.targetHandle ?? undefined,
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
        : node.data.kind === "skill" || node.data.role === "skill"
          ? ("skill" as const)
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
      abortAllInFlightRuns();
      const lib = ensureProjectLibrary(createEmptyDoc());
      const graph = normalizeGraph(lib.doc.nodes, lib.doc.edges);
      const nodes = clearStaleRunningNodes(graph.nodes);
      set({
        projectId: lib.currentId,
        projectList: lib.projects,
        workspaceTitle: lib.doc.workspaceTitle,
        canvasName: lib.doc.canvasName,
        credits: lib.doc.credits,
        nodes,
        edges: graph.edges,
        makeupLocked: Boolean(lib.doc.makeupLocked),
        runEpoch: get().runEpoch + 1,
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
      abortAllInFlightRuns();
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
        makeupLocked: false,
        runEpoch: state.runEpoch + 1,
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
      const nodes = clearStaleRunningNodes(graph.nodes);
      // touch current + recent ordering
      abortAllInFlightRuns();
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
        makeupLocked: Boolean(doc.makeupLocked),
        runEpoch: state.runEpoch + 1,
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
      abortAllInFlightRuns();
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
        makeupLocked: Boolean(doc.makeupLocked),
        runEpoch: get().runEpoch + 1,
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
      set({ addMenu, addMenuOpen: true, contextMenu: null, assetLibraryOpen: false, skillLibraryOpen: false }),
    closeAddMenu: () => set({ addMenu: null, addMenuOpen: false }),
    setAssetLibraryOpen: (assetLibraryOpen) => set({ assetLibraryOpen, skillLibraryOpen: assetLibraryOpen ? false : get().skillLibraryOpen }),
    setSkillLibraryOpen: (skillLibraryOpen) => set({ skillLibraryOpen, assetLibraryOpen: skillLibraryOpen ? false : get().assetLibraryOpen }),
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
      const positionChanging = changes.some((change) => change.type === "position");
      if (removingExisting || dragEnded) pushHistory();
      const nextNodes = applyNodeChanges(changes, current);
      if (positionChanging) {
        set({
          nodes: nextNodes,
          edges: recomputeEdgeSideHandles(nextNodes, get().edges),
        });
      } else {
        set({ nodes: nextNodes });
      }
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

      // Nearest L/R ports from node positions (Skill/Asset → Agent).
      const resolved = resolveConnectionHandles(source, target, {
        sourceHandle: connection.sourceHandle ?? null,
        targetHandle: connection.targetHandle ?? null,
      });
      const sourceHandle = resolved.sourceHandle ?? null;
      const targetHandle = resolved.targetHandle ?? null;

      const reason = connectRejectReason(source, target, {
        sourceHandle,
        targetHandle,
      });
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

      let nextEdges = get().edges;
      // 单 Skill 刀：智能体已装配时再连另一张 → 静默替换 + toast（对标 canvas-workspace）
      if (source && target && isSkillNode(source) && isAgentNode(target)) {
        const existingSkillEdges = nextEdges.filter((edge) => {
          if (edge.target !== target.id || edge.data?.edgeKind === "out") return false;
          const src = get().nodes.find((n) => n.id === edge.source);
          return isSkillNode(src);
        });
        if (existingSkillEdges.length > 0) {
          const oldSrc = get().nodes.find(
            (n) => n.id === existingSkillEdges[0].source,
          );
          const oldName = (
            oldSrc?.data.skillTitle ||
            oldSrc?.data.label ||
            "旧 Skill"
          ).trim();
          const newName = (
            source.data.skillTitle ||
            source.data.label ||
            "新 Skill"
          ).trim();
          const drop = new Set(existingSkillEdges.map((e) => e.id));
          nextEdges = nextEdges.filter((e) => !drop.has(e.id));
          get().showToast(`已替换装配：${oldName} → ${newName}`);
        }
      }

      pushHistory();
      const nextConnection: Connection = {
        ...connection,
        source: connection.source,
        target: connection.target,
        sourceHandle,
        targetHandle,
      };
      set({
        edges: addEdge(
          {
            ...nextConnection,
            id: `e_${connection.source}_${connection.target}_${uid("e")}`,
            type: "default",
            data: { edgeKind: "in" as const },
          },
          nextEdges
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
          role:
            kind === "agent" ? "agent" : kind === "skill" ? "skill" : "asset",
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
        edges: addEdge(
          connect(
            assetId,
            agentNodeId,
            "in",
            nearestSideHandles(asset, get().nodes.find((n) => n.id === agentNodeId)!, "asset")
          ),
          get().edges
        ),
        fitViewToken: get().fitViewToken + 1,
        contextMenu: null,
      });
      return agentNodeId;
    },

    assignSkill: (skillNodeId, agentId) => {
      const skill = get().nodes.find((n) => n.id === skillNodeId);
      const spec = getAgentSpec(agentId);
      if (!skill || !isSkillNode(skill) || !spec) {
        get().showToast("找不到 Skill 或智能体");
        return null;
      }
      const ghostAgent = {
        id: "__skill_assign_ghost__",
        type: "agent" as const,
        position: { x: 0, y: 0 },
        data: {
          role: "agent" as const,
          kind: "agent" as const,
          agentId,
          label: spec.label,
          accepts: spec.accepts,
          emits: spec.emits,
          status: "idle" as const,
          prompt: "",
          model: "",
          aspect: "16:9",
          duration: "",
          text: "",
        },
      };
      const reject = skillAssembleRejectReason(skill, ghostAgent as AppNode);
      if (reject) {
        get().showToast(reject);
        return null;
      }

      // Prefer an existing assemblable agent on canvas (avoid "wrong target" new spawn)
      const existingAgent = get().nodes.find(
        (n) =>
          isAgentNode(n) &&
          n.data.agentId === agentId &&
          skillAssembleRejectReason(skill, n) === null,
      );

      if (existingAgent) {
        const already = get().edges.some(
          (edge) =>
            edge.source === skillNodeId &&
            edge.target === existingAgent.id &&
            edge.data?.edgeKind !== "out",
        );
        if (already) {
          get().showToast("已经装配过了");
          return existingAgent.id;
        }
      }

      pushHistory();
      let agentNodeId: string;
      let nextEdges = get().edges;
      let replacedToast: string | null = null;

      if (existingAgent) {
        agentNodeId = existingAgent.id;
        const existingSkillEdges = nextEdges.filter((edge) => {
          if (edge.target !== agentNodeId || edge.data?.edgeKind === "out") {
            return false;
          }
          const src = get().nodes.find((n) => n.id === edge.source);
          return isSkillNode(src);
        });
        if (existingSkillEdges.length > 0) {
          const oldSrc = get().nodes.find(
            (n) => n.id === existingSkillEdges[0].source,
          );
          const oldName = (
            oldSrc?.data.skillTitle ||
            oldSrc?.data.label ||
            "旧 Skill"
          ).trim();
          const newName = (
            skill.data.skillTitle ||
            skill.data.label ||
            "新 Skill"
          ).trim();
          const drop = new Set(existingSkillEdges.map((e) => e.id));
          nextEdges = nextEdges.filter((e) => !drop.has(e.id));
          replacedToast = `已替换装配：${oldName} → ${newName}`;
        }
      } else {
        agentNodeId = get().addAgent(agentId, {
          position: { x: skill.position.x + 280, y: skill.position.y },
          select: true,
          history: false,
        });
        nextEdges = get().edges;
      }

      // Drop prior edges from this skill to other agents (single assembly)
      nextEdges = nextEdges.filter((edge) => {
        if (edge.source !== skillNodeId || edge.data?.edgeKind === "out") {
          return true;
        }
        const tgt = get().nodes.find((n) => n.id === edge.target);
        return !(tgt && isAgentNode(tgt) && edge.target !== agentNodeId);
      });

      const agentNode = get().nodes.find((n) => n.id === agentNodeId)!;
      const skillNode = get().nodes.find((n) => n.id === skillNodeId) ?? skill;
      set({
        edges: addEdge(
          connect(
            skillNodeId,
            agentNodeId,
            "in",
            nearestSideHandles(skillNode, agentNode, "skill")
          ),
          nextEdges
        ),
        fitViewToken: get().fitViewToken + 1,
        contextMenu: null,
        selectedNodeIds: [agentNodeId],
      });
      get().showToast(replacedToast ?? `已装配到${spec.label}`);
      return agentNodeId;
    },

    cancelAgentRun: (agentNodeId) => {
      const ac = agentRunAbortById.get(agentNodeId);
      if (ac) {
        ac.abort();
        agentRunAbortById.delete(agentNodeId);
      }
      const agent = get().nodes.find((n) => n.id === agentNodeId);
      if (!agent || !isAgentNode(agent)) return;
      get().updateNodeData(agentNodeId, {
        status: "idle",
        errorMessage: undefined,
      });
      for (const edge of get().edges) {
        if (edge.source !== agentNodeId || edge.data?.edgeKind !== "out") continue;
        const out = get().nodes.find((n) => n.id === edge.target);
        if (!out) continue;
        if (out.data.status === "running") {
          get().updateNodeData(out.id, {
            status: "idle",
            errorMessage: undefined,
          });
        }
      }
      get().showToast("已取消生成", { durationMs: 2400 });
    },

    fillDirectorSkeleton: () => {
      const missing = missingDirectorSkeletonAgents(get().nodes);
      if (missing.length === 0) return;
      const rightmost = get().nodes.reduce(
        (max, n) => Math.max(max, n.position.x),
        80,
      );
      const baseY =
        get().nodes.find((n) => isAgentNode(n) && n.data.agentId === "parse")
          ?.position.y ?? 80;
      let offset = 0;
      for (const agentId of FILM_DIRECTOR_SKELETON_AGENTS) {
        if (!missing.includes(agentId)) continue;
        get().addAgent(agentId, {
          position: { x: rightmost + 280 + offset * 240, y: baseY + offset * 40 },
          select: false,
          history: false,
        });
        offset += 1;
      }
      const byAgent = (id: string) =>
        get().nodes.find((n) => isAgentNode(n) && n.data.agentId === id);
      const outOf = (agentId: string, kind?: string) => {
        const agent = byAgent(agentId);
        if (!agent) return undefined;
        for (const edge of get().edges) {
          if (edge.source !== agent.id || edge.data?.edgeKind !== "out") continue;
          const tgt = get().nodes.find((n) => n.id === edge.target);
          if (!tgt) continue;
          if (kind && tgt.data.kind !== kind) continue;
          return tgt;
        }
        return undefined;
      };
      const ensureLink = (fromId: string, toId: string) => {
        if (get().edges.some((e) => e.source === fromId && e.target === toId)) return;
        const from = get().nodes.find((n) => n.id === fromId);
        const to = get().nodes.find((n) => n.id === toId);
        if (!from || !to) return;
        set({
          edges: addEdge(connect(fromId, toId, "in", nearestSideHandles(from, to, "asset")), get().edges),
        });
      };
      const parseOut = outOf("parse");
      const script = byAgent("script");
      if (parseOut && script) ensureLink(parseOut.id, script.id);
      const scriptOut = outOf("script", "script");
      const storyboard = byAgent("storyboard");
      if (scriptOut && storyboard) ensureLink(scriptOut.id, storyboard.id);
      const storyboardOut = outOf("storyboard", "storyboard");
      const image = byAgent("image");
      const video = byAgent("video");
      if (storyboardOut && image) ensureLink(storyboardOut.id, image.id);
      if (storyboardOut && video) ensureLink(storyboardOut.id, video.id);
      get().showToast(`已补导演骨架：${missing.map((id) => FILM_SIX_LOOP_LABELS[id === "parse" ? "parse" : id === "script" ? "script" : id === "storyboard" ? "storyboard" : id === "image" ? "image" : "video"]).join("、")}`);
    },

    runNext: async () => {
      const loop = nextFilmSixLoop(get().nodes, get().edges) as FilmSixLoopId | null;
      if (!loop) {
        get().showToast("六环已齐");
        return;
      }
      if (loop === "parse" || loop === "script" || loop === "storyboard") {
        const agent = get().nodes.find((n) => isAgentNode(n) && n.data.agentId === loop);
        if (!agent) {
          get().fillDirectorSkeleton();
          const again = get().nodes.find((n) => isAgentNode(n) && n.data.agentId === loop);
          if (!again) {
            get().showToast(`缺少${FILM_SIX_LOOP_LABELS[loop]}智能体`);
            return;
          }
          await get().runAgent(again.id);
          return;
        }
        if (agent.data.status === "running") return;
        await get().runAgent(agent.id);
        return;
      }
      if (loop === "assets") {
        const scriptOut = get().nodes.find(
          (n) => n.data.kind === "script" && (n.data.text || "").trim(),
        );
        const scriptText = scriptOut?.data.text?.trim() ?? "";
        if (!scriptText) {
          get().showToast("没有剧本文本，无法挂资产");
          return;
        }
        const scriptAgent = get().nodes.find((n) => isAgentNode(n) && n.data.agentId === "script");
        const assets = extractTextAssetsFromScript(scriptText);
        if (assets.length === 0) {
          get().showToast("未抽出文字资产（文中无明确角色/场景/道具）", { durationMs: 3600 });
          return;
        }
        const baseX = (scriptOut?.position.x ?? 0) + 360;
        const baseY = scriptOut?.position.y ?? 0;
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
          if (scriptAgent) {
            set({
              edges: addEdge(connect(scriptAgent.id, assetId, "out"), get().edges),
            });
          }
          hung += 1;
        }
        get().showToast(`已挂 ${hung} 张文字资产 · 角色请出三视后再写分镜`, { durationMs: 3600 });
        return;
      }
      get().showToast(failClosedMessage(FILM_SIX_LOOP_LABELS[loop]), { durationMs: 5600 });
    },

    dismissStickyImage: (nodeId) => {
      imageRunAbortById.get(nodeId)?.abort();
      imageRunAbortById.delete(nodeId);
      const node = get().nodes.find((n) => n.id === nodeId);
      if (!node) return;
      const views = node.data.threeViews;
      let nextViews = views;
      if (views) {
        nextViews = { ...views };
        for (const key of FILM_THREE_VIEWS) {
          if (nextViews[key]?.status === "running") {
            nextViews[key] = { ...nextViews[key], status: "idle", error: undefined };
          }
        }
      }
      get().updateNodeData(nodeId, {
        imageStatus: "idle",
        imageError: undefined,
        imageRunId: undefined,
        ...(nextViews ? { threeViews: nextViews } : {}),
      });
      get().showToast("已关闭卡住的出图中", { durationMs: 2400 });
    },

    cancelStickyImage: (nodeId) => {
      get().dismissStickyImage(nodeId);
    },

    setAssetLibraryMode: (mode) => set({ assetLibraryMode: mode }),

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
        const runAc = new AbortController();
        const epoch = get().runEpoch;
        const token = createFilmRunToken(get().projectId ?? "", agentNodeId);
        const mine = () =>
          stillMine(token, {
            projectId: get().projectId,
            runId: token.runId,
            aborted: runAc.signal.aborted || get().runEpoch !== epoch,
          });
        agentRunAbortById.get(agentNodeId)?.abort();
        agentRunAbortById.set(agentNodeId, runAc);
        try {
          const equipped = resolveEquippedSkill(
            agentNodeId,
            get().nodes,
            get().edges,
          );
          const resolvedSkillId =
            equipped?.skillId?.trim() ||
            agent.data.skillId?.trim() ||
            undefined;
          const analyzed = await analyzeCanvasVideoReference(
            videoAssetId,
            {
              filmProjectId: videoFilmProjectId,
              skillId: resolvedSkillId,
              promptSupplement: agent.data.promptSupplement,
              signal: runAc.signal,
            },
          );
          if (!mine()) return;
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
          get().fillDirectorSkeleton();
          get().showToast("解析完成 · 正在写剧本", { durationMs: 3000 });
          await get().runNext();
        } catch (caught) {
          if (!mine() || runAc.signal.aborted || isAbortError(caught)) {
            if (!mine()) return;
            get().updateNodeData(outId, {
              label: "拆解",
              status: "idle",
              errorMessage: undefined,
            });
            get().updateNodeData(agentNodeId, {
              status: "idle",
              errorMessage: undefined,
            });
          } else {
            const msg = mapCanvasAnalyzeError(caught);
            get().updateNodeData(outId, {
              label: "拆解",
              status: "error",
              errorMessage: msg,
            });
            failParse(msg);
          }
        } finally {
          if (agentRunAbortById.get(agentNodeId) === runAc) {
            agentRunAbortById.delete(agentNodeId);
          }
        }
        return;
      }

      const prompt = composeEffectiveRunPrompt(
        spec,
        agent.data.promptOverride,
        valuesByKind,
        inboundTexts.join("\n") || spec.label
      );
      const runAc = new AbortController();
      const epoch = get().runEpoch;
      const token = createFilmRunToken(get().projectId ?? "", agentNodeId);
      const mine = () =>
        stillMine(token, {
          projectId: get().projectId,
          runId: token.runId,
          aborted: runAc.signal.aborted || get().runEpoch !== epoch,
        });
      agentRunAbortById.get(agentNodeId)?.abort();
      agentRunAbortById.set(agentNodeId, runAc);
      pushHistory();
      get().updateNodeData(agentNodeId, {
        status: "running",
        errorMessage: undefined,
        prompt,
      });

      const ensureOut = (kind: typeof spec.emits, label: string) => {
        const existingOut = get().edges.find((e) => {
          if (e.source !== agentNodeId || e.data?.edgeKind !== "out") return false;
          const tgt = get().nodes.find((n) => n.id === e.target);
          return tgt?.data.kind === kind;
        });
        let outId = existingOut?.target;
        if (!outId || !get().nodes.some((n) => n.id === outId)) {
          outId = get().addNode(kind, {
            position: {
              x: agent.position.x + 320,
              y: agent.position.y,
            },
            select: false,
            history: false,
            data: {
              role: "asset",
              label,
              status: "running",
              text: "",
              prompt,
            },
          });
          set({
            edges: addEdge(connect(agentNodeId, outId, "out"), get().edges),
          });
        } else {
          get().updateNodeData(outId, {
            label,
            status: "running",
            errorMessage: undefined,
            prompt,
          });
        }
        return outId;
      };

      const failAgent = (outId: string | undefined, msg: string) => {
        if (outId) {
          get().updateNodeData(outId, { status: "error", errorMessage: msg });
        }
        get().updateNodeData(agentNodeId, { status: "error", errorMessage: msg });
        get().showToast(msg, { durationMs: 5600 });
      };

      try {
        if (spec.id === "script") {
          const outId = ensureOut("script", "剧本");
          const nestProjectId = resolveCanvasNestProjectId(get().nodes);
          if (!nestProjectId) {
            failAgent(outId, "画布没有关联影片项目，无法写剧本");
            return;
          }
          const inboundIds = get()
            .edges.filter((e) => e.target === agentNodeId && e.data?.edgeKind !== "out")
            .map((e) => e.source);
          const equipped = resolveEquippedSkill(agentNodeId, get().nodes, get().edges);
          const written = await writeFilmScript(
            nestProjectId,
            {
              skillId: equipped?.skillId ?? agent.data.skillId,
              promptSupplement: agent.data.promptSupplement,
              visionAssetIds: collectInboundVisionAssetIds(get().nodes, inboundIds),
            },
            { signal: runAc.signal },
          );
          if (!mine()) return;
          const script = requireFilmScriptBody(written);
          const title = script.title.replace(/[《》]/g, "").slice(0, 24) || "剧本";
          const scriptText = script.body.includes(script.title)
            ? script.body
            : `${script.title}\n${script.body}`;
          get().updateNodeData(outId, {
            label: title,
            status: "success",
            text: scriptText,
            errorMessage: undefined,
          });
          get().updateNodeData(agentNodeId, { status: "success", errorMessage: undefined });
          get().showToast("剧本就绪 · 可挂资产或跑下一步", { durationMs: 3000 });
          return;
        }

        if (spec.id === "storyboard") {
          const gate = storyboardThreeViewGate(get().nodes);
          if (!gate.ok) {
            get().updateNodeData(agentNodeId, {
              status: "error",
              errorMessage: gate.reason,
            });
            get().showToast(gate.reason, { durationMs: 5600 });
            return;
          }
          const outId = ensureOut("storyboard", "分镜");
          const nestProjectId = resolveCanvasNestProjectId(get().nodes);
          if (!nestProjectId) {
            failAgent(outId, "画布没有关联影片项目，无法写分镜");
            return;
          }
          const equipped = resolveEquippedSkill(agentNodeId, get().nodes, get().edges);
          const written = await writeFilmStoryboard(
            nestProjectId,
            {
              skillId: equipped?.skillId ?? agent.data.skillId,
              promptSupplement: agent.data.promptSupplement,
            },
            { signal: runAc.signal },
          );
          if (!mine()) return;
          const rows = scriptRowsFromBreakdown(storyboardRowsFromProject(written));
          get().updateNodeData(outId, {
            label: "分镜",
            status: "success",
            scriptRows: rows,
            errorMessage: undefined,
          });
          get().updateNodeData(agentNodeId, { status: "success", errorMessage: undefined });
          set({ makeupLocked: true });
          writeMakeupLocked(true);
          get().showToast("分镜已出 · 定妆已锁定", { durationMs: 3600 });
          return;
        }

        const msg = failClosedMessage(spec.label);
        get().updateNodeData(agentNodeId, { status: "error", errorMessage: msg });
        get().showToast(msg, { durationMs: 5600 });
      } catch (caught) {
        if (!mine() || runAc.signal.aborted || isAbortError(caught)) {
          if (mine()) {
            get().updateNodeData(agentNodeId, {
              status: "idle",
              errorMessage: undefined,
            });
          }
          return;
        }
        const msg =
          caught instanceof StudioApiError
            ? caught.message
            : studioErrorMessage(caught) || `${spec.label}失败`;
        get().updateNodeData(agentNodeId, { status: "error", errorMessage: msg });
        get().showToast(msg, { durationMs: 5600 });
      } finally {
        if (agentRunAbortById.get(agentNodeId) === runAc) {
          agentRunAbortById.delete(agentNodeId);
        }
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
      if (!node) return;
      const msg = failClosedMessage(node.data.label || KIND_LABEL[node.data.kind] || "出图");
      get().updateNodeData(nodeId, { status: "error", errorMessage: msg });
      get().showToast(msg, { durationMs: 5600 });
    },

    /** 第4刀：文字资产卡内出图；角色卡走三视主路径。 */
    generateStickyImage: async (nodeId) => {
      const node = get().nodes.find((n) => n.id === nodeId);
      if (!node || !isTextAssetCardNodeData(node.data)) return;
      const lock = makeupLockedReason(get().makeupLocked, get().nodes);
      if (lock) {
        get().showToast(lock, { durationMs: 4200 });
        return;
      }
      imageRunAbortById.get(nodeId)?.abort();

      const title = (node.data.label || "").trim();
      const body = (node.data.text || node.data.prompt || "").trim();
      const prompt = [title, body].filter(Boolean).join("\n") || "便签出图";
      const asCharacter = isCharacterAssetCard(node);
      const runAc = new AbortController();
      const epoch = get().runEpoch;
      const token = createFilmRunToken(get().projectId ?? "", nodeId);
      const mine = () =>
        stillMine(token, {
          projectId: get().projectId,
          runId: token.runId,
          aborted: runAc.signal.aborted || get().runEpoch !== epoch,
        });
      imageRunAbortById.get(nodeId)?.abort();
      imageRunAbortById.set(nodeId, runAc);

      get().updateNodeData(nodeId, {
        imageStatus: "running",
        imageError: undefined,
        imageRunId: token.runId,
      });

      const applyOutput = (
        output: { url?: string; s3Key?: string; assetId?: string },
        view?: FilmThreeViewId,
      ) => {
        const assetUrl =
          toBrowserMediaUrl(output.url, output.s3Key) ?? output.url ?? undefined;
        if (!assetUrl && !output.s3Key && !output.assetId) {
          throw new Error("后端返回的媒体缺少地址");
        }
        const still = get().nodes.find((n) => n.id === nodeId);
        if (!still || !mine()) return;
        if (view) {
          const views = { ...(still.data.threeViews ?? {}) };
          views[view] = {
            url: assetUrl || output.url,
            s3Key: output.s3Key?.trim() || undefined,
            assetId: output.assetId,
            status: "success",
          };
          get().updateNodeData(nodeId, {
            threeViews: views,
            assetUrl: view === "front" ? assetUrl || still.data.assetUrl : still.data.assetUrl,
            assetId: output.assetId ?? still.data.assetId,
            s3Key: output.s3Key?.trim() || still.data.s3Key,
          });
          return;
        }
        get().updateNodeData(nodeId, {
          imageStatus: "success",
          imageError: undefined,
          imageRunId: undefined,
          assetUrl: assetUrl || still.data.assetUrl,
          assetId: output.assetId ?? still.data.assetId,
          s3Key: output.s3Key?.trim() || still.data.s3Key,
        });
      };

      try {
        if (asCharacter) {
          const views = { ...(node.data.threeViews ?? {}) };
          for (const view of FILM_THREE_VIEWS) {
            views[view] = { ...views[view], status: "running", error: undefined };
          }
          get().updateNodeData(nodeId, { threeViews: views });
          for (const view of FILM_THREE_VIEWS) {
            if (!mine()) return;
            const result = await generateImage({
              prompt: `${prompt}\n${FILM_THREE_VIEW_LABELS[view]}面三视图，白底，统一比例与灯光`,
              count: 1,
            });
            if (!mine()) return;
            const output = result.outputs[0];
            if (!output) throw new Error("后端没有返回图片");
            applyOutput(output, view);
          }
          if (!mine()) return;
          get().updateNodeData(nodeId, {
            imageStatus: "success",
            imageError: undefined,
            imageRunId: undefined,
          });
          get().showToast("角色三视已出", { durationMs: 3000 });
          return;
        }

        const result = await generateImage({ prompt, count: 1 });
        if (!mine()) return;
        const output = result.outputs[0];
        if (!output) throw new Error("后端没有返回图片");
        applyOutput(output);
      } catch (caught) {
        if (!mine() || runAc.signal.aborted || isAbortError(caught)) {
          if (mine()) {
            get().updateNodeData(nodeId, {
              imageStatus: "idle",
              imageError: undefined,
              imageRunId: undefined,
            });
          }
          return;
        }
        const msg = studioErrorMessage(caught) || "出图失败，可重试";
        get().updateNodeData(nodeId, {
          imageStatus: "error",
          imageError: msg,
          imageRunId: undefined,
        });
        get().showToast(msg, { durationMs: 5600 });
      } finally {
        if (imageRunAbortById.get(nodeId) === runAc) {
          imageRunAbortById.delete(nodeId);
        }
      }
    },

    generateShotsFromScript: async () => {
      get().showToast(failClosedMessage("分镜出图"), { durationMs: 5600 });
    },

    batchGenerateVideos: async () => {
      get().showToast(failClosedMessage("成片"), { durationMs: 5600 });
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
