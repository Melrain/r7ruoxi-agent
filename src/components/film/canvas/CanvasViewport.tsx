"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type FinalConnectionState,
  type OnSelectionChangeParams,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { CanvasMenus } from "@/components/film/canvas/CanvasMenus";
import { EmptyState } from "@/components/film/canvas/EmptyState";
import { Starfield } from "@/components/film/canvas/Starfield";
import { edgeTypes } from "@/components/film/canvas/edges/TopologyEdge";
import { nodeTypes } from "@/components/film/canvas/nodes";
import { canConnect, connectRejectReason } from "@/components/film/canvas/lib/agent-catalog";
import { decorateCanvasEdge } from "@/components/film/canvas/lib/edge-style";
import { isUploadKind, pickAndAttachAsset } from "@/components/film/canvas/lib/pick-local-file";
import { useProjectStore } from "@/components/film/canvas/store/project-store";

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest("input, textarea, select, [contenteditable='true']")
  );
}

function FlowCanvas() {
  const nodes = useProjectStore((s) => s.nodes);
  const edges = useProjectStore((s) => s.edges);
  const onNodesChange = useProjectStore((s) => s.onNodesChange);
  const onEdgesChange = useProjectStore((s) => s.onEdgesChange);
  const onConnect = useProjectStore((s) => s.onConnect);
  const connectingFromId = useProjectStore((s) => s.connectingFromId);
  const setConnectingFrom = useProjectStore((s) => s.setConnectingFrom);
  const showToast = useProjectStore((s) => s.showToast);
  const setSelection = useProjectStore((s) => s.setSelection);
  const setZoom = useProjectStore((s) => s.setZoom);
  const fitViewToken = useProjectStore((s) => s.fitViewToken);
  const zoomResetToken = useProjectStore((s) => s.zoomResetToken);
  const handTool = useProjectStore((s) => s.handTool);
  const hideEdges = useProjectStore((s) => s.hideEdges);
  const showMinimap = useProjectStore((s) => s.showMinimap);
  const showStarfield = useProjectStore((s) => s.showStarfield);
  const snapToGrid = useProjectStore((s) => s.snapToGrid);
  const openAddMenu = useProjectStore((s) => s.openAddMenu);
  const openContextMenu = useProjectStore((s) => s.openContextMenu);
  const closeContextMenu = useProjectStore((s) => s.closeContextMenu);
  const closeAddMenu = useProjectStore((s) => s.closeAddMenu);
  const closeNodeDetail = useProjectStore((s) => s.closeNodeDetail);
  const copySelection = useProjectStore((s) => s.copySelection);
  const pasteClipboardAt = useProjectStore((s) => s.pasteClipboardAt);
  const deleteSelection = useProjectStore((s) => s.deleteSelection);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const groupSelection = useProjectStore((s) => s.groupSelection);
  const requestFitView = useProjectStore((s) => s.requestFitView);
  const focusNodeEditor = useProjectStore((s) => s.focusNodeEditor);
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const autoLayout = useProjectStore((s) => s.autoLayout);
  const { fitView, screenToFlowPosition, zoomIn, zoomOut, zoomTo } =
    useReactFlow();
  const bootstrapped = useRef(false);
  const [spacePan, setSpacePan] = useState(false);
  const [shiftSelect, setShiftSelect] = useState(false);
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });

  useEffect(() => {
    if (!bootstrapped.current) {
      bootstrapped.current = true;
      const id = window.setTimeout(() => {
        void fitView({ padding: 0.2, duration: 200 });
      }, 40);
      return () => window.clearTimeout(id);
    }
    void fitView({ padding: 0.2, duration: 280 });
  }, [fitView, fitViewToken]);

  useEffect(() => {
    if (!bootstrapped.current) return;
    void zoomTo(1, { duration: 200 });
  }, [zoomResetToken, zoomTo]);

  const onSelectionChange = useCallback(
    ({ nodes: selected, edges: selectedEdges }: OnSelectionChangeParams) => {
      setSelection(
        selected.map((n) => n.id),
        selectedEdges.map((e) => e.id)
      );
    },
    [setSelection]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space" && !isTypingTarget(event.target)) {
        event.preventDefault();
        setSpacePan(true);
      }
      if (event.key === "Shift") setShiftSelect(true);

      const meta = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      // Undo/redo must work even with detail open, menus open, or focus in inputs.
      const isUndo = meta && (key === "z" || event.code === "KeyZ") && !event.shiftKey;
      const isRedo =
        (meta && (key === "z" || event.code === "KeyZ") && event.shiftKey) ||
        (event.ctrlKey && !event.metaKey && (key === "y" || event.code === "KeyY"));
      if (isUndo || isRedo) {
        event.preventDefault();
        if (isRedo) redo();
        else undo();
        return;
      }

      if (event.key === "Escape") {
        closeAddMenu();
        closeContextMenu();
        closeNodeDetail();
        return;
      }

      if (isTypingTarget(event.target)) return;

      const { addMenu, contextMenu, detailNodeId } = useProjectStore.getState();
      // Other canvas shortcuts stay gated; undo/redo already handled above.
      if (addMenu || contextMenu || detailNodeId) return;

      if (event.altKey && event.shiftKey && event.code === "KeyF") {
        event.preventDefault();
        autoLayout();
        return;
      }

      if (meta && key === "c") {
        event.preventDefault();
        copySelection(false);
      }
      if (meta && key === "v") {
        event.preventDefault();
        pasteClipboardAt();
      }
      if (meta && key === "g") {
        event.preventDefault();
        groupSelection();
      }
      if (meta && event.key === "0") {
        event.preventDefault();
        requestFitView();
      }
      if (meta && (event.key === "=" || event.key === "+")) {
        event.preventDefault();
        void zoomIn({ duration: 120 });
      }
      if (meta && event.key === "-") {
        event.preventDefault();
        void zoomOut({ duration: 120 });
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelection();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") setSpacePan(false);
      if (event.key === "Shift") setShiftSelect(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [
    autoLayout,
    closeAddMenu,
    closeContextMenu,
    closeNodeDetail,
    copySelection,
    deleteSelection,
    groupSelection,
    pasteClipboardAt,
    redo,
    requestFitView,
    undo,
    zoomIn,
    zoomOut,
  ]);

  const boxSelect = shiftSelect && !handTool && !spacePan;
  const panning = !boxSelect;

  // R7 /video is always tool-board A (no embed flag): flat board + lines grid.
  const gridGap = Math.max(12, Math.round(28 / Math.max(viewport.zoom, 0.25)));
  const toolLook = true;

  return (
    <div className="relative h-full min-h-0 w-full bg-[#14161c]">
      {showStarfield ? (
        <Starfield
          x={viewport.x}
          y={viewport.y}
          zoom={viewport.zoom}
          intensity="weak"
        />
      ) : null}
      <ReactFlow
        nodes={nodes.map((node) => {
          if (!connectingFromId || node.id === connectingFromId) return node;
          const src = nodes.find((item) => item.id === connectingFromId);
          return {
            ...node,
            className: canConnect(src, node) ? "is-drop-valid" : "is-drop-invalid",
          };
        })}
        edges={edges.map((edge) => ({
          ...decorateCanvasEdge(edge, nodes),
          hidden: hideEdges,
        }))}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={(_, params) => setConnectingFrom(params.nodeId ?? null)}
        onConnectEnd={(_, state: FinalConnectionState) => {
          const fromId = useProjectStore.getState().connectingFromId;
          const from = useProjectStore.getState().nodes.find((n) => n.id === fromId);
          setConnectingFrom(null);
          if (state.isValid) return;
          const toId = state.toNode?.id;
          if (!toId) return;
          const to = useProjectStore.getState().nodes.find((n) => n.id === toId);
          showToast(connectRejectReason(from, to) ?? "不能这样连");
        }}
        connectionMode={ConnectionMode.Strict}
        connectionRadius={48}
        connectOnClick={false}
        connectionLineStyle={{ stroke: "#e8c27a", strokeWidth: 1.6 }}
        onSelectionChange={onSelectionChange}
        onInit={(instance) => setViewport(instance.getViewport())}
        onMove={(_, next) => {
          setZoom(Math.round(next.zoom * 100));
          setViewport(next);
        }}
        onPaneClick={() => {
          closeContextMenu();
          closeAddMenu();
        }}
        onPaneContextMenu={(event) => {
          event.preventDefault();
          const flow = screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
          });
          openAddMenu({
            x: event.clientX,
            y: event.clientY,
            flowX: flow.x,
            flowY: flow.y,
          });
        }}
        onNodeContextMenu={(event, node) => {
          event.preventDefault();
          if (!useProjectStore.getState().selectedNodeIds.includes(node.id)) {
            setSelection([node.id], []);
          }
          openContextMenu({
            x: event.clientX,
            y: event.clientY,
            kind: "node",
            targetId: node.id,
          });
        }}
        onEdgeContextMenu={(event, edge) => {
          event.preventDefault();
          setSelection([], [edge.id]);
          openContextMenu({
            x: event.clientX,
            y: event.clientY,
            kind: "edge",
            targetId: edge.id,
          });
        }}
        onNodeDoubleClick={(event, node) => {
          event.preventDefault();
          if (node.data.kind === "agent" || node.data.role === "agent") {
            focusNodeEditor(node.id);
            return;
          }
          if (isUploadKind(node.data.kind)) {
            if (node.data.status === "uploading") return;
            void pickAndAttachAsset(node.id, node.data.kind, updateNodeData);
            return;
          }
          focusNodeEditor(node.id);
        }}
        isValidConnection={(connection) => {
          const src = useProjectStore
            .getState()
            .nodes.find((n) => n.id === connection.source);
          const tgt = useProjectStore
            .getState()
            .nodes.find((n) => n.id === connection.target);
          return canConnect(src, tgt);
        }}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        selectionOnDrag={boxSelect}
        panOnDrag={panning}
        zoomOnDoubleClick={false}
        multiSelectionKeyCode="Shift"
        deleteKeyCode={null}
        defaultEdgeOptions={{
          type: "topology",
        }}
        colorMode="dark"
        fitView
        minZoom={0.25}
        maxZoom={2}
        snapToGrid={snapToGrid}
        snapGrid={[16, 16]}
        className={toolLook ? "canvas-root canvas-tool" : "canvas-root"}
      >
        <Background
          id="grid"
          variant={BackgroundVariant.Lines}
          gap={gridGap}
          size={1}
          lineWidth={1}
          color="rgba(255,255,255,0.045)"
          bgColor="transparent"
        />
        {showMinimap ? (
          <MiniMap
            pannable
            zoomable
            nodeStrokeWidth={2}
            nodeColor={(n) =>
              n.type === "agent" ||
              (n.data as { role?: string } | undefined)?.role === "agent"
                ? "#7c6a9a"
                : "#5a6570"
            }
            maskColor="rgba(10,12,16,0.55)"
            maskStrokeColor="#c4ccd6"
            maskStrokeWidth={2}
            className="canvas-minimap !overflow-hidden !rounded-xl !border !border-white/15 !bg-[#2a2e38] !shadow-[0_8px_28px_rgba(0,0,0,0.4)]"
          />
        ) : null}
      </ReactFlow>
      {nodes.length === 0 ? <EmptyState /> : null}
      <CanvasMenus />
    </div>
  );
}

export function CanvasViewport() {
  return (
    <ReactFlowProvider>
      <FlowCanvas />
    </ReactFlowProvider>
  );
}
