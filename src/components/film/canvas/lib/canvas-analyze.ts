/**
 * Canvas parse agent → Nest film.reference analyze (server default breakdownPrompt).
 * Reuses the dedicated 「画布」 film project from upload-film-asset (第1刀),
 * or the filmProjectId stored on the video node (library / upload).
 */
import {
  analyzeFilmReference,
  filmGrokAllowsAnalyze,
  filmGrokAuthIssue,
  getFilmGrokPreflight,
  type FilmBreakdownCard,
  type FilmGrokPreflight,
  type FilmProjectThread,
} from "@/lib/api/film";
import { breakdownCardsToScriptRows } from "@/components/film/canvas/lib/breakdown-script-rows";
import type { ScriptRow } from "@/components/film/canvas/types/project";
import {
  isTimeoutError,
  StudioApiError,
  studioErrorMessage,
} from "@/lib/api/client";
import { requestGrokUsageRefresh } from "@/lib/api/grok-usage";
import { resolvePreferredExecutorSource } from "@/lib/executor-source";
import {
  resolveFilmProjectForReference,
  restoreClassicCurrent,
} from "@/components/film/canvas/lib/upload-film-asset";

export type CanvasAnalyzeScript = {
  title: string;
  body: string;
};

export type CanvasAnalyzeResult = {
  text: string;
  /** Structured shots for card/detail (scriptRows isomorphic). */
  scriptRows: ScriptRow[];
  /** Nest package.script when present; null if empty — caller may mock-fallback. */
  script: CanvasAnalyzeScript | null;
  /** Raw Nest breakdown cards (optional persist / debug). */
  breakdown: FilmBreakdownCard[];
  thread: FilmProjectThread;
  projectId: string;
  refId: string;
};

function cardBody(item: FilmBreakdownCard): string {
  const title = item.title?.trim() || "";
  const body = item.body?.trim() || "";
  const visual =
    (typeof item.visual === "string" && item.visual.trim()) ||
    (typeof item["画面"] === "string" && item["画面"].trim()) ||
    "";
  const dialogue =
    (typeof item.dialogue === "string" && item.dialogue.trim()) ||
    (typeof item["对白"] === "string" && item["对白"].trim()) ||
    "";

  const parts: string[] = [];
  if (title) parts.push(`【${title}】`);
  if (body) {
    parts.push(body);
  } else {
    if (visual) parts.push(`画面：${visual}`);
    if (dialogue) parts.push(`对白：${dialogue}`);
  }
  return parts.join("\n").trim();
}

/** Flatten Nest breakdown cards into canvas text-node content. */
export function formatBreakdownText(cards: FilmBreakdownCard[]): string {
  const blocks = cards
    .map((card) => cardBody(card))
    .filter((block) => block.length > 0);
  if (blocks.length === 0) return "";
  return `【视频解析 · 拆解】\n\n${blocks.join("\n\n")}`;
}

export function mapCanvasAnalyzeError(caught: unknown): string {
  if (isTimeoutError(caught)) {
    return "视频解析超时，请重试（长视频可能需要几分钟）。";
  }
  if (caught instanceof StudioApiError) {
    const msg = caught.message.trim();
    if (caught.status === 404 || /参考片不存在/.test(msg)) {
      return "参考片不存在或项目对不上。请在画布重新上传视频后再跑视频解析。";
    }
    if (/本机拆解请用桌面端/.test(msg)) {
      return msg;
    }
    if (msg) return msg;
  }
  if (caught instanceof Error && caught.message.trim()) {
    return caught.message.trim();
  }
  const fallback = studioErrorMessage(caught);
  return fallback?.trim() || "视频解析失败，请重试";
}

async function requireAnalyzeReady(signal?: AbortSignal) {
  const preferredSource = resolvePreferredExecutorSource();
  let preflight: FilmGrokPreflight;
  try {
    preflight = await getFilmGrokPreflight({
      preferredSource,
      signal,
    });
  } catch (caught) {
    throw new Error(
      studioErrorMessage(caught) || "查不到本机 grok 状态。拆解先等一等。",
    );
  }
  if (!filmGrokAllowsAnalyze(preflight)) {
    throw new Error(filmGrokAuthIssue(preflight) ?? "本机 grok 还没就绪。");
  }
  return preferredSource;
}

/**
 * True Nest analyze for a canvas video node whose assetId is the film.reference id.
 * Does NOT send canvas promptOverride / breakdownPrompt — Nest uses server default.
 */
export async function analyzeCanvasVideoReference(
  assetId: string,
  options?: { signal?: AbortSignal; filmProjectId?: string },
): Promise<CanvasAnalyzeResult> {
  const refId = assetId.trim();
  if (!refId) {
    throw new Error("输入资产未入库（缺 assetId），请重新上传视频");
  }

  const preferredSource = await requireAnalyzeReady(options?.signal);
  const { projectId, previousCurrentId } = await resolveFilmProjectForReference(
    refId,
    {
      signal: options?.signal,
      preferredProjectId: options?.filmProjectId,
    },
  );

  try {
    let thread: FilmProjectThread;
    try {
      thread = await analyzeFilmReference(projectId, refId, {
        preferredSource,
        signal: options?.signal,
      });
    } catch (caught) {
      throw new Error(mapCanvasAnalyzeError(caught));
    }

    const meta = thread.package?.meta?.analyze;
    if (meta?.blocked && meta.error?.trim()) {
      throw new Error(meta.error.trim());
    }

    const breakdown = thread.package?.breakdown ?? [];
    const scriptRows = breakdownCardsToScriptRows(breakdown);
    const fromCards = formatBreakdownText(breakdown);
    const fromScript = thread.package?.script?.body?.trim() || "";
    const text =
      fromCards || (fromScript ? `【视频解析 · 剧本】\n\n${fromScript}` : "");
    // Allow structured-only success (rows present) even if flatten text empty.
    if (!text.trim() && scriptRows.length === 0) {
      throw new Error(
        meta?.error?.trim() || "拆解完成但没有内容，请重试或换一段视频。",
      );
    }
    const nestScriptTitle = thread.package?.script?.title?.trim() || "";
    const nestScriptBody = thread.package?.script?.body?.trim() || "";
    const script =
      nestScriptBody || nestScriptTitle
        ? {
            title: nestScriptTitle || "剧本",
            body: nestScriptBody || nestScriptTitle,
          }
        : null;

    requestGrokUsageRefresh();
    return {
      text: text || formatBreakdownText(breakdown),
      scriptRows,
      script,
      breakdown,
      thread,
      projectId,
      refId,
    };
  } finally {
    await restoreClassicCurrent(
      previousCurrentId,
      projectId,
      options?.signal,
    );
  }
}
