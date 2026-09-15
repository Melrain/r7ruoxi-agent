"use client";

import type { ReactNode } from "react";
import { AddNodePanel } from "@/components/film/canvas/AddNodePanel";
import { assetKindOf } from "@/components/film/canvas/lib/agent-catalog";
import { AssignAgentMenu } from "@/components/film/canvas/nodes/AssignAgentMenu";
import { cn } from "@/lib/utils";
import { isUploadKind, pickAndAttachAsset } from "@/components/film/canvas/lib/pick-local-file";
import { useProjectStore } from "@/components/film/canvas/store/project-store";
import type { AgentId } from "@/components/film/canvas/types/project";


function AssignBlock({
  assetId,
  onAssign,
}: {
  assetId: string;
  onAssign: (agentId: AgentId) => void;
}) {
  const node = useProjectStore((s) => s.nodes.find((n) => n.id === assetId));
  const kind = assetKindOf(node);
  if (!kind) return null;
  return (
    <div className="mb-1">
      <AssignAgentMenu
        kind={kind}
        className="relative min-w-0 w-full border-0 bg-white/4 shadow-none"
        onPick={onAssign}
      />
    </div>
  );
}

function MenuItem({
  children,
  disabled,
  onClick,
  danger,
  testId,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  danger?: boolean;
  testId?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[13px]",
        danger ? "text-red-300 hover:bg-red-500/10" : "text-zinc-200 hover:bg-white/6",
        disabled && "pointer-events-none opacity-35"
      )}
    >
      {children}
    </button>
  );
}

export function CanvasMenus() {
  const addMenu = useProjectStore((s) => s.addMenu);
  const contextMenu = useProjectStore((s) => s.contextMenu);
  const selectedNodeIds = useProjectStore((s) => s.selectedNodeIds);
  const closeAddMenu = useProjectStore((s) => s.closeAddMenu);
  const setAssetLibraryOpen = useProjectStore((s) => s.setAssetLibraryOpen);
  const closeContextMenu = useProjectStore((s) => s.closeContextMenu);
  const addNode = useProjectStore((s) => s.addNode);
  const addAgent = useProjectStore((s) => s.addAgent);
  const openCreateAgent = useProjectStore((s) => s.openCreateAgent);
  const assignAgent = useProjectStore((s) => s.assignAgent);
  const deleteSelection = useProjectStore((s) => s.deleteSelection);
  const deleteEdge = useProjectStore((s) => s.deleteEdge);
  const duplicateSelection = useProjectStore((s) => s.duplicateSelection);
  const groupSelection = useProjectStore((s) => s.groupSelection);
  const ungroupSelection = useProjectStore((s) => s.ungroupSelection);
  const setRenamingNodeId = useProjectStore((s) => s.setRenamingNodeId);
  const setViewMode = useProjectStore((s) => s.setViewMode);
  const setStoryboardDetailId = useProjectStore((s) => s.setStoryboardDetailId);
  const showToast = useProjectStore((s) => s.showToast);

  const nodes = useProjectStore((s) => s.nodes);
  const target = nodes.find((n) => n.id === contextMenu?.targetId);
  const multi = selectedNodeIds.length > 1;
  const grouped = Boolean(target?.data.groupId);

  const clamp = (x: number, y: number, w = 260, h = 360) => ({
    left: Math.min(Math.max(8, x), Math.max(8, window.innerWidth - w - 8)),
    top: Math.min(Math.max(8, y), Math.max(8, window.innerHeight - h - 8)),
  });

  const stubToast = (label: string) => {
    showToast(`${label}为演示占位，不会上传或扣费`);
    closeAddMenu();
    closeContextMenu();
  };

  return (
    <>
      {addMenu ? (
        <div
          className="fixed inset-0 z-50"
          onClick={closeAddMenu}
          onContextMenu={(e) => {
            e.preventDefault();
            closeAddMenu();
          }}
        >
          <div
            className="absolute"
            style={clamp(addMenu.x, addMenu.y, 200, 320)}
            onClick={(e) => e.stopPropagation()}
          >
            <AddNodePanel
              menuX={addMenu.x}
              onPick={(item) => {
                if (item.id === "agent-write") {
                  openCreateAgent({ flowX: addMenu.flowX, flowY: addMenu.flowY });
                  return;
                }
                if (item.agentId) {
                  addAgent(item.agentId, {
                    position: { x: addMenu.flowX, y: addMenu.flowY },
                  });
                } else if (item.kind) {
                  const id = addNode(item.kind, {
                    position: { x: addMenu.flowX, y: addMenu.flowY },
                  });
                  if (id && isUploadKind(item.kind)) {
                    void pickAndAttachAsset(id, item.kind, useProjectStore.getState().updateNodeData);
                  }
                }
                closeAddMenu();
              }}
              onStub={(item) => stubToast(item.label)}
              onOpenLibrary={() => {
                closeAddMenu();
                setAssetLibraryOpen(true);
              }}
            />
          </div>
        </div>
      ) : null}

      {contextMenu && contextMenu.kind !== "pane" ? (
        <div
          className="fixed inset-0 z-50"
          onClick={closeContextMenu}
          onContextMenu={(e) => {
            e.preventDefault();
            closeContextMenu();
          }}
        >
          <div
            data-testid={
              contextMenu.kind === "node"
                ? "node-context-menu"
                : "edge-context-menu"
            }
            className="absolute w-52 rounded-xl border border-[#363636] bg-[#1a1a1a] p-1.5 shadow-2xl"
            style={clamp(contextMenu.x, contextMenu.y, 220, 280)}
            onClick={(e) => e.stopPropagation()}
          >
            {contextMenu.kind === "node" ? (
              <>
                {target && target.data.role !== "agent" ? (
                  <AssignBlock
                    assetId={target.id}
                    onAssign={(agentId) => {
                      assignAgent(target.id, agentId);
                      closeContextMenu();
                    }}
                  />
                ) : null}
                <MenuItem
                  testId="menu-copy-paste"
                  onClick={() => {
                    duplicateSelection(false);
                    showToast("已复制并粘贴（不含连线）");
                  }}
                >
                  复制&粘贴
                </MenuItem>
                <MenuItem
                  testId="menu-duplicate"
                  onClick={() => {
                    duplicateSelection(true);
                    showToast("已创建副本（保留选中之间的连线）");
                  }}
                >
                  副本
                </MenuItem>
                <MenuItem
                  danger
                  testId="menu-delete"
                  onClick={() => deleteSelection()}
                >
                  删除
                </MenuItem>
                <div className="my-1 h-px bg-white/8" />
                <MenuItem
                  disabled={!multi}
                  onClick={() => groupSelection()}
                >
                  打组
                </MenuItem>
                <MenuItem
                  disabled={!grouped && !multi}
                  onClick={() => ungroupSelection()}
                >
                  解组
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    if (contextMenu.targetId) {
                      setRenamingNodeId(contextMenu.targetId);
                    }
                    closeContextMenu();
                  }}
                >
                  重命名
                </MenuItem>
                {target && target.data.role !== "agent" ? (
                  <MenuItem
                    onClick={() => {
                      if (contextMenu.targetId) {
                        setStoryboardDetailId(contextMenu.targetId);
                        setViewMode("storyboard");
                      }
                      closeContextMenu();
                    }}
                  >
                    在故事板中查看
                  </MenuItem>
                ) : null}
              </>
            ) : null}

            {contextMenu.kind === "edge" && contextMenu.targetId ? (
              <MenuItem
                danger
                onClick={() => deleteEdge(contextMenu.targetId!)}
              >
                删除连线
              </MenuItem>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
