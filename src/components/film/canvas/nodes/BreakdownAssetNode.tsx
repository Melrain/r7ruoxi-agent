"use client";

import { Position, type NodeProps } from "@xyflow/react";
import { LitHandle } from "@/components/film/canvas/nodes/LitHandle";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import {
  breakdownPreviewRowCount,
  breakdownTextSummaryLine,
} from "@/components/film/canvas/lib/breakdown-script-rows";
import { agentsAccepting, assetKindOf } from "@/components/film/canvas/lib/agent-catalog";
import { AssignAgentMenu } from "@/components/film/canvas/nodes/AssignAgentMenu";
import { PORT_COLOR } from "@/components/film/canvas/lib/port-color";
import { cn } from "@/lib/utils";
import { useProjectStore } from "@/components/film/canvas/store/project-store";
import type { AppNode } from "@/components/film/canvas/types/project";

export function BreakdownAssetNode({ id, data, selected }: NodeProps<AppNode>) {
  const assignAgent = useProjectStore((s) => s.assignAgent);
  const [handoff, setHandoff] = useState(false);
  const kind = assetKindOf({ id, data } as AppNode) ?? "text";
  const options = agentsAccepting(kind);
  const rows = data.scriptRows ?? [];
  const previewMax = breakdownPreviewRowCount();
  const preview = rows.slice(0, previewMax);
  const rest = Math.max(0, rows.length - preview.length);
  const running = data.status === "running";
  const failed = data.status === "error";
  const summary =
    rows.length === 0 ? breakdownTextSummaryLine(data.text || data.prompt || "") : "";
  const title = `拆解 · ${rows.length} 镜`;
  const showHandoff = options.length > 0 && (selected || handoff);

  return (
    <div className="relative w-[320px]">
      <div
        className={cn(
          "node-card node-card-neutral overflow-hidden",
          selected && "is-selected",
          running && "is-running",
        )}
      >
        <LitHandle
          id="in"
          type="target"
          position={Position.Left}
          primaryForNull
          className="node-handle"
          isConnectable={false}
          style={{ background: PORT_COLOR.text, opacity: 0, pointerEvents: "none" }}
        />
        <LitHandle
          id="out-l"
          type="source"
          position={Position.Left}
          className="node-handle"
          style={{ background: PORT_COLOR.text }}
        />
        <div className="p-4">
          <div className="mb-3 flex items-center justify-between gap-2 border-b border-white/[0.06] pb-2.5">
            <p className="truncate text-[13px] font-semibold tracking-wide text-slate-100">
              {title}
            </p>
            {running ? (
              <span className="shrink-0 text-[10px] text-amber-300/90">生成中</span>
            ) : failed ? (
              <span className="shrink-0 text-[10px] text-rose-300/90">失败</span>
            ) : null}
          </div>

          {running ? (
            <div className="space-y-2" aria-busy>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-1.5 rounded-lg border border-white/[0.04] bg-[#07080c]/50 p-2">
                  <div className="h-2.5 w-10 animate-pulse rounded bg-white/10" />
                  <div className="h-2.5 w-full animate-pulse rounded bg-white/[0.06]" />
                  <div className="h-2 w-2/3 animate-pulse rounded bg-white/[0.04]" />
                </div>
              ))}
            </div>
          ) : rows.length > 0 ? (
            <ul className="space-y-1.5">
              {preview.map((row) => (
                <li
                  key={row.id}
                  className="rounded-lg border border-white/[0.04] bg-[#07080c]/55 px-2.5 py-1.5"
                >
                  <div className="flex items-baseline gap-2">
                    <span className="shrink-0 font-mono text-[11px] font-semibold text-amber-200/90">
                      {row.shotId || "—"}
                    </span>
                    <span className="min-w-0 truncate text-[11px] leading-snug text-slate-300">
                      {row.visualDesc || "（无画面）"}
                    </span>
                  </div>
                  {row.dialogue ? (
                    <p className="mt-0.5 truncate pl-[2.6rem] text-[10px] leading-snug text-slate-500">
                      {row.dialogue}
                    </p>
                  ) : (
                    <p className="mt-0.5 truncate pl-[2.6rem] text-[10px] leading-snug text-slate-600">
                      （无对白）
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ) : summary ? (
            <div className="rounded-lg border border-white/[0.05] bg-[#07080c]/55 px-2.5 py-2">
              <p className="text-[11px] leading-relaxed text-slate-400">{summary}</p>
              <p className="mt-1 text-[10px] text-slate-600">结构化镜号不可用 · 双击看全文</p>
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-white/10 bg-[#07080c]/40 px-3 py-4 text-center text-[12px] text-slate-500">
              暂无镜号
            </p>
          )}

          {!running && rows.length > 0 ? (
            <p className="mt-2.5 text-[10px] text-slate-500">
              {rest > 0 ? `还有 ${rest} 镜 · 双击查看` : "双击查看"}
            </p>
          ) : null}

          {showHandoff ? (
            <div className="nodrag nowheel nopan relative mt-3 flex justify-end border-t border-white/[0.04] pt-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setHandoff((open) => !open);
                }}
                className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] text-slate-500 opacity-70 transition hover:bg-white/[0.04] hover:text-slate-300 hover:opacity-100"
              >
                交给…
                <ArrowRight className="size-2.5" />
              </button>
              {handoff ? (
                <AssignAgentMenu
                  kind={kind}
                  compact
                  className="absolute right-0 bottom-7"
                  onPick={(agentId) => {
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
          style={{ background: PORT_COLOR.text }}
        />
      </div>
    </div>
  );
}
