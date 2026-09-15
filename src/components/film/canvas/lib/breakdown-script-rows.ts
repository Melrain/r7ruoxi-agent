/**
 * Parse agent product → scriptRows (same shape as storyboard ScriptRow).
 * Card / detail list off these rows; text is full-text fallback only.
 */
import { resolveBreakdownShotDisplay } from "@/components/film/film-breakdown-shot";
import type { FilmBreakdownCard } from "@/lib/api/film";
import type { CanvasNodeData, ScriptRow } from "@/components/film/canvas/types/project";

const PREVIEW_ROW_MAX = 5;

export function isBreakdownAssetData(data: CanvasNodeData): boolean {
  if (data.kind !== "text") return false;
  // 文字资产便签（角色/场景/道具）不是拆解镜号卡
  if (data.assetRole || data.textAssetCard) return false;
  if (data.label.trim() === "拆解") return true;
  if (data.scriptRows != null) return true;
  return false;
}

export function breakdownPreviewRowCount(): number {
  return PREVIEW_ROW_MAX;
}

/** One-line card summary when structured rows are missing (no fake shots). */
export function breakdownTextSummaryLine(text: string): string {
  const cleaned = text
    .replace(/^【\s*(?:视频)?解析\s*[·.•]?\s*拆解\s*】\s*/u, "")
    .replace(/^【\s*(?:视频)?解析\s*[·.•]?\s*剧本\s*】\s*/u, "")
    .trim();
  const line =
    cleaned
      .split(/\n/)
      .map((part) => part.trim())
      .find((part) => part.length > 0) ?? "";
  if (!line) return "";
  return line.length > 72 ? `${line.slice(0, 72)}…` : line;
}

function padShotId(index: number): string {
  return `S${String(index + 1).padStart(2, "0")}`;
}

function resolveShotId(
  card: FilmBreakdownCard,
  displayTitle: string,
  index: number,
): string {
  const row = card as FilmBreakdownCard & {
    index?: number | string;
    shotId?: string;
  };
  const fromShotNo =
    (typeof card.shotNo === "string" && card.shotNo.trim()) ||
    (typeof row.shotId === "string" && row.shotId.trim()) ||
    "";
  if (fromShotNo) return fromShotNo;
  if (row.index != null && String(row.index).trim()) {
    const raw = String(row.index).trim();
    if (/^s?\d+$/i.test(raw)) {
      const n = Number(raw.replace(/^s/i, ""));
      if (Number.isFinite(n)) return padShotId(Math.max(0, n - 1));
    }
    return raw;
  }
  const title = displayTitle.trim();
  if (title && title !== "镜头") {
    const m = title.match(/(?:镜号\s*)?(S?\d+)/i) || title.match(/(\d+)/);
    if (m?.[1]) {
      const raw = m[1];
      if (/^\d+$/.test(raw)) return padShotId(Math.max(0, Number(raw) - 1));
      return raw.toUpperCase().startsWith("S") ? raw.toUpperCase() : raw;
    }
    return title;
  }
  return padShotId(index);
}

/** Nest breakdown cards → canvas scriptRows (isomorphic with storyboard rows). */
export function breakdownCardsToScriptRows(
  cards: FilmBreakdownCard[],
): ScriptRow[] {
  return cards.map((card, index) => {
    const display = resolveBreakdownShotDisplay(card);
    const row = card as FilmBreakdownCard & { visualDesc?: string };
    const visualDesc =
      (typeof row.visualDesc === "string" && row.visualDesc.trim()) ||
      display.visual ||
      "";
    const dialogue = display.dialogue || "";
    return {
      id: card.id?.trim() || `bd_${index + 1}`,
      shotId: resolveShotId(card, display.shotTitle, index),
      duration: "",
      visualDesc,
      dialogue,
      selected: true,
      rowStatus: "success" as const,
    };
  });
}
