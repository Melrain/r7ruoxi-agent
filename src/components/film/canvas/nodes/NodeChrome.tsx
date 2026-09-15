"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  ArrowRight,
  BookOpen,
  FileText,
  ImageIcon,
  MapPinned,
  Paperclip,
  Sparkles,
  Table2,
  UserRound,
  Video,
  Volume2,
} from "lucide-react";
import { useState, type ComponentType, type ReactNode } from "react";
import { fallbackPoster } from "@/components/film/canvas/lib/mock/assets";
import { agentsAccepting, assetKindOf } from "@/components/film/canvas/lib/agent-catalog";
import { AssignAgentMenu } from "@/components/film/canvas/nodes/AssignAgentMenu";
import { PORT_COLOR } from "@/components/film/canvas/lib/port-color";
import { cn } from "@/lib/utils";
import { KIND_LABEL, STATUS_LABEL } from "@/components/film/canvas/lib/labels";
import { useProjectStore } from "@/components/film/canvas/store/project-store";
import type { AppNode, NodeKind, NodeStatus } from "@/components/film/canvas/types/project";

const ICONS: Record<NodeKind, ComponentType<{ className?: string }>> = {
  text: FileText,
  image: ImageIcon,
  video: Video,
  audio: Volume2,
  file: Paperclip,
  script: BookOpen,
  storyboard: Table2,
  scene: MapPinned,
  character: UserRound,
  agent: Sparkles,
};

const ICON_TONE: Record<NodeKind, string> = {
  text: "text-amber-200/90",
  image: "text-cyan-400",
  video: "text-cyan-300",
  audio: "text-violet-300",
  file: "text-slate-400",
  script: "text-amber-400",
  storyboard: "text-amber-400",
  scene: "text-emerald-400",
  character: "text-rose-300",
  agent: "text-[#a78bfa]",
};

const CHIP: Record<NodeKind, string> = {
  text: "border-white/10 bg-white/[0.06] text-amber-200/90",
  image: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
  video: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
  audio: "border-violet-500/30 bg-violet-500/10 text-violet-300",
  file: "border-white/10 bg-white/[0.06] text-slate-300",
  script: "border-amber-600/40 bg-amber-900/40 text-amber-300",
  storyboard: "border-amber-600/40 bg-amber-900/40 text-amber-300",
  scene: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  character: "border-rose-500/25 bg-rose-500/10 text-rose-300",
  agent: "border-[#a78bfa]/30 bg-[#a78bfa]/10 text-[#a78bfa]",
};

const FAMILY: Record<NodeKind, string> = {
  text: "node-card-neutral",
  file: "node-card-neutral",
  image: "node-card-cyan",
  video: "node-card-cyan",
  script: "node-card-amber",
  storyboard: "node-card-amber",
  scene: "node-card-emerald",
  character: "node-card-rose",
  audio: "node-card-violet",
  agent: "",
};

export function StatusBadge({ status }: { status: NodeStatus }) {
  const tone =
    status === "success"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
      : status === "uploading"
        ? "border-sky-500/30 bg-sky-500/10 text-sky-300"
      : status === "running"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
        : status === "error"
          ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
          : "border-white/10 bg-slate-800 text-slate-400";
  const dot =
    status === "success"
      ? "bg-emerald-400"
      : status === "uploading"
        ? "bg-sky-400 animate-pulse"
      : status === "running"
        ? "bg-amber-400 animate-pulse"
        : status === "error"
          ? "bg-rose-400"
          : "bg-slate-500";
  const label =
    status === "uploading"
      ? "上传中"
      : status === "running"
        ? "生成中"
        : STATUS_LABEL[status];

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        tone
      )}
    >
      <span className={cn("size-1.5 rounded-full", dot)} />
      {label}
    </span>
  );
}

export function KindGlyph({ kind }: { kind: NodeKind }) {
  const Icon = ICONS[kind];
  return (
    <span className={cn("inline-flex size-5 items-center justify-center", ICON_TONE[kind])}>
      <Icon className="size-5" />
    </span>
  );
}

export function TypeChip({ kind }: { kind: NodeKind }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        CHIP[kind]
      )}
    >
      {KIND_LABEL[kind]}
    </span>
  );
}

export function NodeChrome({
  id,
  selected,
  data,
  children,
  width = 300,
}: Pick<NodeProps<AppNode>, "id" | "selected" | "data"> & {
  children: ReactNode;
  width?: number;
}) {
  const renaming = useProjectStore((s) => s.renamingNodeId === id);
  const setRenamingNodeId = useProjectStore((s) => s.setRenamingNodeId);
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const assignAgent = useProjectStore((s) => s.assignAgent);
  const isAgent = data.role === "agent" || data.kind === "agent";
  const [handoff, setHandoff] = useState(false);
  const kind = assetKindOf({ id, data } as AppNode);
  const options = !isAgent && kind ? agentsAccepting(kind) : [];
  const boxed = data.kind === "script" || data.kind === "storyboard";
  const Icon = ICONS[data.kind];

  return (
    <div className="relative" style={{ width }}>
      <div
        className={cn(
          "node-card",
          isAgent && "node-card-agent",
          !isAgent && FAMILY[data.kind],
          selected && "is-selected",
          (data.status === "running" || data.status === "uploading") && "is-running"
        )}
      >
        <Handle
          type="target"
          position={Position.Left}
          className="node-handle"
          isConnectable={isAgent}
          style={{ background: isAgent ? "#38bdf8" : PORT_COLOR[data.kind] }}
        />
        <div className={isAgent ? "p-0" : "p-5"}>
          {isAgent ? null : (
            <div className="mb-3 flex items-center justify-between gap-2 border-b border-white/[0.06] pb-3.5">
              <div className="flex min-w-0 items-center gap-2.5">
                {boxed ? (
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-400">
                    <Icon className="size-4" />
                  </span>
                ) : (
                  <KindGlyph kind={data.kind} />
                )}
                {renaming ? (
                  <input
                    autoFocus
                    defaultValue={data.label}
                    className="nodrag nowheel min-w-0 flex-1 rounded bg-black/30 px-1 text-[15px] text-slate-100 outline-none ring-1 ring-amber-400/30"
                    onBlur={(e) => {
                      updateNodeData(id, { label: e.target.value.trim() || data.label });
                      setRenamingNodeId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      if (e.key === "Escape") setRenamingNodeId(null);
                    }}
                  />
                ) : (
                  <div className="min-w-0 truncate text-base font-semibold tracking-wide text-slate-100">
                    {data.label || KIND_LABEL[data.kind]}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <TypeChip kind={data.kind} />
                <StatusBadge status={data.status} />
              </div>
            </div>
          )}
          {children}
          {!isAgent && options.length > 0 && (selected || handoff) ? (
            <div className="nodrag nowheel nopan relative mt-3 flex items-center justify-end border-t border-white/[0.04] pt-2.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setHandoff((open) => !open);
                }}
                className="group inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] text-slate-500 opacity-70 hover:bg-white/[0.04] hover:text-slate-300 hover:opacity-100"
              >
                <span>交给…</span>
                <ArrowRight className="size-2.5 transition-transform group-hover:translate-x-0.5" />
              </button>
              {handoff && kind ? (
                <AssignAgentMenu
                  kind={kind}
                  className="absolute bottom-10 left-0"
                  onPick={(agentId) => {
                    assignAgent(id, agentId);
                    setHandoff(false);
                  }}
                />
              ) : null}
            </div>
          ) : null}
        </div>
        <Handle
          type="source"
          position={Position.Right}
          className={cn("node-handle", isAgent && "node-handle-out")}
          isConnectable={!isAgent}
          style={{ background: PORT_COLOR[data.kind] }}
        />
      </div>
    </div>
  );
}

export function AssetFrame({
  src,
  alt,
  running,
  empty,
  hint,
  kind,
  prompt,
}: {
  src?: string;
  alt: string;
  running?: boolean;
  empty: string;
  hint?: string;
  kind: NodeKind;
  prompt?: string;
}) {
  const [brokenSrc, setBrokenSrc] = useState<string | null>(null);
  const resolved = src
    ? brokenSrc === src
      ? fallbackPoster(kind, prompt ?? alt)
      : src
    : undefined;

  if (running) {
    return (
      <div className="flex aspect-[16/10] items-center justify-center rounded-xl border border-dashed border-amber-400/30 bg-[#07080c]/80 text-[12px] text-amber-300">
        正在生成占位素材…
      </div>
    );
  }
  if (!src && !resolved) {
    return (
      <div className="flex aspect-[16/10] flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-[#07080c]/80 px-4 text-center">
        <span className="mb-2 flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-slate-400">
          <Sparkles className="size-5" />
        </span>
        <p className="text-sm font-medium tracking-wide text-slate-400">{empty}</p>
        {hint ? <p className="mt-0.5 text-[11px] text-slate-600">{hint}</p> : null}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolved}
      alt={alt}
      onError={() => setBrokenSrc(src ?? null)}
      className="aspect-[16/10] w-full rounded-xl object-cover"
    />
  );
}
