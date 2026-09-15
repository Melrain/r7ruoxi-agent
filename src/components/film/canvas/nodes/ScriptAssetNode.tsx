"use client";

import type { NodeProps } from "@xyflow/react";
import { Clapperboard } from "lucide-react";
import { NodeChrome } from "@/components/film/canvas/nodes/NodeChrome";
import type { AppNode } from "@/components/film/canvas/types/project";

const META_KEYS = ["类型", "时长建议", "基调"] as const;

function parseScript(text: string) {
  const lines = text
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const title = lines.find((line) => line.startsWith("《")) ?? "";
  const meta: { label: string; value: string }[] = [];
  for (const key of META_KEYS) {
    const line = lines.find((item) => item.startsWith(`${key}：`) || item.startsWith(`${key}:`));
    if (line) {
      meta.push({
        label: key,
        value: line.replace(/^[^：:]+[：:]/, "").trim(),
      });
    }
  }
  const sceneIdx = lines.findIndex((line) => line.startsWith("【"));
  let scene = "";
  let excerpt = "";
  if (sceneIdx >= 0) {
    scene = lines[sceneIdx];
    excerpt = lines.slice(sceneIdx + 1).join(" ");
  } else {
    excerpt = lines
      .filter((line) => !line.startsWith("《") && !/^(类型|时长建议|基调)[：:]/.test(line))
      .join(" ");
  }
  return { title, meta, scene, excerpt };
}

export function ScriptAssetNode({ id, data, selected }: NodeProps<AppNode>) {
  const parsed = parseScript(data.text || data.prompt || "");
  const title = parsed.title || data.label;
  const excerpt = parsed.excerpt || data.prompt || "还没有剧本文字";

  return (
    <NodeChrome id={id} data={data} selected={selected} width={340}>
      <div className="space-y-3">
        <div className="rounded-xl border-l-2 border-amber-500 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent px-3.5 py-2.5">
          <h3 className="text-sm leading-snug font-semibold text-amber-200">{title}</h3>
        </div>

        {parsed.meta.length > 0 ? (
          <div className="space-y-2 pl-1 text-[13px] text-slate-300">
            {parsed.meta.map((item) => (
              <div key={item.label} className="flex items-baseline gap-2">
                <span className="shrink-0 text-xs font-medium text-slate-400">{item.label}:</span>
                <span className={item.label === "时长建议" ? "font-mono text-xs text-amber-300/90" : "text-slate-200"}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        ) : data.duration ? (
          <p className="font-mono text-xs text-amber-300/90">{data.duration}</p>
        ) : null}

        <div className="space-y-2 rounded-xl border border-white/[0.06] bg-[#07080c]/70 p-3.5">
          {parsed.scene ? (
            <div className="flex items-center justify-between text-slate-400">
              <span className="flex items-center gap-1.5 font-medium text-amber-400/90">
                <Clapperboard className="size-3.5" />
                <span>{parsed.scene}</span>
              </span>
            </div>
          ) : null}
          <p className="line-clamp-4 text-[12px] leading-relaxed text-slate-300">{excerpt}</p>
        </div>
      </div>
    </NodeChrome>
  );
}
