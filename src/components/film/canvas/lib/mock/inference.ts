import { fallbackPoster, placeholderAsset } from "@/components/film/canvas/lib/mock/assets";
import type { InferenceRequest, InferenceResult } from "@/components/film/canvas/types/project";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitter(min = 800, max = 1500) {
  return Math.round(min + Math.random() * (max - min));
}

export async function runInference(
  request: InferenceRequest
): Promise<InferenceResult> {
  await delay(jitter());

  if (
    request.kind === "text" ||
    request.kind === "script" ||
    request.kind === "storyboard" ||
    request.kind === "scene" ||
    request.kind === "character" ||
    request.kind === "file" ||
    request.kind === "agent"
  ) {
    return {
      status: "success",
      text: mockScriptFromPrompt(request.prompt),
    };
  }

  const remote = placeholderAsset(request.kind, request.nodeId, request.prompt);
  return {
    status: "success",
    assetUrl:
      request.kind === "image"
        ? fallbackPoster(request.kind, request.prompt)
        : remote,
  };
}

export function mockParseFromPrompt(prompt: string): string {
  const topic = prompt.trim() || "参考片";
  return `【视频解析 · 演示】
参考：${topic.slice(0, 40)}

钩子：前 3 秒情绪反转
节奏：快切 / 对白少 / 字幕承担信息
人物：主角 1，对手 1
可复用：开场钩子、中段反转、片尾 CTA

（mock，不接真实模型）`;
}

export function mockScriptFromPrompt(prompt: string): string {
  const topic = prompt.trim() || "未命名短剧";
  return `《${topic.slice(0, 16)}》
类型：古风 / 穿越 / 爽文漫剧
时长建议：60–90秒
基调：热血 × 盛唐史诗感 × 爽点节奏

【序幕】
现代深夜办公室。屏幕冷光打在脸上，主角把一页未写完的故事存档。

【转折】
墨迹化开，长安夜市的鼓点叠上来。他握笔的手不再发抖。

【高潮】
城墙上写下《天下》——这一笔，改写山河。`;
}

export async function runRowJob(fail: boolean): Promise<{
  status: "success" | "error";
  assetUrl?: string;
  errorMessage?: string;
}> {
  await delay(jitter(700, 1300));
  if (fail) {
    return {
      status: "error",
      errorMessage: "演示：该镜运动参数越界（可点重置）",
    };
  }
  return {
    status: "success",
    assetUrl: placeholderAsset(
      "video",
      `row_${Math.random().toString(36).slice(2, 7)}`,
      "分镜成片"
    ),
  };
}
