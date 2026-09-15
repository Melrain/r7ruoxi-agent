"use client";

import { Position, type NodeProps } from "@xyflow/react";
import { LitHandle } from "@/components/film/canvas/nodes/LitHandle";
import { ArrowRight, ImageIcon, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState, type MouseEvent } from "react";
import {
  agentsAccepting,
  assetKindOf,
} from "@/components/film/canvas/lib/agent-catalog";
import { AssignAgentMenu } from "@/components/film/canvas/nodes/AssignAgentMenu";
import {
  textAssetRoleLabel,
  type TextAssetRole,
} from "@/components/film/canvas/lib/extract-text-assets";
import { retryNodeAssetUrlOnError } from "@/components/film/canvas/lib/refresh-node-asset-urls";
import { resolveMediaSrc } from "@/components/film/canvas/lib/resolve-asset-url";
import { PORT_COLOR } from "@/components/film/canvas/lib/port-color";
import { cn } from "@/lib/utils";
import { useProjectStore } from "@/components/film/canvas/store/project-store";
import type { AppNode } from "@/components/film/canvas/types/project";

const ROLE_BADGE: Record<TextAssetRole, string> = {
  character: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  scene: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  prop: "border-amber-500/30 bg-amber-500/10 text-amber-300",
};

function resolveRole(data: AppNode["data"]): TextAssetRole {
  const raw = data.assetRole;
  if (raw === "character" || raw === "scene" || raw === "prop") return raw;
  if (data.kind === "character") return "character";
  if (data.kind === "scene") return "scene";
  return "prop";
}

/** 文案 | 生成中 | 失败 — 区别于拆解镜号卡（与卡内出图 imageStatus 独立） */
function statusLabel(status: AppNode["data"]["status"]): string {
  if (status === "running") return "生成中";
  if (status === "error") return "失败";
  return "文案";
}

export function isTextAssetCardData(data: AppNode["data"]): boolean {
  if (data.assetRole === "character" || data.assetRole === "scene" || data.assetRole === "prop") {
    return true;
  }
  // character / scene products from silent continuum also use this card
  if (data.kind === "character" || data.kind === "scene") {
    return data.textAssetCard === true || Boolean(data.assetRole);
  }
  // text 等 kind 显式打 textAssetCard 时同卡
  return data.textAssetCard === true;
}

/** 卡内出图预览区：出图 → 出图中骨架 → 缩略+重出图 / 失败+重试 */
function StickyImageSlot({
  nodeId,
  data,
}: {
  nodeId: string;
  data: AppNode["data"];
}) {
  const generateStickyImage = useProjectStore((s) => s.generateStickyImage);
  const [broken, setBroken] = useState(false);
  const mediaSrc = resolveMediaSrc(data.assetUrl);
  const preview = mediaSrc && !broken ? mediaSrc : undefined;
  const imageRunning = data.imageStatus === "running";
  const imageError = data.imageStatus === "error";

  useEffect(() => {
    setBroken(false);
  }, [mediaSrc]);

  const run = (e: MouseEvent) => {
    e.stopPropagation();
    void generateStickyImage(nodeId);
  };

  if (imageRunning) {
    return (
      <div
        className="nodrag nowheel nopan mt-2.5 flex w-full flex-col gap-1.5 rounded border border-[#cbb99a]/50 bg-[#e7dcc4]/80 px-2 py-2.5"
        aria-busy
        aria-label="出图中"
      >
        <div className="h-2 w-3/4 animate-pulse rounded bg-[#d2c4a4]/80" />
        <div className="h-2 w-full animate-pulse rounded bg-[#d2c4a4]/65" />
        <div className="h-2 w-2/3 animate-pulse rounded bg-[#d2c4a4]/50" />
        <p className="flex items-center gap-1 pt-0.5 text-[9px] text-[#7a6a4e]">
          <Loader2 className="size-2.5 animate-spin opacity-70" />
          出图中…
        </p>
      </div>
    );
  }

  if (preview) {
    return (
      <div className="nodrag nowheel nopan relative mt-2.5 overflow-hidden rounded border border-[#cbb99a]/60">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={preview}
          alt={(data.label || "").trim() || "出图预览"}
          onError={() => {
            void retryNodeAssetUrlOnError(nodeId).then((ok) => {
              if (ok === false) setBroken(true);
            });
          }}
          className="aspect-[16/10] w-full object-cover"
        />
        <button
          type="button"
          className="absolute bottom-1 right-1 rounded bg-black/45 px-1.5 py-0.5 text-[8px] text-white/90 opacity-80 transition hover:opacity-100"
          title="重出图"
          onClick={run}
        >
          重出图
        </button>
      </div>
    );
  }

  if (imageError || broken) {
    return (
      <div className="nodrag nowheel nopan mt-2.5 flex w-full flex-col items-center gap-1.5 rounded border border-rose-400/35 bg-rose-500/10 px-2 py-2.5 text-center">
        <p className="line-clamp-2 text-[9px] leading-snug text-rose-700/90">
          {data.imageError?.trim() || (broken ? "预览失效，可重试" : "出图失败")}
        </p>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full bg-[#3f3424]/90 px-2 py-0.5 text-[9px] text-[#efe6d2] transition hover:bg-[#3f3424]"
          onClick={run}
        >
          <RefreshCw className="size-2.5" />
          重试出图
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="nodrag nowheel nopan mt-2.5 flex w-full flex-col items-center justify-center gap-0.5 rounded border border-[#cbb99a]/60 bg-[repeating-linear-gradient(-45deg,#e8dcc4,#e8dcc4_5px,#ddd0b4_5px,#ddd0b4_10px)] px-2 py-2.5 text-[#7a6b52] transition hover:brightness-95"
      title="出图"
      onClick={run}
    >
      <ImageIcon className="size-3.5 opacity-70" />
      <span className="text-[9px] leading-tight">出图</span>
    </button>
  );
}

export function TextAssetCardNode({ id, data, selected }: NodeProps<AppNode>) {
  const assignAgent = useProjectStore((s) => s.assignAgent);
  const generateStickyImage = useProjectStore((s) => s.generateStickyImage);
  const [handoff, setHandoff] = useState(false);
  const kind = assetKindOf({ id, data } as AppNode) ?? "text";
  const options = agentsAccepting(kind);
  const role = resolveRole(data);
  const title = (data.label || "").trim() || textAssetRoleLabel(role);
  const body =
    (data.text || data.prompt || "").trim() ||
    (data.status === "running" ? "正在生成…" : "暂无描述");
  const running = data.status === "running";
  const failed = data.status === "error";
  const showHandoff = options.length > 0 && (selected || handoff);
  const color = PORT_COLOR[data.kind] ?? PORT_COLOR.text;

  return (
    <div className="relative w-[200px]">
      <div
        className={cn(
          "node-sticky overflow-hidden rounded-[4px] border border-[#d6c7a8]/70 bg-[#efe6d2] shadow-[2px_3px_0_rgb(0_0_0_/_25%)]",
          selected && "ring-1 ring-amber-700/35",
          running && "opacity-95",
        )}
      >
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
        <div className="p-3">
          <div className="mb-2 flex items-center justify-between gap-1.5">
            <span
              className={cn(
                "rounded-full border px-1.5 py-0.5 text-[9px] font-medium tracking-wide",
                ROLE_BADGE[role],
              )}
            >
              {textAssetRoleLabel(role)}
            </span>
            <span
              className={cn(
                "text-[9px]",
                failed
                  ? "text-rose-600"
                  : running
                    ? "text-amber-700"
                    : "text-[#7a6b52]",
              )}
            >
              {statusLabel(data.status)}
            </span>
          </div>

          <h3 className="mb-1.5 truncate font-serif text-[13px] font-semibold leading-snug text-[#3f3424]">
            {title}
          </h3>

          {running ? (
            <div className="space-y-1.5" aria-busy>
              <div className="h-2 w-full animate-pulse rounded bg-[#d6c7a8]/50" />
              <div className="h-2 w-4/5 animate-pulse rounded bg-[#d6c7a8]/35" />
              <div className="h-2 w-3/5 animate-pulse rounded bg-[#d6c7a8]/25" />
            </div>
          ) : failed ? (
            <p className="text-[11px] leading-relaxed text-rose-700/90">
              {data.errorMessage?.trim() || "挂载失败，可重跑"}
            </p>
          ) : (
            <p className="line-clamp-3 whitespace-pre-line font-serif text-[11px] leading-relaxed text-[#4a3f2e]">
              {body}
            </p>
          )}

          <StickyImageSlot nodeId={id} data={data} />

          {showHandoff ? (
            <div className="nodrag nowheel nopan relative mt-2 flex justify-end border-t border-[#d6c7a8]/50 pt-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setHandoff((open) => !open);
                }}
                className="inline-flex items-center gap-0.5 px-1 py-0.5 text-[10px] text-[#8a7a5e] opacity-80 hover:text-[#5a4e3a] hover:opacity-100"
              >
                交给…
                <ArrowRight className="size-2.5 opacity-60" />
              </button>
              {handoff ? (
                <AssignAgentMenu
                  kind={kind}
                  compact
                  className="absolute right-0 bottom-7"
                  onPick={(agentId) => {
                    // 出图：同卡内 generateStickyImage，不旁挂 image 节点 / 不出图智能体
                    if (agentId === "image") {
                      void generateStickyImage(id);
                      setHandoff(false);
                      return;
                    }
                    assignAgent(id, agentId);
                    setHandoff(false);
                  }}
                />
              ) : null}
            </div>
          ) : null}
        </div>
        <LitHandle
          id="out"
          type="source"
          position={Position.Right}
          primaryForNull
          className="node-handle"
          style={{ background: color }}
        />
      </div>
    </div>
  );
}
