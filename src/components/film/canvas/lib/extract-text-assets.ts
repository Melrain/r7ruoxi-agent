/**
 * 从剧本文案抽出角色 / 场景 / 道具文字资产。
 * 只认文中明确结构，绝不编造假名或假设定。
 */
export type TextAssetRole = "character" | "scene" | "prop";

export type ExtractedTextAsset = {
  role: TextAssetRole;
  title: string;
  description: string;
};

const ROLE_LABEL: Record<TextAssetRole, string> = {
  character: "角色",
  scene: "场景",
  prop: "道具",
};

export function textAssetRoleLabel(role: TextAssetRole): string {
  return ROLE_LABEL[role];
}

function clampDesc(raw: string, maxLines = 3): string {
  const lines = raw
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return "";
  return lines.slice(0, maxLines).join("\n");
}

function splitItems(raw: string): string[] {
  return raw
    .split(/[、，,;/；|]/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 1 && part.length <= 40);
}

function pushUnique(
  out: ExtractedTextAsset[],
  seen: Set<string>,
  role: TextAssetRole,
  title: string,
  description: string,
) {
  const t = title.trim();
  if (!t) return;
  const key = `${role}:${t}`;
  if (seen.has(key)) return;
  seen.add(key);
  const desc = clampDesc(description) || t;
  out.push({ role, title: t.slice(0, 32), description: desc });
}

/** Explicit 「角色：… / 人物：… / 场景：… / 道具：…」 lines. */
function extractLabeledLists(text: string, out: ExtractedTextAsset[], seen: Set<string>) {
  const patterns: { role: TextAssetRole; re: RegExp }[] = [
    { role: "character", re: /^(?:角色|人物)\s*[：:]\s*(.+)$/gm },
    { role: "scene", re: /^(?:场景|地点|空间)\s*[：:]\s*(.+)$/gm },
    { role: "prop", re: /^(?:道具|物件|物品)\s*[：:]\s*(.+)$/gm },
  ];
  for (const { role, re } of patterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const items = splitItems(m[1] ?? "");
      for (const item of items) {
        // Skip pure counts like 「主角 1」 without a real name? Keep 「主角」 as title if present.
        const cleaned = item.replace(/\s*\d+\s*$/, "").trim() || item;
        pushUnique(out, seen, role, cleaned, cleaned);
      }
    }
  }
}

/** 【场次】段落 → 场景卡（标题=括号内，描述=随后文案）。 */
function extractSceneBlocks(text: string, out: ExtractedTextAsset[], seen: Set<string>) {
  const re = /【\s*([^】]+?)\s*】\s*([\s\S]*?)(?=【|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const title = (m[1] ?? "").trim();
    if (!title) continue;
    // Skip meta-ish headers that are not scenes
    if (/^(类型|时长|基调|人物|角色|道具|视频解析)/.test(title)) continue;
    const body = (m[2] ?? "")
      .split(/\n/)
      .map((line) => line.trim())
      .filter((line) => line && !/^(类型|时长建议|基调)\s*[：:]/.test(line))
      .join("\n");
    const desc = clampDesc(body);
    if (!desc) continue;
    pushUnique(out, seen, "scene", title, desc);
  }
}

/**
 * 从完整剧本文（title+body 或纯 body）抽出文字资产。
 * 抽不出返回空数组 — 调用方 toast 说明，勿补假数据。
 */
export function extractTextAssetsFromScript(scriptText: string): ExtractedTextAsset[] {
  const text = scriptText.replace(/\r\n/g, "\n").trim();
  if (!text) return [];
  const out: ExtractedTextAsset[] = [];
  const seen = new Set<string>();
  extractLabeledLists(text, out, seen);
  extractSceneBlocks(text, out, seen);
  return out;
}

/** Map role → canvas AssetKind (道具走 text + assetRole). */
export function kindForTextAssetRole(
  role: TextAssetRole,
): "character" | "scene" | "text" {
  if (role === "character") return "character";
  if (role === "scene") return "scene";
  return "text";
}
