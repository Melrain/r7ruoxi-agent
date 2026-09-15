"use client";

import type { NodeProps } from "@xyflow/react";
import { NodeChrome } from "@/components/film/canvas/nodes/NodeChrome";
import type { AppNode } from "@/components/film/canvas/types/project";

function tagsFrom(text: string) {
  return [...text.matchAll(/#[\u4e00-\u9fff\w]+/g)].map((m) => m[0]).slice(0, 4);
}

export function TextNode({ id, data, selected }: NodeProps<AppNode>) {
  const body = data.text || data.prompt || "双击打开详情改正文";
  const tags = tagsFrom(`${data.text} ${data.prompt} ${data.label}`);

  return (
    <NodeChrome id={id} data={data} selected={selected} width={300}>
      <div className="rounded-xl border border-white/[0.04] bg-[#07080c]/60 p-3">
        <p className="line-clamp-6 text-[13px] leading-relaxed text-slate-300">
          {body}
        </p>
      </div>
      {tags.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md border border-white/5 bg-white/[0.03] px-2 py-0.5 font-mono text-[11px] text-slate-400"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </NodeChrome>
  );
}
