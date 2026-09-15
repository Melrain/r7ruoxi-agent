"use client";

import type { NodeProps } from "@xyflow/react";
import { NodeChrome } from "@/components/film/canvas/nodes/NodeChrome";
import type { AppNode } from "@/components/film/canvas/types/project";

export function AudioNode({ id, data, selected }: NodeProps<AppNode>) {
  return (
    <NodeChrome id={id} data={data} selected={selected} width={300}>
      <div className="flex h-16 items-end gap-0.5 rounded-xl border border-white/[0.05] bg-[#07080c]/70 px-3 py-2.5">
        {Array.from({ length: 28 }).map((_, i) => (
          <span
            key={i}
            className="w-1 rounded-full bg-violet-400/70"
            style={{
              height: `${10 + ((i * 17) % 28)}px`,
              opacity: data.status === "success" ? 1 : 0.35,
            }}
          />
        ))}
      </div>
      <p className="mt-3 line-clamp-2 rounded-lg border border-white/[0.05] bg-[#07080c]/50 p-2.5 text-xs leading-relaxed text-slate-300">
        {data.prompt || data.text || "对白 / 配乐"}
      </p>
    </NodeChrome>
  );
}
