"use client";

import { Position, type NodeProps } from "@xyflow/react";
import { LitHandle } from "@/components/film/canvas/nodes/LitHandle";
import { SKILL_PORT_COLOR } from "@/components/film/canvas/lib/port-color";
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  resolveEquippedSkill,
  skillHandoffOptions,
} from "@/components/film/canvas/lib/agent-catalog";
import { cn } from "@/lib/utils";
import { useProjectStore } from "@/components/film/canvas/store/project-store";
import type { AppNode, AgentId } from "@/components/film/canvas/types/project";

/** Dark low-sat cover by skill face (agent type). Solid color only — no image/emoji. */
const COVER_BY_AGENT: Record<string, { face: string; edge: string; spine: string }> = {
  parse: { face: "#1a2740", edge: "#2a3d5c", spine: "#0f1729" },
  script: { face: "#24201a", edge: "#3d3528", spine: "#16130f" },
  image: { face: "#1f2438", edge: "#323a55", spine: "#12151f" },
};
const COVER_DEFAULT = { face: "#1a2333", edge: "#2c3a4f", spine: "#0e1420" };

/**
 * Compact vertical book Skill card:
 * cover + thin page edge; title below; hint under title; click opens full body.
 * Right out = click menu / drag assemble (unchanged).
 */
export function SkillNode({ id, data, selected }: NodeProps<AppNode>) {
  const assignSkill = useProjectStore((s) => s.assignSkill);
  const openNodeDetail = useProjectStore((s) => s.openNodeDetail);
  const edges = useProjectStore((s) => s.edges);
  const nodes = useProjectStore((s) => s.nodes);
  const [handoff, setHandoff] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const ptrRef = useRef<{ x: number; y: number } | null>(null);
  const draggedRef = useRef(false);
  const nodeIdRef = useRef(id);
  nodeIdRef.current = id;
  const HANDLE_CLICK_PX = 5;

  const title = (data.skillTitle || data.label || "Skill").trim();
  const version = data.skillVersion?.trim() || "";
  const face = data.skillAgent?.trim() || "";
  const cover = COVER_BY_AGENT[face] ?? COVER_DEFAULT;

  const equippedSomewhere = edges.some((edge) => {
    if (edge.source !== id || edge.data?.edgeKind === "out") return false;
    const tgt = nodes.find((n) => n.id === edge.target);
    return Boolean(tgt && tgt.data.kind === "agent");
  });
  const isAssembled = edges.some((edge) => {
    if (edge.source !== id) return false;
    const eq = resolveEquippedSkill(edge.target, nodes, edges);
    return eq?.skillNodeId === id;
  });
  const assembled = isAssembled || equippedSomewhere;

  useEffect(() => {
    if (!handoff) return;
    const onDown = (e: PointerEvent) => {
      const el = menuRef.current;
      if (el && e.target instanceof Node && el.contains(e.target)) return;
      if (
        e.target instanceof Element &&
        e.target.closest(`[data-skill-source-handle="${nodeIdRef.current}"]`)
      ) {
        return;
      }
      setHandoff(false);
    };
    const t = window.setTimeout(() => {
      document.addEventListener("pointerdown", onDown, true);
    }, 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [handoff]);

  const options = skillHandoffOptions(face);

  // Book/title: allow RF node drag; only open detail on true click (movement < threshold).
  const bodyPtrRef = useRef<{ x: number; y: number } | null>(null);
  const bodyDraggedRef = useRef(false);
  const BODY_CLICK_PX = 5;

  const onBodyPointerDown = (e: ReactPointerEvent) => {
    bodyPtrRef.current = { x: e.clientX, y: e.clientY };
    bodyDraggedRef.current = false;
    const onMove = (ev: PointerEvent) => {
      const start = bodyPtrRef.current;
      if (!start || bodyDraggedRef.current) return;
      if (
        Math.hypot(ev.clientX - start.x, ev.clientY - start.y) >= BODY_CLICK_PX
      ) {
        bodyDraggedRef.current = true;
      }
    };
    const onUp = () => {
      document.removeEventListener("pointermove", onMove, true);
      document.removeEventListener("pointerup", onUp, true);
      document.removeEventListener("pointercancel", onUp, true);
    };
    document.addEventListener("pointermove", onMove, true);
    document.addEventListener("pointerup", onUp, true);
    document.addEventListener("pointercancel", onUp, true);
  };

  const openBody = (e: MouseEvent) => {
    e.stopPropagation();
    if (bodyDraggedRef.current) {
      bodyDraggedRef.current = false;
      bodyPtrRef.current = null;
      return;
    }
    bodyPtrRef.current = null;
    openNodeDetail(id);
  };

  return (
    <div className="relative w-[88px]" data-testid="skill-node">
      <div
        className={cn(
          "node-icon relative flex w-full flex-col items-center",
          selected && "is-selected",
        )}
      >
        {/* Vertical book: cover + thin thickness/page edge */}
        <button
          type="button"
          data-testid="skill-book-cover"
          title={title}
          onPointerDown={onBodyPointerDown}
          onClick={openBody}
          className={cn(
            "skill-book relative shrink-0 cursor-pointer rounded-[3px] text-left outline-none",
            "h-[104px] w-[78px]",
            selected && "skill-book--selected",
            assembled ? "skill-book--assembled" : "skill-book--idle",
          )}
          style={{
            background: cover.face,
            boxShadow: `
              3px 0 0 0 ${cover.spine},
              5px 0 0 0 ${cover.edge},
              6px 1px 0 0 rgb(255 255 255 / 8%),
              0 4px 14px rgb(0 0 0 / 45%)
            `,
          }}
        >
          {/* Page-edge (thickness) strip on the right of the face */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-[4px] right-0 w-[3px] rounded-r-[1px]"
            style={{
              background: `linear-gradient(180deg, ${cover.edge} 0%, rgb(255 255 255 / 12%) 45%, ${cover.edge} 100%)`,
              boxShadow: "inset -1px 0 0 rgb(255 255 255 / 10%)",
            }}
          />
          {/* Weak Skill / version badge only — no long name on spine */}
          <div className="absolute left-1.5 top-1.5 flex max-w-[calc(100%-12px)] items-center gap-0.5">
            <span className="rounded-[3px] border border-[#60a5fa]/35 bg-[#60a5fa]/10 px-1 py-px text-[7px] font-semibold tracking-wider text-[#93c5fd]/90">
              SKILL
            </span>
            {version ? (
              <span className="truncate font-mono text-[7px] leading-none text-zinc-500">
                v{version}
              </span>
            ) : null}
          </div>
        </button>

        {/* Title BELOW book — centered, one-line truncate */}
        <button
          type="button"
          data-testid="skill-book-title"
          title={title}
          onPointerDown={onBodyPointerDown}
          onClick={openBody}
          className="mt-1.5 w-full cursor-pointer truncate text-center text-[11px] font-medium leading-tight tracking-wide text-zinc-100 hover:text-white"
        >
          {title}
        </button>

        {/* Assemble hint under title */}
        <p
          className={cn(
            "mt-0.5 w-full truncate text-center text-[9px] leading-tight",
            assembled ? "text-[#93c5fd]/85" : "text-zinc-500",
          )}
          data-testid="skill-assemble-hint"
        >
          {assembled ? "已装配" : "连到智能体 Skill 口以装配"}
        </p>

        <LitHandle
          id="out-l"
          type="source"
          position={Position.Left}
          className="node-handle node-handle-skill-out"
          aria-label="Skill 出点"
          title="Skill 出点 · 接到 Agent Skill 入点"
          style={{ background: SKILL_PORT_COLOR }}
        />
        <LitHandle
          id="out"
          type="source"
          position={Position.Right}
          primaryForNull
          className="node-handle node-handle-skill-out"
          data-skill-source-handle={id}
          aria-label="Skill 出点"
          title="Skill 出点 · 接到 Agent Skill 入点"
          style={{ background: SKILL_PORT_COLOR }}
          onPointerDown={(e) => {
            ptrRef.current = { x: e.clientX, y: e.clientY };
            draggedRef.current = false;
            const onMove = (ev: PointerEvent) => {
              const start = ptrRef.current;
              if (!start || draggedRef.current) return;
              if (
                Math.hypot(ev.clientX - start.x, ev.clientY - start.y) >=
                HANDLE_CLICK_PX
              ) {
                draggedRef.current = true;
              }
            };
            const onUp = () => {
              document.removeEventListener("pointermove", onMove, true);
              document.removeEventListener("pointerup", onUp, true);
              document.removeEventListener("pointercancel", onUp, true);
              const wasClick = ptrRef.current != null && !draggedRef.current;
              ptrRef.current = null;
              if (wasClick) setHandoff((open) => !open);
            };
            document.addEventListener("pointermove", onMove, true);
            document.addEventListener("pointerup", onUp, true);
            document.addEventListener("pointercancel", onUp, true);
          }}
        />
        <div
          ref={menuRef}
          className="nodrag nowheel nopan absolute z-[100]"
          style={{
            left: "100%",
            top: "40%",
            marginLeft: 16,
            transform: "translateY(-20%)",
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
          }}
        >
          {handoff ? (
            <div
              className="min-w-40 rounded-xl border border-white/10 bg-[#0b0d13] p-1 shadow-2xl"
              role="menu"
              aria-label="装配到智能体"
              data-testid="skill-assign-menu"
            >
              <p className="px-2 pb-1 pt-0.5 text-[9px] font-medium tracking-wide text-zinc-500">
                装配到智能体
              </p>
              {options.map(({ spec, enabled, reason }) => (
                <button
                  key={spec.id}
                  type="button"
                  role="menuitem"
                  disabled={!enabled}
                  title={reason}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (!enabled) return;
                    assignSkill(id, spec.id as AgentId);
                    setHandoff(false);
                  }}
                  className={cn(
                    "flex w-full flex-col rounded-lg px-2 py-1 text-left text-[11px]",
                    enabled
                      ? "text-slate-200 hover:bg-white/[0.06]"
                      : "cursor-not-allowed text-slate-500 opacity-45",
                  )}
                >
                  <span>{spec.label}</span>
                  {!enabled && reason ? (
                    <span className="mt-0.5 text-[9px] leading-tight text-zinc-600">
                      {reason}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
