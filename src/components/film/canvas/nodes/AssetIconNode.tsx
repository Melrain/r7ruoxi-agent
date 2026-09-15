"use client";

import { Position, type NodeProps } from "@xyflow/react";
import { LitHandle } from "@/components/film/canvas/nodes/LitHandle";
import { ImageIcon, Loader2, Paperclip, Video } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { assetKindOf } from "@/components/film/canvas/lib/agent-catalog";
import { AssignAgentMenu } from "@/components/film/canvas/nodes/AssignAgentMenu";
import { retryNodeAssetUrlOnError } from "@/components/film/canvas/lib/refresh-node-asset-urls";
import { resolveMediaSrc } from "@/components/film/canvas/lib/resolve-asset-url";
import { PORT_COLOR } from "@/components/film/canvas/lib/port-color";
import { KIND_LABEL } from "@/components/film/canvas/lib/labels";
import { cn } from "@/lib/utils";
import { useProjectStore } from "@/components/film/canvas/store/project-store";
import type { AppNode, AssetKind, CanvasNodeData } from "@/components/film/canvas/types/project";

function firstLine(value?: string) {
  return value?.trim().split(/\n/)[0]?.trim() ?? "";
}

function displayName(data: CanvasNodeData) {
  const kindName = KIND_LABEL[data.kind];
  const label = data.label.trim();
  if (label && label !== kindName) return label;
  const line = firstLine(data.text) || firstLine(data.prompt);
  if (line) return line.slice(0, 16);
  return `未命名${kindName}`;
}

function snippet(data: CanvasNodeData) {
  return firstLine(data.text) || firstLine(data.prompt) || "";
}

function fileName(data: CanvasNodeData) {
  return displayName(data);
}

export function AssetIconNode({ id, data, selected }: NodeProps<AppNode>) {
  const assignAgent = useProjectStore((s) => s.assignAgent);
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const [handoff, setHandoff] = useState(false);
  const [broken, setBroken] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const ptrRef = useRef<{ x: number; y: number } | null>(null);
  const draggedRef = useRef(false);
  /** Keep id out of effect deps so HMR/deps length stays fixed at [handoff]. */
  const nodeIdRef = useRef(id);
  nodeIdRef.current = id;
  /** 点右出点开「交给」；拖过阈值则走 xyflow 拉线 */
  const HANDLE_CLICK_PX = 5;
  const kind = (assetKindOf({ id, data } as AppNode) ?? data.kind) as AssetKind;
  const color = PORT_COLOR[data.kind];
  const name = data.kind === "file" ? fileName(data) : displayName(data);
  const body = snippet(data);
  const mediaSrc = resolveMediaSrc(data.assetUrl);
  const media =
    (data.kind === "image" || data.kind === "video") && !broken
      ? mediaSrc
      : undefined;
  useEffect(() => {
    setBroken(false);
  }, [mediaSrc]);

  // 非模态：点空白关闭菜单（右出点交给自身 toggle，避免 pointerdown 先关再被 pointerup 打开）
  useEffect(() => {
    if (!handoff) return;
    const onDown = (e: PointerEvent) => {
      const el = menuRef.current;
      if (el && e.target instanceof Node && el.contains(e.target)) return;
      if (
        e.target instanceof Element &&
        e.target.closest(`[data-asset-source-handle="${nodeIdRef.current}"]`)
      ) {
        return;
      }
      setHandoff(false);
    };
    // 下一帧再绑，避免打开当次 click 立刻关掉
    const t = window.setTimeout(() => {
      document.addEventListener("pointerdown", onDown, true);
    }, 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [handoff]);

  const uploading = data.status === "uploading";
  const uploadError = data.status === "error" && data.kind === "video";
  // 图/视频：卡内底栏标题；文/音/附件：正文区已含名，不再外挂标题
  const titleInsideMedia = data.kind === "image" || data.kind === "video";
  const titleInBody =
    data.kind === "text" || data.kind === "audio" || data.kind === "file";

  return (
    <div className="relative w-[108px]">
      <div className={cn("node-icon flex flex-col items-center gap-1.5", selected && "is-selected")}>
        {/* 初始资产：四边出点 */}
        <div
          className={cn(
            "relative flex size-20 flex-col overflow-hidden rounded-2xl border shadow-[0_10px_24px_rgb(0_0_0_/_45%)]",
            data.kind === "image" || data.kind === "video"
              ? "border-cyan-400/30 bg-[#0b0d13]"
              : data.kind === "text"
                ? "border-amber-200/20 bg-[#141018] p-2"
                : data.kind === "audio"
                  ? "border-fuchsia-400/25 bg-[#141018] p-2"
                  : "border-white/12 bg-[#141018] p-2",
            selected && "ring-1 ring-white/25",
          )}
          title={name}
        >
          {data.kind === "image" || data.kind === "video" ? (
            media ? (
              data.kind === "video" ? (
                <>
                  {/* pointer-events-none: shell stays draggable/selectable; play uses nodrag button */}
                  <video
                    ref={videoRef}
                    src={media}
                    muted
                    playsInline
                    preload="metadata"
                    onError={() => {
                      void retryNodeAssetUrlOnError(id).then((ok) => {
                        if (ok === false) setBroken(true);
                      });
                    }}
                    className="pointer-events-none size-full object-cover"
                  />
                  <button
                    type="button"
                    className="nodrag nowheel nopan absolute bottom-1 right-1 z-[1] flex size-6 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white/90"
                    title="预览（静音）"
                    aria-label="预览视频"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (data.status === "uploading") return;
                      const el = videoRef.current;
                      if (!el) return;
                      if (el.paused) void el.play().catch(() => undefined);
                      else el.pause();
                    }}
                  >
                    <Video className="size-3" />
                  </button>
                </>
              ) : (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={media}
                    alt={name}
                    onError={() => {
                      void retryNodeAssetUrlOnError(id).then((ok) => {
                        if (ok === false) setBroken(true);
                      });
                    }}
                    className="size-full object-cover"
                  />
                </>
              )
            ) : (
              <div className="flex size-full items-center justify-center text-cyan-300/80">
                {data.kind === "video" ? (
                  <Video className="size-6" />
                ) : (
                  <ImageIcon className="size-6" />
                )}
              </div>
            )
          ) : data.kind === "text" ? (
            <p className="line-clamp-5 text-left text-[9px] leading-snug text-amber-100/85">
              {body || name}
            </p>
          ) : data.kind === "audio" ? (
            <div className="flex h-full flex-col justify-end gap-px">
              <div className="flex h-8 items-end gap-px">
                {Array.from({ length: 14 }).map((_, i) => (
                  <span
                    key={i}
                    className="w-1 rounded-full bg-fuchsia-300/70"
                    style={{ height: `${8 + ((i * 13) % 18)}px` }}
                  />
                ))}
              </div>
              <p className="truncate text-[8px] text-fuchsia-100/80">{name}</p>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-1 text-slate-200">
              <Paperclip className="size-4 text-slate-400" />
              <p className="line-clamp-3 w-full text-center text-[9px] leading-snug">{name}</p>
            </div>
          )}
          {titleInsideMedia ? (
            <p
              className={cn(
                "pointer-events-none absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/75 to-transparent px-1.5 pb-1 pt-3 text-[9px] text-slate-100",
                data.kind === "video" ? "pr-7 text-left" : "text-center",
              )}
            >
              {name}
            </p>
          ) : null}
          {(uploading || uploadError) && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/55 px-1 text-center">
              {uploading ? (
                <>
                  <Loader2 className="size-5 animate-spin text-sky-300" />
                  <p className="mt-1 text-[9px] text-sky-100">
                    {data.progress || "上传中…"}
                  </p>
                </>
              ) : (
                <p className="line-clamp-3 text-[9px] leading-snug text-rose-200">
                  {data.errorMessage || "上传失败"}
                </p>
              )}
            </div>
          )}
        </div>
        {uploadError ? (
          <button
            type="button"
            className="nodrag nowheel nopan z-20 -mt-0.5 rounded-full border border-rose-400/40 bg-[#0b0d13]/95 px-2 py-0.5 text-[10px] text-rose-200"
            onClick={(e) => {
              e.stopPropagation();
              void import("@/components/film/canvas/lib/pick-local-file").then(
                ({ pickAndAttachAsset }) =>
                  pickAndAttachAsset(id, data.kind, updateNodeData),
              );
            }}
          >
            重试上传
          </button>
        ) : null}
        {/* 标题只留卡内；正文类已带名，不再外挂 */}
        {!titleInsideMedia && !titleInBody ? (
          <p className="w-full truncate text-center text-[11px] text-slate-200">{name}</p>
        ) : null}

        {/* L/R 出点；右出点：点开交给 / 拖过阈值拉线。隐藏 in 供产出边挂载 */}
        <LitHandle
          id="in"
          type="target"
          position={Position.Left}
          primaryForNull
          className="node-handle"
          isConnectable={false}
          style={{ background: color, opacity: 0, pointerEvents: "none" }}
        />
        <LitHandle
          id="out-l"
          type="source"
          position={Position.Left}
          className="node-handle"
          style={{ background: color }}
        />
        <LitHandle
          id="out"
          type="source"
          position={Position.Right}
          primaryForNull
          className="node-handle"
          data-asset-source-handle={id}
          style={{ background: color }}
          onPointerDown={(e) => {
            ptrRef.current = { x: e.clientX, y: e.clientY };
            draggedRef.current = false;
            const onMove = (ev: PointerEvent) => {
              const start = ptrRef.current;
              if (!start || draggedRef.current) return;
              if (
                Math.hypot(ev.clientX - start.x, ev.clientY - start.y) >=
                HANDLE_CLICK_PX
              ) {
                draggedRef.current = true;
              }
            };
            const onUp = () => {
              document.removeEventListener("pointermove", onMove, true);
              document.removeEventListener("pointerup", onUp, true);
              document.removeEventListener("pointercancel", onUp, true);
              const wasClick = ptrRef.current != null && !draggedRef.current;
              ptrRef.current = null;
              if (wasClick) setHandoff((open) => !open);
            };
            document.addEventListener("pointermove", onMove, true);
            document.addEventListener("pointerup", onUp, true);
            document.addEventListener("pointercancel", onUp, true);
          }}
        />
        <div
          ref={menuRef}
          className="nodrag nowheel nopan absolute z-20"
          style={{ left: "100%", top: 28, marginLeft: 10 }}
        >
          {handoff ? (
            <AssignAgentMenu
              kind={kind}
              compact
              className="absolute left-0 top-0"
              onPick={(agentId) => {
                assignAgent(id, agentId);
                setHandoff(false);
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
