import type { NodeKind } from "@/components/film/canvas/types/project";

export interface StarterCard {
  id: string;
  title: string;
  hint: string;
  kind: NodeKind;
  prompt: string;
  label: string;
  accent: string;
}

export const STARTER_CARDS: StarterCard[] = [
  {
    id: "story-script",
    title: "故事脚本生成",
    hint: "先写结构，再拆镜",
    kind: "text",
    label: "故事脚本",
    prompt: "古风穿越短剧，60–90秒，热血收束，开场要有钩子",
    accent: "bg-emerald-500",
  },
  {
    id: "character-turnaround",
    title: "角色三视图",
    hint: "正 / 侧 / 背设定",
    kind: "image",
    label: "角色三视图",
    prompt: "短剧男主三视图，盛唐儒生，冷白皮，电影灯光，白底",
    accent: "bg-rose-500",
  },
  {
    id: "ref-to-video",
    title: "参考图生视频",
    hint: "左图右片",
    kind: "video",
    label: "图生视频",
    prompt: "以参考图做 5 秒镜头：慢推城墙，衣袂与尘烟",
    accent: "bg-sky-500",
  },
  {
    id: "audio-to-video",
    title: "音频生视频",
    hint: "鼓点驱动剪辑",
    kind: "audio",
    label: "音频轨",
    prompt: "盛唐鼓点 + 低沉旁白：这一笔，改写山河",
    accent: "bg-violet-500",
  },
];

export interface AgentSkill {
  id: string;
  title: string;
  caption: string;
  seed: string;
}

export const AGENT_SKILLS: AgentSkill[] = [
  {
    id: "pixar-open",
    title: "皮克斯开场",
    caption: "暖色小品",
    seed: "用皮克斯小品节奏写一个 3 镜开场：台灯、草稿纸、窗外雨",
  },
  {
    id: "viral-hook",
    title: "爆款钩子",
    caption: "前 3 秒反转",
    seed: "写一个短剧爆款钩子，前 3 秒必须反转，然后接盛唐穿越",
  },
  {
    id: "neo-chinese",
    title: "新中式",
    caption: "留白与金箔",
    seed: "新中式美学：金箔、留白、慢门旗袍，生成文本-参考图-视频链",
  },
  {
    id: "wuxia",
    title: "古典武侠",
    caption: "竹林对剑",
    seed: "古典武侠：竹林对剑两镜，再接到城墙上写字的第三镜",
  },
  {
    id: "ui-polish",
    title: "游戏 UI 精修",
    caption: "界面高光",
    seed: "把界面做成游戏 HUD 精修：高光描边、半透明面板、可点击热区",
  },
  {
    id: "product-scene",
    title: "产品场景合成",
    caption: "货品入镜",
    seed: "产品场景合成：白底转生活场景，保留材质与比例",
  },
  {
    id: "film-grade",
    title: "电影工业调色",
    caption: "胶片感",
    seed: "按电影工业调色：青橙对比、轻颗粒、夜戏高光压一点",
  },
  {
    id: "east-aesthetic",
    title: "东方美学",
    caption: "留白与金箔",
    seed: "东方美学：金箔、留白、慢门旗袍，生成文本-参考图-视频链",
  },
  {
    id: "novel-script",
    title: "小说剧本",
    caption: "章回改镜头",
    seed: "把这段小说改成 60 秒三镜剧本，每镜写画面和对白",
  },
  {
    id: "character-board",
    title: "人物故事版",
    caption: "角色呈现",
    seed: "人物故事版：正侧背三视图 + 两句人物小传",
  },
];
