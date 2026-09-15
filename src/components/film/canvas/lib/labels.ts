import type { NodeKind, NodeStatus } from "@/components/film/canvas/types/project";

export const KIND_LABEL: Record<NodeKind, string> = {
  text: "文本",
  image: "图片",
  video: "视频",
  audio: "音频",
  file: "文件",
  script: "剧本",
  storyboard: "分镜",
  scene: "场景",
  character: "角色",
  agent: "智能体",
  skill: "Skill",
};

export const STATUS_LABEL: Record<NodeStatus, string> = {
  idle: "待生成",
  uploading: "上传中",
  running: "生成中",
  success: "已完成",
  error: "失败",
};

export const STORYBOARD_GROUPS: { id: string; label: string; kinds: NodeKind[] }[] =
  [
    { id: "text", label: "文本 / 剧本", kinds: ["text", "script", "file"] },
    { id: "world", label: "场景 / 角色", kinds: ["scene", "character"] },
    { id: "board", label: "分镜", kinds: ["storyboard"] },
    { id: "image", label: "图片", kinds: ["image"] },
    { id: "video", label: "视频", kinds: ["video"] },
    { id: "audio", label: "音频", kinds: ["audio"] },
  ];

export function isGeneratable(kind: NodeKind): boolean {
  return kind === "agent";
}
