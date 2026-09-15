"use client";

import type { NodeProps } from "@xyflow/react";
import { NodeChrome, StatusBadge } from "@/components/film/canvas/nodes/NodeChrome";
import { useProjectStore } from "@/components/film/canvas/store/project-store";
import type { AppNode } from "@/components/film/canvas/types/project";

export function ScriptNode({ id, data, selected }: NodeProps<AppNode>) {
  const updateScriptRow = useProjectStore((s) => s.updateScriptRow);
  const resetScriptRow = useProjectStore((s) => s.resetScriptRow);
  const rows = data.scriptRows ?? [];

  return (
    <NodeChrome id={id} data={data} selected={selected} width={400}>
      <div className="nodrag nowheel nopan">
        <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-[#07080c]/70">
          <table className="w-full border-collapse text-[11px] text-slate-300">
            <thead className="bg-black/30 text-[10px] text-slate-500">
              <tr>
                <th className="w-7 px-1.5 py-1.5 font-medium">选</th>
                <th className="w-10 px-1 py-1.5 text-left font-medium">镜号</th>
                <th className="w-10 px-1 py-1.5 text-left font-medium">时长</th>
                <th className="px-1 py-1.5 text-left font-medium">画面</th>
                <th className="px-1 py-1.5 text-left font-medium">对白</th>
                <th className="w-16 px-1 py-1.5 text-left font-medium">状态</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-white/[0.05]">
                  <td className="px-1.5 py-1.5 text-center">
                    <input
                      type="checkbox"
                      checked={row.selected}
                      onChange={(e) =>
                        updateScriptRow(id, row.id, { selected: e.target.checked })
                      }
                      className="accent-amber-400"
                    />
                  </td>
                  <td className="px-1 py-1.5 font-medium">{row.shotId}</td>
                  <td className="px-1 py-1.5 font-mono text-[10px]">{row.duration}</td>
                  <td className="max-w-[120px] truncate px-1 py-1.5 text-slate-400">
                    {row.visualDesc}
                  </td>
                  <td className="max-w-[90px] truncate px-1 py-1.5 text-slate-500">
                    {row.dialogue}
                  </td>
                  <td className="px-1 py-1.5">
                    <StatusBadge status={row.rowStatus} />
                    {row.rowStatus === "error" ? (
                      <button
                        type="button"
                        className="mt-0.5 block text-[10px] text-cyan-300"
                        onClick={() => resetScriptRow(id, row.id)}
                      >
                        重置
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 ? (
          <p className="mt-2 text-[11px] text-slate-500">还没有分镜行。交给拆分镜生成。</p>
        ) : (
          <p className="mt-2 text-[11px] text-slate-500">分镜是资产。要再拆或出片，交给对应智能体。</p>
        )}
      </div>
    </NodeChrome>
  );
}
