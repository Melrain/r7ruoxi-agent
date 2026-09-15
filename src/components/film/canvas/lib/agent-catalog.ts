import { KIND_LABEL } from "@/components/film/canvas/lib/labels";
import type {
  AgentId,
  AgentPromptOverride,
  AgentPromptSlot,
  AgentPrompts,
  AppEdge,
  AppNode,
  AssetKind,
} from "@/components/film/canvas/types/project";

export type { AgentPromptSlot, AgentPrompts, AgentPromptOverride };

export interface AgentSpec {
  id: AgentId;
  label: string;
  hint: string;
  tagline: string;
  accepts: AssetKind[];
  emits: AssetKind;
  prompts?: AgentPrompts;
}

export type PromptPillState = "default" | "overridden" | "missing";

export const AGENT_CATALOG: AgentSpec[] = [
  {
    id: "parse",
    label: "视频解析",
    hint: "入视频，出拆解",
    tagline: "爆款主链",
    accepts: ["video"],
    emits: "text",
    prompts: {
      system:
        "你是短视频拆解导演。输出结构化拆解：钩子、节奏段落、人物关系、可复用桥段与可拍要点。语气简洁、可执行。",
      userTemplate:
        "请解析以下参考视频，提炼可复用的爆款结构。\n\n视频：{{ref}}",
      slots: [
        { key: "ref", from: "video" },
      ],
      preview: "视频 → 钩子、节奏与可复用桥段",
    },
  },
  {
    id: "script",
    label: "生成剧本",
    hint: "入备注、参考图音视频，出剧本",
    tagline: "叙事分镜引擎",
    accepts: ["text", "image", "video", "audio", "file"],
    emits: "script",
    prompts: {
      system: "你是短剧编剧。根据输入写可拍剧本，含序幕/转折/高潮，对白精炼。",
      userTemplate: "根据以下输入写剧本。\n备注：{{brief}}\n参考视频：{{video}}\n参考图：{{image}}",
      slots: [{ key: "brief", from: "text" }, { key: "video", from: "video" }, { key: "image", from: "image" }],
      preview: "备注+参考 → 可拍短剧剧本",
    },
  },
  {
    id: "storyboard",
    label: "拆分镜",
    hint: "只入剧本，出分镜表",
    tagline: "分镜拆解",
    accepts: ["script"],
    emits: "storyboard",
    prompts: {
      system: "你是分镜师。只依据剧本拆镜号、时长、画面、对白。",
      userTemplate: "请把下列剧本拆成分镜表：\n{{script}}",
      slots: [{ key: "script", from: "script", required: true }],
      preview: "剧本 → 镜号/时长/画面/对白",
    },
  },
  {
    id: "scene",
    label: "场景",
    hint: "只入剧本，出场景设定",
    tagline: "场景设定",
    accepts: ["script"],
    emits: "scene",
    prompts: {
      system: "你是场景设计师。只依据剧本提炼空间、光线、时代感。",
      userTemplate: "根据剧本提炼场景设定：\n{{script}}",
      slots: [{ key: "script", from: "script", required: true }],
      preview: "剧本 → 空间/光线/时代感",
    },
  },
  {
    id: "character",
    label: "角色/资产",
    hint: "只入剧本，出角色或道具",
    tagline: "角色资产",
    accepts: ["script"],
    emits: "character",
    prompts: {
      system: "你是角色设计师。只依据剧本提炼外形、气质、辨识点。",
      userTemplate: "根据剧本提炼角色/道具：\n{{script}}",
      slots: [{ key: "script", from: "script", required: true }],
      preview: "剧本 → 外形/气质/辨识点",
    },
  },
  {
    id: "image",
    label: "出图",
    hint: "入分镜、场景、角色、参考图",
    tagline: "画面生成",
    accepts: ["storyboard", "scene", "character", "image"],
    emits: "image",
    prompts: {
      system: "你是电影感静帧画师。依据分镜/场景/角色与参考图出图。",
      userTemplate: "生成静帧。分镜：{{storyboard}}\n场景：{{scene}}\n角色：{{character}}\n参考：{{image}}",
      slots: [
        { key: "storyboard", from: "storyboard", required: true },
        { key: "scene", from: "scene" },
        { key: "character", from: "character" },
        { key: "image", from: "image" },
      ],
      preview: "分镜+设定 → 电影感静帧",
    },
  },
  {
    id: "video",
    label: "出视频",
    hint: "入分镜、图、场景、角色、音频",
    tagline: "镜头成片",
    accepts: ["storyboard", "image", "scene", "character", "audio"],
    emits: "video",
    prompts: {
      system: "你是镜头导演。依据分镜与关联资产生成成片，注意运动与节奏。",
      userTemplate: "生成镜头。分镜：{{storyboard}}\n图：{{image}}\n音频：{{audio}}",
      slots: [
        { key: "storyboard", from: "storyboard", required: true },
        { key: "image", from: "image" },
        { key: "audio", from: "audio" },
      ],
      preview: "分镜+资产 → 镜头成片",
    },
  },
];

export const IMPORT_ASSET_KINDS: { kind: AssetKind; label: string; hint: string }[] =
  [
    { kind: "text", label: KIND_LABEL.text, hint: "备注 / 大纲 / 对白" },
    { kind: "image", label: KIND_LABEL.image, hint: "参考图或静帧" },
    { kind: "video", label: KIND_LABEL.video, hint: "参考片或成片" },
    { kind: "audio", label: KIND_LABEL.audio, hint: "对白 / 配乐" },
    { kind: "file", label: KIND_LABEL.file, hint: "文档或其他附件" },
  ];

export function getAgentSpec(id: AgentId | undefined): AgentSpec | undefined {
  return AGENT_CATALOG.find((item) => item.id === id);
}

export const INPUT_ASSET_KINDS: AssetKind[] = [
  "text",
  "image",
  "video",
  "audio",
  "file",
];

export const PRODUCT_ASSET_KINDS: AssetKind[] = [
  "script",
  "storyboard",
  "scene",
  "character",
  "image",
  "video",
];

const ASSET_KIND_SET = new Set<string>([
  ...INPUT_ASSET_KINDS,
  "script",
  "storyboard",
  "scene",
  "character",
]);

export function isAssetKind(kind: string | undefined): kind is AssetKind {
  return Boolean(kind && ASSET_KIND_SET.has(kind));
}

export function isInputAssetKind(kind: string | undefined): kind is AssetKind {
  return Boolean(kind && INPUT_ASSET_KINDS.includes(kind as AssetKind));
}

export function isAgentNode(node: AppNode | undefined): boolean {
  return node?.data.role === "agent" || node?.data.kind === "agent";
}

export function isSkillNode(node: AppNode | undefined): boolean {
  return node?.data.role === "skill" || node?.data.kind === "skill";
}

export function isAssetNode(node: AppNode | undefined): boolean {
  return Boolean(node) && !isAgentNode(node) && !isSkillNode(node);
}

export function assetKindOf(node: AppNode | undefined): AssetKind | null {
  if (!node || isAgentNode(node) || isSkillNode(node)) return null;
  return isAssetKind(node.data.kind) ? node.data.kind : null;
}

/** 本刀可注入装配的智能体（analyze 走 Nest skillId）。 */
export const SKILL_ASSEMBLABLE_AGENTS = new Set<string>(["parse"]);

export const SKILL_AGENT_LABEL: Record<string, string> = {
  parse: "视频解析",
  script: "生成剧本",
  image: "出图",
};

export function shortSkillTitle(title?: string | null, fallback = "Skill"): string {
  const t = (title ?? "").trim() || fallback;
  return t.length > 10 ? `${t.slice(0, 10)}…` : t;
}

export interface EquippedSkill {
  skillNodeId: string;
  skillId: string;
  title: string;
  version?: string;
  name?: string;
  agent?: string;
  bodyPreview?: string;
}

/** 入边 Skill 卡 = 已装配；边为真相源。 */
export function resolveEquippedSkill(
  agentNodeId: string,
  nodes: AppNode[],
  edges: AppEdge[],
): EquippedSkill | null {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const edge of edges) {
    if (edge.target !== agentNodeId) continue;
    if (edge.data?.edgeKind === "out") continue;
    const src = byId.get(edge.source);
    if (!isSkillNode(src) || !src) continue;
    const skillId = src.data.skillId?.trim();
    if (!skillId) continue;
    return {
      skillNodeId: src.id,
      skillId,
      title: (src.data.skillTitle || src.data.label || src.data.skillName || "Skill").trim(),
      version: src.data.skillVersion,
      name: src.data.skillName,
      agent: src.data.skillAgent,
      bodyPreview: src.data.skillBodyPreview,
    };
  }
  return null;
}

export interface HandoffOption {
  spec: AgentSpec;
  enabled: boolean;
  reason?: string;
}

/** Skill 右出点「交给」菜单：可装配优先；否则灰显 + 原因。 */
export function skillHandoffOptions(skillAgent?: string | null): HandoffOption[] {
  const face = (skillAgent ?? "").trim();
  return AGENT_CATALOG.map((spec) => {
    if (face && spec.id !== face) {
      const faceLabel = SKILL_AGENT_LABEL[face] ?? face;
      return {
        spec,
        enabled: false,
        reason: `此 Skill 面向${faceLabel}，不能装到${spec.label}`,
      };
    }
    if (!SKILL_ASSEMBLABLE_AGENTS.has(spec.id)) {
      return {
        spec,
        enabled: false,
        reason: `${spec.label}暂不支持 Skill 装配`,
      };
    }
    return { spec, enabled: true };
  });
}

export function skillAssembleRejectReason(
  skill: AppNode | undefined,
  agent: AppNode | undefined,
): string | null {
  if (!skill || !isSkillNode(skill)) return "找不到 Skill";
  if (!agent || !isAgentNode(agent)) return "只能连到智能体";
  const spec = specOf(agent);
  if (!spec) return "找不到智能体合同";
  const face = skill.data.skillAgent?.trim();
  if (face && spec.id !== face) {
    const faceLabel = SKILL_AGENT_LABEL[face] ?? face;
    return `此 Skill 面向${faceLabel}，不能装到${spec.label}`;
  }
  if (!SKILL_ASSEMBLABLE_AGENTS.has(spec.id)) {
    return `${spec.label}暂不支持 Skill 装配`;
  }
  if (!skill.data.skillId?.trim()) {
    return "Skill 卡缺少 skillId";
  }
  return null;
}

export function agentsAccepting(kind: AssetKind): AgentSpec[] {
  return AGENT_CATALOG.filter((spec) => spec.accepts.includes(kind));
}

/** 交给菜单统一源：兼容可点；不兼容灰显 + 原因 */


export function handoffOptions(kind: AssetKind): HandoffOption[] {
  return AGENT_CATALOG.map((spec) => {
    const enabled = spec.accepts.includes(kind);
    return {
      spec,
      enabled,
      reason: enabled
        ? undefined
        : `${spec.label}只入${spec.accepts.map(assetLabel).join("、")}`,
    };
  });
}

export function agentRejectReason(kind: AssetKind, spec: AgentSpec): string | null {
  if (spec.accepts.includes(kind)) return null;
  return `${spec.label}只入${spec.accepts.map(assetLabel).join("、")}`;
}

export function missingInputs(
  spec: AgentSpec,
  inbound: AssetKind[]
): AssetKind[] {
  if (inbound.some((kind) => spec.accepts.includes(kind))) return [];
  return spec.accepts;
}

export type ConnectHandles = {
  sourceHandle?: string | null;
  targetHandle?: string | null;
};

/** Agent Skill 入点：`skill` 或 `skill-*`. */
export function isSkillInHandle(th: string | null | undefined): boolean {
  return typeof th === "string" && (th === "skill" || th.startsWith("skill-"));
}

/** Agent 资产入点：`in` / `in-*` / `in_*`. */
export function isAssetInHandle(th: string | null | undefined): boolean {
  return (
    typeof th === "string" &&
    (th === "in" || th.startsWith("in-") || th.startsWith("in_"))
  );
}

export function connectRejectReason(
  source: AppNode | undefined,
  target: AppNode | undefined,
  handles?: ConnectHandles
): string | null {
  if (!source || !target) return "找不到节点";
  if (source.id === target.id) return "不能连到自己";
  if (isAgentNode(source) && isAgentNode(target)) return "智能体不能互连";

  const th = handles?.targetHandle ?? null;

  // Typed ports on agent: skill vs in (incl. compass aliases in-t / in-r / …)
  if (isAgentNode(target) && isSkillInHandle(th)) {
    if (!isSkillNode(source)) return "此入点只接 Skill";
    return skillAssembleRejectReason(source, target);
  }
  if (isAgentNode(target) && isAssetInHandle(th) && isSkillNode(source)) {
    return "Skill 请连到 Skill 入点";
  }

  // Skill → Agent = 装配；其它 Skill 连线一律拒绝
  if (isSkillNode(source) || isSkillNode(target)) {
    if (isSkillNode(source) && isAgentNode(target)) {
      return skillAssembleRejectReason(source, target);
    }
    if (isSkillNode(target)) return "Skill 卡只出不入";
    if (isSkillNode(source) && isAssetNode(target)) {
      return "Skill 请连到智能体以装配";
    }
    return "不能这样连 Skill";
  }
  if (isAssetNode(source) && isAssetNode(target)) return "资产之间不能连，请交给智能体";
  if (isAgentNode(source) && isAssetNode(target)) {
    return "产出由智能体跑出来，不能手连";
  }
  if (isAgentNode(target) && isSkillInHandle(th)) {
    return "此入点只接 Skill";
  }
  const kind = assetKindOf(source);
  const spec = specOf(target);
  if (!kind || !spec) return "只能把资产连到智能体";
  if (!spec.accepts.includes(kind)) {
    return `${spec.label}只入${spec.accepts.map(assetLabel).join("、")}`;
  }
  return null;
}

export function canConnect(
  source: AppNode | undefined,
  target: AppNode | undefined,
  handles?: ConnectHandles
): boolean {
  return connectRejectReason(source, target, handles) === null;
}

export function assetLabel(kind: AssetKind): string {
  return KIND_LABEL[kind];
}

export interface HungAsset {
  id: string;
  label: string;
  kind: AssetKind;
}

export interface AgentInspect {
  spec: AgentSpec;
  hung: HungAsset[];
  empty: AssetKind[];
  emit: AssetKind;
  products: HungAsset[];
  canRun: boolean;
}

function hungFrom(node: AppNode | undefined): HungAsset | null {
  if (!node) return null;
  const kind = assetKindOf(node);
  if (!kind) return null;
  const label = (node.data.label || node.data.prompt || KIND_LABEL[kind]).trim();
  return { id: node.id, label, kind };
}

export function inspectAgent(
  agent: AppNode | undefined,
  nodes: AppNode[],
  edges: AppEdge[]
): AgentInspect | null {
  if (!agent || !isAgentNode(agent)) return null;
  const spec = specOf(agent);
  if (!spec) return null;
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const hung: HungAsset[] = [];
  const products: HungAsset[] = [];
  for (const edge of edges) {
    if (edge.target === agent.id && edge.data?.edgeKind !== "out") {
      const item = hungFrom(byId.get(edge.source));
      if (item) hung.push(item);
    }
    if (edge.source === agent.id && edge.data?.edgeKind === "out") {
      const item = hungFrom(byId.get(edge.target));
      if (item) products.push(item);
    }
  }
  const hungKinds = new Set(hung.map((item) => item.kind));
  const empty = spec.accepts.filter((kind) => !hungKinds.has(kind));
  const canRun = hung.some((item) => spec.accepts.includes(item.kind));
  return { spec, hung, empty, emit: spec.emits, products, canRun };
}

export const CONTRACT_KINDS: AssetKind[] = [
  "text",
  "image",
  "video",
  "audio",
  "file",
  "script",
  "storyboard",
  "scene",
  "character",
];

export function specOf(
  node: { id: string; data: AppNode["data"] } | undefined
): AgentSpec | undefined {
  if (!node) return undefined;
  if (node.data.role !== "agent" && node.data.kind !== "agent") return undefined;
  const catalog = getAgentSpec(node.data.agentId);
  if (catalog) return catalog;
  const accepts = (node.data.accepts ?? []).filter(isAssetKind);
  const emits = isAssetKind(node.data.emits) ? node.data.emits : null;
  if (!accepts.length || !emits) return undefined;
  return {
    id: node.data.agentId || node.id,
    label: node.data.label || "智能体",
    hint: `入${accepts.map(assetLabel).join("、")}，出${assetLabel(emits)}`,
    tagline: "自定义合同",
    accepts,
    emits,
  };
}

const EMPTY_PROMPTS: AgentPrompts = {
  system: "",
  userTemplate: "",
  slots: [],
};

export function catalogPromptsOf(spec: AgentSpec | undefined): AgentPrompts {
  if (!spec?.prompts) {
    return {
      ...EMPTY_PROMPTS,
      system: spec?.hint ?? "",
      userTemplate: "",
      preview: spec?.hint,
    };
  }
  return {
    system: spec.prompts.system,
    userTemplate: spec.prompts.userTemplate,
    slots: spec.prompts.slots ?? [],
    preview: spec.prompts.preview,
  };
}

export function effectivePrompts(
  spec: AgentSpec | undefined,
  override: AgentPromptOverride | undefined
): AgentPrompts {
  const base = catalogPromptsOf(spec);
  if (!override) return base;
  return {
    system: override.system ?? base.system,
    userTemplate: override.userTemplate ?? base.userTemplate,
    slots: override.slots ?? base.slots,
    preview: override.preview ?? base.preview,
  };
}

export function effectiveSystem(
  spec: AgentSpec | undefined,
  override: AgentPromptOverride | undefined
): string {
  return effectivePrompts(spec, override).system;
}

export function effectiveUserTemplate(
  spec: AgentSpec | undefined,
  override: AgentPromptOverride | undefined
): string {
  return effectivePrompts(spec, override).userTemplate;
}

export function effectiveSlots(
  spec: AgentSpec | undefined,
  override: AgentPromptOverride | undefined
): AgentPromptSlot[] {
  return effectivePrompts(spec, override).slots;
}

export function hasCustomPrompt(
  override: AgentPromptOverride | undefined | null
): boolean {
  if (!override) return false;
  return (
    override.system !== undefined ||
    override.userTemplate !== undefined ||
    override.slots !== undefined ||
    override.preview !== undefined
  );
}

/** Required slots whose AssetKind is not among inbound connections. meta never missing. */
export function missingSlots(
  spec: AgentSpec | undefined,
  override: AgentPromptOverride | undefined,
  inboundKinds: AssetKind[]
): AgentPromptSlot[] {
  const hung = new Set(inboundKinds);
  return effectiveSlots(spec, override).filter((slot) => {
    if (!slot.required) return false;
    if (slot.from === "meta") return false;
    return !hung.has(slot.from);
  });
}

/** 缺槽优先，然后已覆盖，否则目录默认。 */
export function promptPillState(
  spec: AgentSpec | undefined,
  override: AgentPromptOverride | undefined,
  inboundKinds: AssetKind[]
): PromptPillState {
  if (missingSlots(spec, override, inboundKinds).length > 0) return "missing";
  if (hasCustomPrompt(override)) return "overridden";
  return "default";
}

export const PROMPT_PILL_LABEL: Record<PromptPillState, string> = {
  default: "目录默认",
  overridden: "已覆盖",
  missing: "缺槽",
};

/** Fill {{slotKey}} in userTemplate from inbound assets keyed by slot.from. */
export function fillUserTemplate(
  userTemplate: string,
  slots: AgentPromptSlot[],
  valuesByKind: Partial<Record<AssetKind, string>>,
  meta: Record<string, string> = {}
): string {
  const byKey = new Map<string, string>();
  for (const slot of slots) {
    if (slot.from === "meta") {
      byKey.set(slot.key, meta[slot.key] ?? "");
    } else {
      byKey.set(slot.key, valuesByKind[slot.from] ?? "");
    }
  }
  return userTemplate.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    return byKey.get(key) ?? "";
  });
}

/** Compose system + filled user template for mock / local run path. */
export function composeEffectiveRunPrompt(
  spec: AgentSpec | undefined,
  override: AgentPromptOverride | undefined,
  valuesByKind: Partial<Record<AssetKind, string>>,
  fallback = ""
): string {
  const prompts = effectivePrompts(spec, override);
  const filled = fillUserTemplate(prompts.userTemplate, prompts.slots, valuesByKind);
  const parts = [prompts.system.trim(), filled.trim()].filter(Boolean);
  if (parts.length) return parts.join("\n\n");
  return fallback;
}
