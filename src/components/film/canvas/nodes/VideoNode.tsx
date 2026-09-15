"use client";

import type { NodeProps } from "@xyflow/react";
import { Play } from "lucide-react";
import { resolveMediaSrc } from "@/components/film/canvas/lib/resolve-asset-url";
import { AssetFrame, NodeChrome } from "@/components/film/canvas/nodes/NodeChrome";
import type { AppNode } from "@/components/film/canvas/types/project";

export function VideoNode({ id, data, selected }: NodeProps<AppNode>) {
  const mediaUrl = resolveMediaSrc(data.assetUrl);
  return (
    <NodeChrome id={id} data={data} selected={selected} width={300}>
      <div className="relative">
        <AssetFrame
          src={mediaUrl}
          alt={data.label}
          kind={data.kind}
          prompt={data.prompt}
          running={data.status === "running"}
          empty="等待成片"
          hint="跑智能体后会出现在这里"
        />
        {mediaUrl && data.status === "success" ? (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-black/55 text-white">
              <Play className="size-4 fill-white" />
            </span>
          </span>
        ) : null}
      </div>
      <div className="mt-3.5 space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span>提示词</span>
          <span className="font-mono text-cyan-400/80">{data.duration || data.aspect}</span>
        </div>
        <p className="line-clamp-2 rounded-lg border border-white/[0.05] bg-[#07080c]/50 p-2.5 text-xs leading-relaxed text-slate-300">
          {data.prompt || "图生视频提示词"}
        </p>
      </div>
    </NodeChrome>
  );
}
