"use client";

import type { NodeProps } from "@xyflow/react";
import {
  BookOpen,
  FileText,
  ImageIcon,
  MapPinned,
  Paperclip,
  Play,
  Sparkles,
  Table2,
  UserRound,
  Video,
  Volume2,
} from "lucide-react";
import type { ComponentType } from "react";
import { NodeChrome } from "@/components/film/canvas/nodes/NodeChrome";
import {
  assetKindOf,
  hasCustomPrompt,
  missingInputs,
  specOf,
} from "@/components/film/canvas/lib/agent-catalog";
import { KIND_LABEL } from "@/components/film/canvas/lib/labels";
import { cn } from "@/lib/utils";
import { useProjectStore } from "@/components/film/canvas/store/project-store";
import type { AppNode, AssetKind, NodeStatus } from "@/components/film/canvas/types/project";

const KIND_ICON: Record<AssetKind, ComponentType<{ className?: string }>> = {
  text: FileText,
  image: ImageIcon,
  video: Video,
  audio: Volume2,
  file: Paperclip,
  script: BookOpen,
  storyboard: Table2,
  scene: MapPinned,
  character: UserRound,
};

function AgentStatus({ status }: { status: NodeStatus }) {
  const tone =
    status === "success"
      ? "border-emerald-500/30 bg-emerald-950/70 text-emerald-300"
      : status === "running"
        ? "border-amber-500/30 bg-amber-950/70 text-amber-300"
        : status === "error"
          ? "border-rose-500/30 bg-rose-950/70 text-rose-300"
          : "border-white/10 bg-white/5 text-slate-400";
  const dot =
    status === "success"
      ? "bg-emerald-400 animate-pulse"
      : status === "running"
        ? "bg-amber-400 animate-pulse"
        : status === "error"
          ? "bg-rose-400"
          : "bg-slate-500";
  const label =
    status === "running"
      ? "生成中"
      : status === "success"
        ? "已完成"
        : status === "error"
          ? "失败"
          : "待生成";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        tone
      )}
    >
      <span className={cn("size-1.5 rounded-full", dot)} />
      {label}
    </span>
  );
}

function KindIcon({
  kind,
  on,
  tone,
}: {
  kind: AssetKind;
  on?: boolean;
  tone: "in" | "out";
}) {
  const Icon = KIND_ICON[kind];
  return (
    <div
      title={KIND_LABEL[kind]}
      className={cn(
        "flex size-8 items-center justify-center rounded-lg",
        tone === "in"
          ? on
            ? "bg-[#38bdf8]/15 text-cyan-300"
            : "text-slate-600"
          : on
            ? "bg-amber-500/15 text-amber-300"
            : "text-slate-600"
      )}
    >
      <Icon className="size-4" />
    </div>
  );
}

export function AgentNode({ id, data, selected }: NodeProps<AppNode>) {
  const spec = specOf({ id, data });
  const nodes = useProjectStore((s) => s.nodes);
  const edges = useProjectStore((s) => s.edges);
  const runAgent = useProjectStore((s) => s.runAgent);

  const inboundKinds: AssetKind[] = [];
  for (const edge of edges) {
    if (edge.target !== id || edge.data?.edgeKind === "out") continue;
    const src = nodes.find((node) => node.id === edge.source);
    const kind = assetKindOf(src);
    if (kind) inboundKinds.push(kind);
  }

  const connected = new Set(inboundKinds);
  const missing = spec ? missingInputs(spec, inboundKinds) : [];
  const ready = missing.length === 0 && inboundKinds.length > 0;
  const running = data.status === "running";
  const productEdge = edges.find((edge) => edge.source === id && edge.data?.edgeKind === "out");
  const hasProduct = Boolean(productEdge) || data.status === "success";
  const accepts = spec?.accepts ?? [];
  const emitKind = spec?.emits;
  const promptLine = hasCustomPrompt(data.promptOverride)
    ? "已自定义"
    : (spec?.prompts?.preview ?? "").trim() || null;
  const width = Math.max(268, 120 + accepts.length * 36);

  return (
    <NodeChrome id={id} data={data} selected={selected} width={width}>
      <div>
        <header className="border-b border-white/[0.06] px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-[#a78bfa]/30 bg-[#a78bfa]/10 text-[#a78bfa]">
                <Sparkles className="size-3.5" />
              </div>
              <div className="min-w-0">
                <p className="font-mono text-[10px] tracking-wider text-slate-500">智能体</p>
                <h2 className="truncate text-[15px] font-semibold tracking-tight text-white">
                  {spec?.label ?? data.label}
                </h2>
              </div>
            </div>
            <AgentStatus status={data.status} />
          </div>
        </header>

        <div className="flex items-center justify-center gap-1.5 px-3 py-3.5">
          <div className="flex items-center gap-0.5 rounded-2xl border border-cyan-400/15 bg-cyan-500/[0.04] px-1.5 py-1">
            {accepts.map((kind) => (
              <KindIcon key={kind} kind={kind} on={connected.has(kind)} tone="in" />
            ))}
          </div>
          <span className="h-px w-2.5 bg-gradient-to-r from-cyan-400/50 to-amber-300/40" />
          <button
            type="button"
            disabled={!ready || running}
            onClick={(e) => {
              e.stopPropagation();
              void runAgent(id);
            }}
            className="nodrag nowheel nopan relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border border-[#fbbf24]/70 bg-[#0b0d14] text-[#fbbf24] hover:scale-105 active:scale-95 disabled:border-white/10 disabled:text-slate-600 disabled:hover:scale-100"
            aria-label={running ? "生成中" : "跑一次"}
            title={running ? "生成中" : ready ? "跑一次" : "先连上输入"}
          >
            <Play className="size-3.5 fill-current" />
          </button>
          <span className="h-px w-2.5 bg-gradient-to-r from-amber-300/40 to-amber-400/50" />
          <div className="flex items-center rounded-2xl border border-amber-400/20 bg-amber-500/[0.05] px-1.5 py-1">
            {emitKind ? <KindIcon kind={emitKind} on={hasProduct} tone="out" /> : null}
          </div>
        </div>

        {data.status === "error" && data.errorMessage?.trim() ? (
          <p
            className="line-clamp-3 border-t border-rose-500/20 bg-rose-950/40 px-4 py-2 text-[11px] leading-snug text-rose-200"
            title={data.errorMessage}
          >
            {data.errorMessage}
          </p>
        ) : promptLine ? (
          <p
            className="truncate border-t border-white/[0.06] px-4 py-2 text-[11px] text-slate-500"
            title={promptLine}
          >
            {promptLine}
          </p>
        ) : null}
      </div>
    </NodeChrome>
  );
}
