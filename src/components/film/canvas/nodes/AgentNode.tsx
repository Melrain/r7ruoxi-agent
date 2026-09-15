"use client";

import type { NodeProps } from "@xyflow/react";
import {
  BookOpen,
  FileText,
  ImageIcon,
  Loader2,
  MapPinned,
  Paperclip,
  Play,
  Sparkles,
  Table2,
  Wand2,
  UserRound,
  Video,
  Volume2,
  Square,
} from "lucide-react";
import { useEffect, useState, type ComponentType } from "react";
import { getAgentSkill } from "@/lib/api/skills";
import { NodeChrome } from "@/components/film/canvas/nodes/NodeChrome";
import {
  assetKindOf,
  hasCustomPrompt,
  missingInputs,
  resolveEquippedSkill,
  shortSkillTitle,
  SKILL_ASSEMBLABLE_AGENTS,
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
  const cancelAgentRun = useProjectStore((s) => s.cancelAgentRun);
  const [skillSummaryOpen, setSkillSummaryOpen] = useState(false);
  const [skillBody, setSkillBody] = useState<string | null>(null);
  const [skillBodyLoading, setSkillBodyLoading] = useState(false);
  const [skillBodyError, setSkillBodyError] = useState<string | null>(null);
  const [skillBodyRetryKey, setSkillBodyRetryKey] = useState(0);

  const inboundKinds: AssetKind[] = [];
  for (const edge of edges) {
    if (edge.target !== id || edge.data?.edgeKind === "out") continue;
    const src = nodes.find((node) => node.id === edge.source);
    const kind = assetKindOf(src);
    if (kind) inboundKinds.push(kind);
  }

  const equipped = resolveEquippedSkill(id, nodes, edges);

  useEffect(() => {
    if (!skillSummaryOpen || !equipped?.skillId) {
      setSkillBody(null);
      setSkillBodyError(null);
      setSkillBodyLoading(false);
      return;
    }
    const skillId = equipped.skillId;
    const ac = new AbortController();
    setSkillBody(null);
    setSkillBodyError(null);
    setSkillBodyLoading(true);
    void getAgentSkill(skillId, { signal: ac.signal })
      .then((row) => {
        if (ac.signal.aborted) return;
        setSkillBody(row.body ?? "");
        setSkillBodyError(null);
      })
      .catch((err: unknown) => {
        if (ac.signal.aborted) return;
        if (
          (typeof DOMException !== "undefined" &&
            err instanceof DOMException &&
            err.name === "AbortError") ||
          (err instanceof Error && err.name === "AbortError")
        ) {
          return;
        }
        setSkillBody(null);
        setSkillBodyError(
          err instanceof Error ? err.message : "加载 Skill 正文失败",
        );
      })
      .finally(() => {
        if (!ac.signal.aborted) setSkillBodyLoading(false);
      });
    return () => ac.abort();
  }, [skillSummaryOpen, equipped?.skillId, skillBodyRetryKey]);

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
  const acceptsSkill = Boolean(
    spec?.id && SKILL_ASSEMBLABLE_AGENTS.has(spec.id)
  );

  return (
    <NodeChrome
      id={id}
      data={data}
      selected={selected}
      width={width}
      skillPort={
        acceptsSkill
          ? { show: true, equipped: Boolean(equipped) }
          : undefined
      }
    >
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
          {equipped ? (
            <div className="relative mt-2">
              <button
                type="button"
                data-testid="agent-skill-chip"
                className="nodrag nowheel nopan inline-flex max-w-full items-center gap-1 rounded-full border border-[#a78bfa]/40 bg-[#a78bfa]/10 px-2 py-0.5 text-[11px] text-[#c4b5fd] hover:bg-[#a78bfa]/20"
                title="查看已装配 Skill"
                onClick={(e) => {
                  e.stopPropagation();
                  setSkillSummaryOpen((v) => !v);
                }}
              >
                <Wand2 className="size-3 shrink-0" />
                <span className="truncate">
                  Skill · {shortSkillTitle(equipped.title)}
                </span>
              </button>
              {skillSummaryOpen ? (
                <div
                  className="nodrag nowheel nopan absolute left-0 top-full z-30 mt-1 w-[220px] rounded-xl border border-white/10 bg-[#0b0d13] p-2.5 shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="text-[11px] font-medium text-zinc-200">
                    {equipped.title}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] text-zinc-500">
                    {equipped.name || "—"}
                    {equipped.version ? ` @ v${equipped.version}` : ""}
                  </p>
                  <div className="mt-2 max-h-28 overflow-y-auto text-[10px] leading-relaxed text-zinc-400">
                    {skillBodyLoading && skillBody == null ? (
                      <div className="flex items-center gap-1.5 py-1">
                        <Loader2 className="size-3 animate-spin" />
                        加载正文…
                      </div>
                    ) : skillBodyError ? (
                      <div className="flex flex-col gap-1.5 py-1">
                        <p className="text-red-300/90">{skillBodyError}</p>
                        <button
                          type="button"
                          data-testid="agent-skill-body-retry"
                          className="self-start rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-zinc-300 hover:bg-white/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSkillBodyRetryKey((k) => k + 1);
                          }}
                        >
                          重试
                        </button>
                      </div>
                    ) : skillBody?.trim() ? (
                      <p className="whitespace-pre-wrap">{skillBody}</p>
                    ) : (
                      <p>（正文为空）</p>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
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
            disabled={!running && !ready}
            onClick={(e) => {
              e.stopPropagation();
              if (running) {
                cancelAgentRun(id);
                return;
              }
              void runAgent(id);
            }}
            className="nodrag nowheel nopan relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border border-[#fbbf24]/70 bg-[#0b0d14] text-[#fbbf24] hover:scale-105 active:scale-95 disabled:border-white/10 disabled:text-slate-600 disabled:hover:scale-100"
            aria-label={running ? "取消生成" : "跑一次"}
            title={running ? "取消生成" : ready ? "跑一次" : "先连上输入"}
          >
            {running ? (
              <Square className="size-3 fill-current" />
            ) : (
              <Play className="size-3.5 fill-current" />
            )}
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
