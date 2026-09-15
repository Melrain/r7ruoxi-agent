"use client";

import { useMemo } from "react";
import { useProjectStore } from "@/components/film/canvas/store/project-store";

/** 无感续进度：只读节点 status，顶条细线，不抢操作 */
export function ProgressHairline() {
  const nodes = useProjectStore((s) => s.nodes);
  const running = useMemo(
    () => nodes.filter((n) => n.data.status === "running"),
    [nodes],
  );
  if (!running.length) return null;
  const label =
    running.length === 1
      ? `${running[0].data.label || "智能体"}生成中`
      : `${running.length} 个任务进行中`;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-50">
      <div className="h-[2px] w-full overflow-hidden bg-white/5">
        <div className="progress-hairline h-full w-1/3 bg-gradient-to-r from-transparent via-amber-300/80 to-transparent" />
      </div>
      <p className="px-3 pt-1 text-center font-mono text-[10px] tracking-wide text-zinc-600">
        {label}
      </p>
    </div>
  );
}
