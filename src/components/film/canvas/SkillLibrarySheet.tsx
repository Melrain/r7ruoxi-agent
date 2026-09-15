"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Wand2 } from "lucide-react";
import {
  getAgentSkill,
  listAgentSkills,
  type AgentSkillDetail,
  type AgentSkillListItem,
} from "@/lib/api/skills";
import { SKILL_AGENT_LABEL } from "@/components/film/canvas/lib/agent-catalog";
import {
  normalizeAgentSkillList,
  placeSkillOnCanvas,
} from "@/components/film/canvas/lib/place-skill";
import { cn } from "@/lib/utils";
import { useProjectStore } from "@/components/film/canvas/store/project-store";

const AGENT_FILTERS: { id: string; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "parse", label: "视频解析" },
  { id: "script", label: "生成剧本" },
  { id: "image", label: "出图" },
];

export function SkillLibrarySheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const showToast = useProjectStore((s) => s.showToast);
  const [agentFilter, setAgentFilter] = useState("all");
  const [items, setItems] = useState<AgentSkillListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AgentSkillDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailRetryKey, setDetailRetryKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (opts: { agent?: string; signal?: AbortSignal }) => {
      setLoading(true);
      setError(null);
      try {
        const raw = await listAgentSkills({
          agent: opts.agent,
          status: "published",
          signal: opts.signal,
        });
        if (opts.signal?.aborted) return;
        // Defensive: never hide seeded rows if API shape drifts
        const rows = normalizeAgentSkillList(raw);
        setItems(rows);
        setSelectedId((prev) => {
          if (prev && rows.some((r) => r.id === prev)) return prev;
          return rows[0]?.id ?? null;
        });
      } catch (err) {
        if (opts.signal?.aborted) return;
        if (
          (typeof DOMException !== "undefined" &&
            err instanceof DOMException &&
            err.name === "AbortError") ||
          (err instanceof Error && err.name === "AbortError")
        ) {
          return;
        }
        const message = err instanceof Error ? err.message : "加载 Skill 失败";
        setError(message);
        setItems([]);
        setSelectedId(null);
        showToast(message);
      } finally {
        if (!opts.signal?.aborted) setLoading(false);
      }
    },
    [showToast],
  );

  useEffect(() => {
    if (!open) return;
    const ac = new AbortController();
    const agent = agentFilter === "all" ? undefined : agentFilter;
    void load({ agent, signal: ac.signal });
    return () => ac.abort();
  }, [open, agentFilter, load]);

  useEffect(() => {
    if (!open || !selectedId) {
      setDetail(null);
      setDetailError(null);
      setDetailLoading(false);
      return;
    }
    const ac = new AbortController();
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    void getAgentSkill(selectedId, { signal: ac.signal })
      .then((row) => {
        if (ac.signal.aborted) return;
        setDetail(row);
        setDetailError(null);
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
        const message =
          err instanceof Error ? err.message : "加载 Skill 详情失败";
        setDetail(null);
        setDetailError(message);
        showToast(message);
      })
      .finally(() => {
        if (!ac.signal.aborted) setDetailLoading(false);
      });
    return () => ac.abort();
  }, [open, selectedId, detailRetryKey, showToast]);

  const selectedListItem = useMemo(
    () => items.find((r) => r.id === selectedId) ?? null,
    [items, selectedId],
  );

  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-40"
      onClick={() => onOpenChange(false)}
      role="presentation"
    >
      <div className="absolute inset-0 bg-black/25" aria-hidden />
      <div
        className="absolute bottom-[4.75rem] left-1/2 z-10 flex h-[min(420px,52vh)] w-[min(720px,calc(100vw-1.5rem))] -translate-x-1/2 overflow-hidden rounded-2xl border border-[#a78bfa]/20 bg-[#16130f]/95 shadow-[0_16px_48px_rgba(0,0,0,0.55)] backdrop-blur-md sm:bottom-[5.25rem]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Skill 库"
        data-testid="skill-library-sheet"
      >
        {/* Left: list */}
        <div className="flex w-[42%] min-w-0 flex-col border-r border-white/6">
          <div className="flex items-center justify-between border-b border-white/6 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[13px] text-zinc-200">
              <Wand2 className="size-3.5 text-[#a78bfa]" />
              Skill
              {!loading && !error ? (
                <span className="font-mono text-[10px] text-zinc-500">
                  {items.length}
                </span>
              ) : null}
            </div>
            <button
              type="button"
              className="rounded-full px-2 py-0.5 text-[11px] text-zinc-500 hover:bg-white/6 hover:text-zinc-300"
              onClick={() => onOpenChange(false)}
            >
              关闭
            </button>
          </div>
          <div
            className="flex flex-wrap gap-1 border-b border-white/6 px-2 py-1.5"
            data-testid="skill-library-agent-filters"
          >
            {AGENT_FILTERS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                data-testid={`skill-filter-${tab.id}`}
                aria-pressed={agentFilter === tab.id}
                onClick={() => setAgentFilter(tab.id)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[12px]",
                  agentFilter === tab.id
                    ? "bg-[#a78bfa]/15 text-[#c4b5fd]"
                    : "text-zinc-500 hover:bg-white/6 hover:text-zinc-300",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-[12px] text-zinc-500">
                <Loader2 className="size-3.5 animate-spin" />
                加载中…
              </div>
            ) : error && items.length === 0 ? (
              <div className="py-10 text-center text-[12px] text-red-300/80">
                {error}
              </div>
            ) : items.length === 0 ? (
              <div className="space-y-2 px-2 py-10 text-center text-[12px] text-zinc-600">
                <p>还没有 published Skill</p>
                <p className="text-[11px] leading-relaxed text-zinc-500">
                  本地可跑：
                  <span className="font-mono text-zinc-400">
                    npx ts-node --transpile-only scripts/seed-agent-skills.ts
                  </span>
                  （应有 video-parse / script-continue / shot-image）
                </p>
              </div>
            ) : (
              <ul className="flex flex-col gap-1">
                {items.map((item) => {
                  const active = item.id === selectedId;
                  const agentLabel =
                    SKILL_AGENT_LABEL[item.agent] ?? item.agent;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(item.id)}
                        className={cn(
                          "flex w-full flex-col gap-0.5 rounded-xl border px-2.5 py-2 text-left",
                          active
                            ? "border-[#a78bfa]/35 bg-[#a78bfa]/10"
                            : "border-transparent hover:border-white/8 hover:bg-white/5",
                        )}
                      >
                        <span className="truncate text-[12px] text-zinc-100">
                          {item.title || item.name}
                        </span>
                        <span className="truncate font-mono text-[10px] text-zinc-600">
                          {agentLabel}
                          {item.version ? ` · v${item.version}` : ""}
                          {item.name ? ` · ${item.name}` : ""}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Right: read-only detail */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-2 border-b border-white/6 px-4 py-3">
            <div className="min-w-0">
              <p className="font-mono text-[10px] tracking-wider text-zinc-500">
                只读预览
              </p>
              <h3 className="truncate text-[15px] font-semibold text-zinc-100">
                {detail?.title ||
                  selectedListItem?.title ||
                  (detailLoading ? "加载中…" : "选择 Skill")}
              </h3>
              <p className="mt-0.5 truncate font-mono text-[11px] text-zinc-500">
                {(detail || selectedListItem)?.name ?? "—"}
                {(detail || selectedListItem)?.version
                  ? ` @ v${(detail || selectedListItem)?.version}`
                  : ""}
                {(detail || selectedListItem)?.agent
                  ? ` · ${
                      SKILL_AGENT_LABEL[
                        (detail || selectedListItem)!.agent
                      ] ?? (detail || selectedListItem)!.agent
                    }`
                  : ""}
              </p>
            </div>
            <button
              type="button"
              disabled={!detail && !selectedListItem}
              data-testid="skill-place-on-canvas"
              onClick={() => {
                const row = detail ?? selectedListItem;
                if (!row) return;
                placeSkillOnCanvas(row);
                onOpenChange(false);
              }}
              className="shrink-0 rounded-full border border-[#a78bfa]/40 bg-[#a78bfa]/15 px-3 py-1.5 text-[12px] text-[#c4b5fd] hover:bg-[#a78bfa]/25 disabled:cursor-not-allowed disabled:opacity-40"
            >
              放到画布
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {detailLoading && !detail ? (
              <div className="flex items-center gap-2 py-8 text-[12px] text-zinc-500">
                <Loader2 className="size-3.5 animate-spin" />
                加载正文…
              </div>
            ) : detailError ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <p className="text-[12px] text-red-300/90">{detailError}</p>
                <button
                  type="button"
                  data-testid="skill-detail-retry"
                  onClick={() => setDetailRetryKey((k) => k + 1)}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[12px] text-zinc-300 hover:bg-white/10"
                >
                  重试
                </button>
              </div>
            ) : detail?.body?.trim() ? (
              <pre className="whitespace-pre-wrap break-words font-sans text-[12px] leading-relaxed text-zinc-300">
                {detail.body}
              </pre>
            ) : (
              <p className="py-8 text-center text-[12px] text-zinc-600">
                {items.length === 0
                  ? "还没有 Skill"
                  : selectedId
                    ? "正文为空"
                    : "选择左侧 Skill 查看正文"}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
