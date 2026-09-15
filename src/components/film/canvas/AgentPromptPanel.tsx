"use client";

import { Play, RotateCcw, Square, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  PROMPT_PILL_LABEL,
  assetKindOf,
  assetLabel,
  effectivePrompts,
  hasCustomPrompt,
  inspectAgent,
  missingSlots,
  promptPillState,
  specOf,
  type PromptPillState,
} from "@/components/film/canvas/lib/agent-catalog";
import { KIND_LABEL } from "@/components/film/canvas/lib/labels";
import { cn } from "@/lib/utils";
import { useProjectStore } from "@/components/film/canvas/store/project-store";
import type {
  AgentPromptOverride,
  AppNode,
  AssetKind,
} from "@/components/film/canvas/types/project";
import {
  listAgentSkills,
  type AgentSkillListItem,
} from "@/lib/api/skills";

function Pill({ state }: { state: PromptPillState }) {
  const tone =
    state === "missing"
      ? "border-rose-400/40 bg-rose-500/15 text-rose-200"
      : state === "overridden"
        ? "border-amber-400/40 bg-amber-500/15 text-amber-200"
        : "border-white/10 bg-white/5 text-zinc-400";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[10px] tracking-wider",
        tone
      )}
    >
      {PROMPT_PILL_LABEL[state]}
    </span>
  );
}

function patchOverride(
  current: AgentPromptOverride | undefined,
  patch: AgentPromptOverride
): AgentPromptOverride {
  return { ...(current ?? {}), ...patch };
}

export function AgentPromptPanel({ node }: { node: AppNode }) {
  const nodes = useProjectStore((s) => s.nodes);
  const edges = useProjectStore((s) => s.edges);
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const closeNodeDetail = useProjectStore((s) => s.closeNodeDetail);
  const runAgent = useProjectStore((s) => s.runAgent);
  const cancelAgentRun = useProjectStore((s) => s.cancelAgentRun);
  const showToast = useProjectStore((s) => s.showToast);

  const spec = specOf(node);
  const inspect = inspectAgent(node, nodes, edges);
  const override = node.data.promptOverride;
  const prompts = effectivePrompts(spec, override);
  const custom = hasCustomPrompt(override);

  const inboundKinds: AssetKind[] = [];
  for (const edge of edges) {
    if (edge.target !== node.id || edge.data?.edgeKind === "out") continue;
    const src = nodes.find((n) => n.id === edge.source);
    const kind = assetKindOf(src);
    if (kind) inboundKinds.push(kind);
  }
  const hung = new Set(inboundKinds);
  const pill = promptPillState(spec, override, inboundKinds);
  const missing = missingSlots(spec, override, inboundKinds);
  const running = node.data.status === "running";
  const canRun = Boolean(inspect?.canRun) && missing.length === 0;
  const isParse = node.data.agentId === "parse";
  const [skills, setSkills] = useState<AgentSkillListItem[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [skillsError, setSkillsError] = useState<string | null>(null);

  useEffect(() => {
    if (!isParse) return;
    let cancelled = false;
    setSkillsLoading(true);
    setSkillsError(null);
    void listAgentSkills({ agent: "parse", status: "published" })
      .then((rows) => {
        if (cancelled) return;
        setSkills(rows.filter((r) => r.source === "official" || r.status === "published"));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setSkillsError(err instanceof Error ? err.message : "加载 Skill 失败");
      })
      .finally(() => {
        if (!cancelled) setSkillsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isParse]);

  const writeOverride = (patch: AgentPromptOverride) => {
    updateNodeData(node.id, {
      promptOverride: patchOverride(override, patch),
    });
  };

  const restoreDefaults = () => {
    updateNodeData(node.id, { promptOverride: undefined });
    showToast("已恢复目录默认提示词");
  };

  return (
    <div
      data-testid="agent-prompt-panel"
      className="flex min-h-0 flex-1 flex-col"
    >
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/6 px-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] tracking-wider text-zinc-500">
              智能体提示词
            </p>
            <p className="truncate text-[14px] font-medium text-zinc-100">
              {spec?.label ?? node.data.label}
            </p>
          </div>
          <Pill state={pill} />
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            disabled={!custom}
            onClick={restoreDefaults}
            className="gap-1.5"
          >
            <RotateCcw className="size-3.5" />
            恢复目录默认
          </Button>
          {running ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => cancelAgentRun(node.id)}
              className="gap-1.5"
            >
              <Square className="size-3 fill-current" />
              取消
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={!canRun}
              onClick={() => void runAgent(node.id)}
              className="gap-1.5"
            >
              <Play className="size-3.5 fill-current" />
              跑一次
            </Button>
          )}
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="关闭详情"
            onClick={() => closeNodeDetail()}
          >
            <X className="size-4" />
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Top: contract 入/出 */}
        <section className="border-b border-white/6 px-5 py-4">
          <p className="mb-2 font-mono text-[10px] tracking-[0.18em] text-zinc-500">
            合同
          </p>
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className="text-zinc-500">入</span>
            {(spec?.accepts ?? []).map((kind) => (
              <span
                key={kind}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-[12px]",
                  hung.has(kind)
                    ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-200"
                    : "border-white/8 text-zinc-500"
                )}
              >
                {KIND_LABEL[kind]}
              </span>
            ))}
            <span className="mx-1 text-zinc-600">→</span>
            <span className="text-zinc-500">出</span>
            {spec?.emits ? (
              <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-2.5 py-0.5 text-[12px] text-amber-200">
                {KIND_LABEL[spec.emits]}
              </span>
            ) : null}
          </div>
          {inspect?.hung.length ? (
            <p className="mt-2 text-[12px] text-zinc-500">
              已挂：
              {inspect.hung
                .map((item) => `${assetLabel(item.kind)}「${item.label}」`)
                .join("、")}
            </p>
          ) : (
            <p className="mt-2 text-[12px] text-zinc-600">还没有输入连上</p>
          )}
        </section>


        {isParse ? (
          <section
            data-testid="agent-skill-select"
            className="border-b border-white/6 px-5 py-4"
          >
            <p className="mb-2 font-mono text-[10px] tracking-[0.18em] text-zinc-500">
              Skill 装配
            </p>
            <p className="mb-3 text-[12px] leading-relaxed text-zinc-500">
              主路径：从底部栏 /「+」打开 Skill 库 → 放到画布 → 右出点连到本智能体。
              入边 Skill 为真相源；下方下拉仅作次要兜底。
            </p>
            <details className="rounded-lg border border-white/8 bg-black/20 px-3 py-2">
              <summary className="cursor-pointer select-none text-[12px] text-zinc-400">
                次要：节点 skillId 下拉
              </summary>
              <select
                className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[13px] text-zinc-100 outline-none focus:border-violet-400/50"
                value={node.data.skillId ?? ""}
                disabled={skillsLoading}
                onChange={(e) => {
                  const id = e.target.value;
                  if (!id) {
                    updateNodeData(node.id, {
                      skillId: undefined,
                      skillName: undefined,
                    });
                    return;
                  }
                  const hit = skills.find((s) => s.id === id);
                  updateNodeData(node.id, {
                    skillId: id,
                    skillName: hit?.name,
                  });
                }}
              >
                <option value="">
                  {skillsLoading
                    ? "加载中…"
                    : "默认（服务端 video-parse / 目录）"}
                </option>
                {skills.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} · {s.name}@{s.version}
                  </option>
                ))}
              </select>
              {skillsError ? (
                <p className="mt-2 text-[11px] text-rose-300">{skillsError}</p>
              ) : (
                <p className="mt-2 text-[11px] text-zinc-600">
                  跑解析时优先用入边 Skill 的 skillId，其次才用本下拉。
                </p>
              )}
            </details>
            <label className="mt-4 block">
              <span className="mb-1.5 block font-mono text-[10px] tracking-[0.18em] text-zinc-500">
                短补充（可选）
              </span>
              <Textarea
                value={node.data.promptSupplement ?? ""}
                onChange={(e) =>
                  updateNodeData(node.id, {
                    promptSupplement: e.target.value || undefined,
                  })
                }
                rows={3}
                placeholder="追加到 Skill / 目录默认之后的短补充…"
                className="min-h-[72px] resize-y border-white/8 bg-black/30 text-[13px] leading-6"
              />
            </label>
          </section>
        ) : null}

        {/* Bottom: prompts */}
        <section className="space-y-5 px-5 py-5">
          <label className="block">
            <span className="mb-1.5 flex items-center justify-between font-mono text-[10px] tracking-[0.18em] text-zinc-500">
              <span>system</span>
              {override?.system !== undefined ? (
                <span className="text-amber-400/80">已改</span>
              ) : null}
            </span>
            <Textarea
              value={prompts.system}
              onChange={(e) => writeOverride({ system: e.target.value })}
              rows={5}
              className="min-h-[110px] resize-y border-white/8 bg-black/30 text-[13px] leading-6"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 flex items-center justify-between font-mono text-[10px] tracking-[0.18em] text-zinc-500">
              <span>userTemplate</span>
              {override?.userTemplate !== undefined ? (
                <span className="text-amber-400/80">已改</span>
              ) : null}
            </span>
            <Textarea
              value={prompts.userTemplate}
              onChange={(e) => writeOverride({ userTemplate: e.target.value })}
              rows={6}
              className="min-h-[130px] resize-y border-white/8 bg-black/30 font-mono text-[12px] leading-6"
            />
            <p className="mt-1.5 text-[11px] text-zinc-600">
              用 {"{{slotKey}}"} 引用下方槽位；跑一次时会填入已挂资产摘要。
            </p>
          </label>

          <div>
            <p className="mb-2 font-mono text-[10px] tracking-[0.18em] text-zinc-500">
              slots
            </p>
            <div className="overflow-hidden rounded-xl border border-white/8">
              <table className="w-full text-left text-[12px]">
                <thead className="bg-white/[0.03] text-zinc-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">key</th>
                    <th className="px-3 py-2 font-medium">from</th>
                    <th className="px-3 py-2 font-medium">必填</th>
                    <th className="px-3 py-2 font-medium">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {prompts.slots.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-3 py-4 text-center text-zinc-600"
                      >
                        目录未声明槽位
                      </td>
                    </tr>
                  ) : (
                    prompts.slots.map((slot) => {
                      const connected =
                        slot.from === "meta" || hung.has(slot.from);
                      const isMissing = Boolean(slot.required) && !connected;
                      return (
                        <tr
                          key={slot.key}
                          className="border-t border-white/6"
                        >
                          <td className="px-3 py-2 font-mono text-zinc-200">
                            {slot.key}
                          </td>
                          <td className="px-3 py-2 text-zinc-400">
                            {slot.from === "meta"
                              ? "meta"
                              : KIND_LABEL[slot.from]}
                          </td>
                          <td className="px-3 py-2 text-zinc-400">
                            {slot.required ? "是" : "—"}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[11px]",
                                isMissing
                                  ? "bg-rose-500/15 text-rose-300"
                                  : connected
                                    ? "bg-emerald-500/15 text-emerald-300"
                                    : "bg-white/5 text-zinc-500"
                              )}
                            >
                              {isMissing
                                ? "缺槽"
                                : connected
                                  ? "已连"
                                  : "未连"}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {missing.length > 0 ? (
              <p className="mt-2 text-[12px] text-rose-300/90">
                缺槽：
                {missing
                  .map(
                    (s) =>
                      `${s.key}（${s.from === "meta" ? "meta" : KIND_LABEL[s.from]}）`
                  )
                  .join("、")}
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
