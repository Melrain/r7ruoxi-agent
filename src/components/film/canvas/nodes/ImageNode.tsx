"use client";

import type { NodeProps } from "@xyflow/react";
import { resolveMediaSrc } from "@/components/film/canvas/lib/resolve-asset-url";
import { AssetFrame, NodeChrome } from "@/components/film/canvas/nodes/NodeChrome";
import type { AppNode } from "@/components/film/canvas/types/project";

export function ImageNode({ id, data, selected }: NodeProps<AppNode>) {
  return (
    <NodeChrome id={id} data={data} selected={selected} width={300}>
      <AssetFrame
        src={resolveMediaSrc(data.assetUrl)}
        alt={data.label}
        kind={data.kind}
        prompt={data.prompt}
        running={data.status === "running"}
        empty="等待参考图"
        hint="支持从剧本提取分镜"
      />
      <div className="mt-3.5 space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span>提示词</span>
          {data.aspect ? (
            <span className="font-mono text-cyan-400/80">{data.aspect}</span>
          ) : null}
        </div>
        <p className="line-clamp-3 rounded-lg border border-white/[0.05] bg-[#07080c]/50 p-2.5 text-xs leading-relaxed text-slate-300">
          {data.prompt || "在生成器中填写提示词"}
        </p>
      </div>
    </NodeChrome>
  );
}
