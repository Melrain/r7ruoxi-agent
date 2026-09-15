"use client";

import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type Edge,
  type EdgeProps,
  type EdgeTypes,
} from "@xyflow/react";
import { KIND_LABEL } from "@/components/film/canvas/lib/labels";
import { PORT_COLOR } from "@/components/film/canvas/lib/port-color";
import type { AssetKind, EdgeKind } from "@/components/film/canvas/types/project";

export type TopologyData = {
  edgeKind?: EdgeKind;
  running?: boolean;
  labelKind?: AssetKind;
};

type TopologyEdgeType = Edge<TopologyData, "topology">;

export function TopologyEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps<TopologyEdgeType>) {
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  const isOut = data?.edgeKind === "out";
  const running = Boolean(data?.running);
  const kind = data?.labelKind;
  const color = running ? "#e8c27a" : (kind && PORT_COLOR[kind]) || "#c4b496";
  const label = kind ? KIND_LABEL[kind] : undefined;
  const tone = running ? "running" : selected ? "selected" : isOut ? "out" : "in";
  const dur = running ? "1.05s" : "3.2s";

  return (
    <g className={`topology-edge ${tone}`}>
      <BaseEdge id={`${id}-glow`} path={path} className={`edge-glow ${tone}`} />
      <BaseEdge
        id={id}
        path={path}
        className={`edge-flow ${tone}`}
        style={{ stroke: color }}
      />
      <circle r={running ? 3.2 : 2.2} fill={color} className={`edge-dot ${tone}`}>
        <animateMotion dur={dur} repeatCount="indefinite" path={path} />
      </circle>
      <circle r={1.4} fill={color} opacity={0.45} className={`edge-dot ${tone}`}>
        <animateMotion dur={dur} begin="0.55s" repeatCount="indefinite" path={path} />
      </circle>
      {label ? (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan rounded-full bg-[#0c0b10]/88 px-2 py-px text-[10px] tracking-[0.14em] text-[#c4b496]"
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "none",
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </g>
  );
}

export const edgeTypes = {
  topology: TopologyEdge,
} satisfies EdgeTypes;
