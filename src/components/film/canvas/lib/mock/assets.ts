import type { NodeKind } from "@/components/film/canvas/types/project";

const KIND_COLOR: Record<NodeKind, string> = {
  text: "#14532d",
  image: "#1e3a5f",
  video: "#1e1b4b",
  audio: "#3b0764",
  file: "#3f3f46",
  script: "#134e4a",
  storyboard: "#115e59",
  scene: "#365314",
  character: "#7f1d1d",
  agent: "#164e63",
};

export function svgPoster(
  title: string,
  subtitle: string,
  fill: string,
  width = 720,
  height = 405
): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${fill}"/>
      <stop offset="100%" stop-color="#09090b"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <circle cx="${width - 80}" cy="70" r="90" fill="#ffffff" fill-opacity="0.06"/>
  <text x="48" y="${height / 2 - 8}" fill="#f4f4f5" font-size="32" font-family="ui-sans-serif,system-ui" font-weight="600">${escapeXml(title)}</text>
  <text x="48" y="${height / 2 + 32}" fill="#a1a1aa" font-size="18" font-family="ui-sans-serif,system-ui">${escapeXml(subtitle)}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function placeholderAsset(
  kind: NodeKind,
  seed: string,
  prompt: string
): string {
  const clip = prompt.trim().slice(0, 18) || "演示素材";
  if (kind === "image") {
    const picsum = `https://picsum.photos/seed/${encodeURIComponent(seed)}/720/405`;
    return picsum;
  }
  if (kind === "video") {
    return svgPoster("视频占位", clip, KIND_COLOR[kind]);
  }
  if (kind === "audio") {
    return svgPoster("音频波形", clip, KIND_COLOR.audio, 720, 240);
  }
  return svgPoster("文本成稿", clip, KIND_COLOR.text, 720, 240);
}

export function fallbackPoster(kind: NodeKind, prompt: string): string {
  const clip = prompt.trim().slice(0, 18) || "演示素材";
  const title =
    kind === "image"
      ? "分镜静帧"
      : kind === "video"
        ? "视频占位"
        : kind === "audio"
          ? "音频波形"
          : "文本成稿";
  return svgPoster(title, clip, KIND_COLOR[kind]);
}
