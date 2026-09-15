"use client";

import { useEffect, useState } from "react";
import { getAgentSkill } from "@/lib/api/skills";
import { ImageIcon, Loader2, RefreshCw, Share2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { fallbackPoster } from "@/components/film/canvas/lib/mock/assets";
import { refreshNodeAssetUrls, retryNodeAssetUrlOnError } from "@/components/film/canvas/lib/refresh-node-asset-urls";
import { resolveMediaSrc } from "@/components/film/canvas/lib/resolve-asset-url";
import { KIND_LABEL, STATUS_LABEL } from "@/components/film/canvas/lib/labels";
import { pickAndAttachAsset } from "@/components/film/canvas/lib/pick-local-file";
import { AgentPromptPanel } from "@/components/film/canvas/AgentPromptPanel";
import { isAgentNode, isSkillNode, SKILL_AGENT_LABEL } from "@/components/film/canvas/lib/agent-catalog";
import {
  breakdownTextSummaryLine,
  isBreakdownAssetData,
} from "@/components/film/canvas/lib/breakdown-script-rows";
import { isTextAssetCardData } from "@/components/film/canvas/nodes/TextAssetCardNode";
import {
  textAssetRoleLabel,
  type TextAssetRole,
} from "@/components/film/canvas/lib/extract-text-assets";
import { cn } from "@/lib/utils";
import { useProjectStore } from "@/components/film/canvas/store/project-store";

export function NodeDetailOverlay() {
  const viewMode = useProjectStore((s) => s.viewMode);
  const detailNodeId = useProjectStore((s) => s.detailNodeId);
  const nodes = useProjectStore((s) => s.nodes);
  const closeNodeDetail = useProjectStore((s) => s.closeNodeDetail);
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const showToast = useProjectStore((s) => s.showToast);
  const generateStickyImage = useProjectStore((s) => s.generateStickyImage);
  const node = nodes.find((n) => n.id === detailNodeId);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
  }, [node?.id, node?.data.assetUrl]);

  useEffect(() => {
    if (!node) return;
    const assetId = node.data.assetId?.trim();
    if (!assetId) return;
    const url = node.data.assetUrl?.trim();
    if (url) return;
    const ac = new AbortController();
    void refreshNodeAssetUrls({ nodeIds: [node.id], signal: ac.signal });
    return () => ac.abort();
  }, [node?.id, node?.data.assetId, node?.data.assetUrl]);

  if (!node || viewMode !== "workflow") return null;

  if (isAgentNode(node)) {
    return (
      <div
        data-testid="node-detail"
        className="absolute inset-0 z-[60] flex bg-[#14161c]"
      >
        <AgentPromptPanel node={node} />
      </div>
    );
  }

  if (isSkillNode(node)) {
    return (
      <div
        data-testid="node-detail"
        className="absolute inset-0 z-[60] flex flex-col bg-[#14161c]"
      >
        <SkillDetailBody
          node={node}
          onClose={() => closeNodeDetail()}
          showToast={showToast}
        />
      </div>
    );
  }


  if (isBreakdownAssetData(node.data)) {
    const rows = node.data.scriptRows ?? [];
    const statusLabel =
      node.data.status === "running"
        ? "生成中"
        : node.data.status === "uploading"
          ? "上传中"
          : STATUS_LABEL[node.data.status];
    const fullText = (node.data.text || node.data.prompt || "").trim();
    const summary = rows.length === 0 ? breakdownTextSummaryLine(fullText) : "";

    return (
      <div
        data-testid="node-detail"
        className="absolute inset-0 z-[60] flex flex-col bg-[#14161c]"
      >
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/6 px-4">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-[14px] font-medium">拆解 · {rows.length} 镜</p>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px]",
                node.data.status === "success" &&
                  "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
                node.data.status === "running" &&
                  "border-amber-500/30 bg-amber-500/10 text-amber-300",
                node.data.status === "error" &&
                  "border-rose-500/30 bg-rose-500/10 text-rose-300",
                (node.data.status === "idle" || node.data.status === "uploading") &&
                  "border-white/10 bg-white/[0.04] text-zinc-400",
              )}
            >
              {statusLabel}
            </span>
          </div>
          <div className="flex items-center gap-1">
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
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {node.data.status === "running" ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="space-y-2 rounded-lg border border-white/[0.05] bg-black/20 p-3"
                >
                  <div className="h-3 w-14 animate-pulse rounded bg-white/10" />
                  <div className="h-3 w-full animate-pulse rounded bg-white/[0.06]" />
                  <div className="h-3 w-2/3 animate-pulse rounded bg-white/[0.04]" />
                </div>
              ))}
            </div>
          ) : rows.length > 0 ? (
            <ul className="divide-y divide-white/[0.06]">
              {rows.map((row) => (
                <li key={row.id} className="px-1 py-3">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[12px] font-semibold text-amber-200/90">
                      {row.shotId || "—"}
                    </span>
                  </div>
                  {row.visualDesc ? (
                    <div className="mb-1 flex items-start gap-2 text-[12px] text-zinc-300">
                      <span className="shrink-0 text-[10px] font-medium text-zinc-500">
                        画面
                      </span>
                      <span className="whitespace-pre-wrap leading-5">{row.visualDesc}</span>
                    </div>
                  ) : null}
                  {row.dialogue ? (
                    <div className="flex items-start gap-2 text-[12px] text-zinc-400">
                      <span className="shrink-0 text-[10px] font-medium text-indigo-400/80">
                        对白
                      </span>
                      <span className="whitespace-pre-wrap leading-5">{row.dialogue}</span>
                    </div>
                  ) : null}
                  {!row.visualDesc && !row.dialogue ? (
                    <p className="text-[12px] text-zinc-600">暂无画面/对白内容</p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : fullText ? (
            <div className="space-y-3">
              {summary ? (
                <p className="text-[13px] text-zinc-400">{summary}</p>
              ) : null}
              <pre className="whitespace-pre-wrap rounded-lg border border-white/[0.06] bg-black/20 p-3 text-[13px] leading-6 text-zinc-300">
                {fullText}
              </pre>
            </div>
          ) : (
            <p className="py-10 text-center text-[13px] text-zinc-500">暂无镜号</p>
          )}
        </div>
        {fullText ? (
          <footer className="flex shrink-0 justify-end border-t border-white/6 px-4 py-2">
            <button
              type="button"
              className="text-[11px] text-zinc-500 hover:text-zinc-300"
              onClick={() => {
                void navigator.clipboard?.writeText(fullText).then(
                  () => showToast("已复制全文"),
                  () => showToast("复制失败"),
                );
              }}
            >
              复制全文
            </button>
          </footer>
        ) : null}
      </div>
    );
  }


  if (isTextAssetCardData(node.data)) {
    const roleRaw = node.data.assetRole;
    const role: TextAssetRole =
      roleRaw === "character" || roleRaw === "scene" || roleRaw === "prop"
        ? roleRaw
        : node.data.kind === "character"
          ? "character"
          : node.data.kind === "scene"
            ? "scene"
            : "prop";
    const title =
      (node.data.label || "").trim() || textAssetRoleLabel(role);
    const body = (node.data.text || node.data.prompt || "").trim();
    const imageRunning = node.data.imageStatus === "running";
    const imageError = node.data.imageStatus === "error";
    const mediaSrc = !broken ? resolveMediaSrc(node.data.assetUrl) : undefined;

    return (
      <div
        data-testid="node-detail"
        className="absolute inset-0 z-[60] flex flex-col bg-[#14161c]"
      >
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/6 px-4">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-[14px] font-medium">{title}</p>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-zinc-400">
              {textAssetRoleLabel(role)}
            </span>
            {imageRunning ? (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300">
                出图中
              </span>
            ) : imageError ? (
              <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-300">
                出图失败
              </span>
            ) : mediaSrc ? (
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
                已出图
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-1">
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

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <div className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center bg-black/30 p-4 md:p-6">
            {imageRunning ? (
              <div
                className="flex aspect-video w-full max-w-3xl flex-col justify-end gap-3 rounded-xl border border-amber-400/20 bg-zinc-900/80 p-6"
                aria-busy
              >
                <div className="h-3 w-1/3 animate-pulse rounded bg-white/10" />
                <div className="h-3 w-full animate-pulse rounded bg-white/[0.07]" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-white/[0.05]" />
                <p className="flex items-center gap-2 pt-2 text-[13px] text-amber-200/90">
                  <Loader2 className="size-3.5 animate-spin" />
                  出图中…
                </p>
              </div>
            ) : mediaSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mediaSrc}
                alt={title}
                onError={() => {
                  void retryNodeAssetUrlOnError(node.id).then((ok) => {
                    if (ok === false) setBroken(true);
                  });
                }}
                className="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
              />
            ) : imageError || broken ? (
              <div className="flex aspect-video w-full max-w-2xl flex-col items-center justify-center gap-3 rounded-xl border border-rose-400/25 bg-rose-500/10 px-6 text-center">
                <p className="max-w-md text-[13px] text-rose-100">
                  {node.data.imageError?.trim() ||
                    (broken ? "预览失效，可重试出图" : "出图失败")}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void generateStickyImage(node.id)}
                >
                  <RefreshCw className="size-3.5" />
                  重试出图
                </Button>
              </div>
            ) : (
              <div className="flex aspect-video w-full max-w-2xl flex-col items-center justify-center gap-3 rounded-xl bg-zinc-900 text-zinc-500 ring-1 ring-white/8">
                <ImageIcon className="size-8 opacity-50" />
                <p className="text-[13px]">还没有出图</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void generateStickyImage(node.id)}
                >
                  <Sparkles className="size-3.5" />
                  出图
                </Button>
              </div>
            )}

            {mediaSrc && !imageRunning ? (
              <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void generateStickyImage(node.id)}
                >
                  <RefreshCw className="size-3.5" />
                  重出图
                </Button>
              </div>
            ) : null}
          </div>

          <aside className="flex w-full shrink-0 flex-col border-t border-white/6 md:w-80 md:border-t-0 md:border-l">
            <div className="border-b border-white/6 px-4 py-3">
              <p className="text-[11px] text-zinc-500">描述</p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <Textarea
                value={node.data.text || node.data.prompt}
                onChange={(e) =>
                  updateNodeData(node.id, {
                    text: e.target.value,
                    prompt: node.data.prompt || e.target.value,
                  })
                }
                placeholder="标题+描述会拼成出图提示词"
                className="min-h-[40vh] resize-none border-0 bg-transparent text-[13px] leading-6 shadow-none focus-visible:ring-0"
              />
              {!body ? (
                <p className="mt-2 text-[11px] text-zinc-600">暂无描述</p>
              ) : null}
            </div>
          </aside>
        </div>
      </div>
    );
  }

  const kind = node.data.kind;
  const isMedia =
    kind === "image" ||
    kind === "video" ||
    kind === "audio";
  const mediaSrc = !broken ? resolveMediaSrc(node.data.assetUrl) : undefined;
  const preview =
    mediaSrc ??
    (kind !== "video" && kind !== "audio" && node.data.status === "success"
      ? fallbackPoster(kind, node.data.prompt || node.data.label)
      : undefined);
  const title =
    kind === "text" || kind === "script" || kind === "scene" || kind === "character" || kind === "storyboard"
      ? node.data.label || "文本"
      : node.data.label || KIND_LABEL[kind];

  return (
    <div
      data-testid="node-detail"
      className="absolute inset-0 z-[60] flex bg-[#14161c]"
    >
      {isMedia ? (
        <div className="flex min-h-0 flex-1">
          <aside className="hidden w-56 shrink-0 flex-col border-r border-white/6 p-3 md:flex">
            <p className="mb-2 text-[11px] text-zinc-500">关键元素 · 全部</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="aspect-square rounded-lg bg-zinc-900 ring-1 ring-white/8" />
              <div className="aspect-square rounded-lg bg-zinc-900 ring-1 ring-white/8" />
            </div>
            <p className="mb-2 mt-4 text-[11px] text-zinc-500">图片</p>
            <div className="overflow-hidden rounded-lg ring-1 ring-white/8">
              {preview && kind === "video" ? (
                <video
                  src={preview}
                  muted
                  playsInline
                  preload="metadata"
                  onError={() => {
                    void retryNodeAssetUrlOnError(node.id).then((ok) => {
                      if (ok === false) setBroken(true);
                    });
                  }}
                  className="aspect-square w-full object-cover"
                />
              ) : preview && kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview}
                  alt=""
                  onError={() => {
                    void retryNodeAssetUrlOnError(node.id).then((ok) => {
                      if (ok === false) setBroken(true);
                    });
                  }}
                  className="aspect-square w-full object-cover"
                />
              ) : (
                <div className="flex aspect-square items-center justify-center text-[11px] text-zinc-600">
                  {kind === "audio" ? "音频" : "未生成"}
                </div>
              )}
            </div>
          </aside>
          <div className="relative flex min-w-0 flex-1 items-center justify-center p-6">
            {node.data.status === "uploading" ? (
              <div className="absolute top-3 left-3 z-10 inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-500/15 px-3 py-1 text-[12px] text-sky-100">
                <Loader2 className="size-3.5 animate-spin" />
                {node.data.progress || "上传中…"}
              </div>
            ) : null}
            {node.data.status === "error" && node.data.errorMessage ? (
              <div className="absolute top-3 left-3 z-10 flex max-w-[70%] flex-wrap items-center gap-2 rounded-full border border-rose-400/30 bg-rose-500/15 px-3 py-1 text-[12px] text-rose-100">
                <span className="line-clamp-2">{node.data.errorMessage}</span>
                {kind === "video" ? (
                  <button
                    type="button"
                    className="shrink-0 underline"
                    onClick={() =>
                      void pickAndAttachAsset(node.id, kind, updateNodeData)
                    }
                  >
                    重试
                  </button>
                ) : null}
              </div>
            ) : null}
            <div className="absolute top-3 right-3 flex items-center gap-1">
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="分享"
                onClick={() => showToast("分享为演示占位")}
              >
                <Share2 className="size-4" />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="关闭详情"
                onClick={() => closeNodeDetail()}
              >
                <X className="size-4" />
              </Button>
            </div>
            {preview && kind === "video" ? (
              <video
                src={preview}
                controls
                playsInline
                preload="metadata"
                onError={() => {
                    void retryNodeAssetUrlOnError(node.id).then((ok) => {
                      if (ok === false) setBroken(true);
                    });
                  }}
                className="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
              />
            ) : preview && kind === "audio" ? (
              <audio
                src={preview}
                controls
                preload="metadata"
                onError={() => {
                    void retryNodeAssetUrlOnError(node.id).then((ok) => {
                      if (ok === false) setBroken(true);
                    });
                  }}
                className="w-full max-w-md"
              />
            ) : preview && kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt={title}
                onError={() => {
                    void retryNodeAssetUrlOnError(node.id).then((ok) => {
                      if (ok === false) setBroken(true);
                    });
                  }}
                className="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
              />
            ) : (
              <div className="flex aspect-video w-full max-w-2xl flex-col items-center justify-center rounded-xl bg-zinc-900 text-zinc-500 ring-1 ring-white/8">
                <p className="text-[13px]">{title}</p>
                <p className="mt-1 text-[12px]">
                  {kind === "video"
                    ? broken
                      ? "视频无法播放，请重试上传或换源"
                      : "还没有可播放的视频，请先上传或生成"
                    : kind === "audio"
                      ? broken
                        ? "音频无法播放"
                        : "还没有可播放的音频"
                      : "还没有占位图，可在底部生成器填写提示词"}
                </p>
              </div>
            )}
            <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => showToast("预设为演示占位")}
              >
                <Sparkles className="size-3.5" />
                预设
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <aside className="hidden w-52 shrink-0 flex-col border-r border-white/6 p-3 md:flex">
            <p className="mb-2 text-[11px] text-zinc-500">文本</p>
            <button
              type="button"
              className="rounded-lg bg-white/6 px-3 py-2 text-left text-[13px] text-zinc-100"
            >
              {title}
            </button>
          </aside>
          <div className="relative flex min-w-0 flex-1 flex-col">
            <header className="flex h-12 items-center justify-between border-b border-white/6 px-4">
              <p className="text-[14px] font-medium">{title}</p>
              <div className="flex items-center gap-1">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="分享"
                  onClick={() => showToast("分享为演示占位")}
                >
                  <Share2 className="size-4" />
                </Button>
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
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <Textarea
                value={node.data.text || node.data.prompt}
                onChange={(e) =>
                  updateNodeData(node.id, {
                    text: e.target.value,
                    prompt: node.data.prompt || e.target.value,
                  })
                }
                className="min-h-[60vh] resize-none border-0 bg-transparent text-[14px] leading-7 shadow-none focus-visible:ring-0"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SkillDetailBody({
  node,
  onClose,
  showToast,
}: {
  node: NonNullable<ReturnType<typeof useProjectStore.getState>["nodes"][number]>;
  onClose: () => void;
  showToast: (msg: string, options?: { durationMs?: number }) => void;
}) {
  const skillId = node.data.skillId?.trim() || "";
  const title =
    (node.data.skillTitle || node.data.label || node.data.skillName || "Skill").trim();
  const version = node.data.skillVersion?.trim() || "";
  const name = node.data.skillName?.trim() || "";
  const agent = node.data.skillAgent?.trim() || "";
  const agentLabel = agent ? SKILL_AGENT_LABEL[agent] ?? agent : "";
  const [body, setBody] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(skillId));
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!skillId) {
      setBody(null);
      setLoading(false);
      setError(null);
      return;
    }
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    setBody(null);
    void getAgentSkill(skillId, { signal: ac.signal })
      .then((row) => {
        if (ac.signal.aborted) return;
        setBody(row.body ?? "");
        setError(null);
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
          err instanceof Error ? err.message : "加载 Skill 正文失败";
        setError(message);
        setBody(null);
        showToast(message);
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [skillId, retryKey, showToast]);

  return (
    <>
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-white/6 px-4 py-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] tracking-wider text-zinc-500">
            Skill · 只读
          </p>
          <p className="truncate text-[14px] font-medium text-zinc-100">{title}</p>
          <p className="truncate font-mono text-[11px] text-zinc-500">
            {name || "—"}
            {version ? ` @ v${version}` : ""}
            {agentLabel ? ` · ${agentLabel}` : ""}
          </p>
        </div>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="关闭详情"
          onClick={onClose}
        >
          <X className="size-4" />
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3" data-testid="skill-detail-body">
        {!skillId ? (
          <p className="py-10 text-center text-[13px] text-zinc-500">
            缺少 skillId，无法拉取正文
          </p>
        ) : loading ? (
          <div className="flex items-center gap-2 py-8 text-[12px] text-zinc-500">
            <Loader2 className="size-3.5 animate-spin" />
            加载正文…
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-[12px] text-red-300/90">{error}</p>
            <button
              type="button"
              data-testid="skill-detail-retry"
              onClick={() => setRetryKey((k) => k + 1)}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[12px] text-zinc-300 hover:bg-white/10"
            >
              重试
            </button>
          </div>
        ) : body?.trim() ? (
          <pre className="whitespace-pre-wrap break-words font-sans text-[13px] leading-relaxed text-zinc-300">
            {body}
          </pre>
        ) : (
          <p className="py-10 text-center text-[13px] text-zinc-500">正文为空</p>
        )}
      </div>
    </>
  );
}

