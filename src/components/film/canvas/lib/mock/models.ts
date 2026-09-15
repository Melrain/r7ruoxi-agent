import type { MockModel, NodeKind } from "@/components/film/canvas/types/project";

export const MOCK_MODELS: MockModel[] = [
  { id: "script-aide", label: "剧本助手 · 演示", kinds: ["text", "script", "agent"], hint: "结构化短剧脚本" },
  { id: "flux-pro", label: "Flux Pro · 演示", kinds: ["image", "storyboard", "scene", "character"], hint: "电影感静帧" },
  { id: "seedream", label: "即梦 4.0 · 演示", kinds: ["image"], hint: "角色三视图" },
  { id: "seedance-2.5", label: "Seedance 2.5 · 演示", kinds: ["video"], hint: "图生视频" },
  { id: "kling-1.6", label: "Kling 1.6 · 演示", kinds: ["video"], hint: "镜头运动" },
  { id: "eleven-demo", label: "声线工坊 · 演示", kinds: ["audio", "file"], hint: "对白 / 配乐" },
];

export function modelsFor(kind: NodeKind): MockModel[] {
  return MOCK_MODELS.filter((m) => m.kinds.includes(kind));
}

export function defaultModelId(kind: NodeKind): string {
  return modelsFor(kind)[0]?.id ?? MOCK_MODELS[0].id;
}
