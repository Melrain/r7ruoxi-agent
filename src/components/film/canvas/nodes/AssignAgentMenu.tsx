"use client";

import {
  handoffOptions,
  type HandoffOption,
} from "@/components/film/canvas/lib/agent-catalog";
import { cn } from "@/lib/utils";
import type { AgentId, AssetKind } from "@/components/film/canvas/types/project";

export type { HandoffOption };

/** 统一「交给智能体」菜单源（+ / 交给… / 右键共用） */
export function AssignAgentMenu({
  kind,
  onPick,
  className,
  compact,
}: {
  kind: AssetKind;
  onPick: (agentId: AgentId) => void;
  className?: string;
  /** 图标卡旁侧更紧凑 */
  compact?: boolean;
}) {
  const options = handoffOptions(kind);
  return (
    <div
      className={cn(
        "z-20 min-w-36 rounded-xl border border-white/10 bg-[#0b0d13] p-1 shadow-2xl",
        className,
      )}
      role="menu"
      aria-label="交给智能体"
    >
      <p
        className={cn(
          "px-2 pb-1 pt-0.5 text-[10px] font-medium tracking-wide text-zinc-500",
          compact && "text-[9px]",
        )}
      >
        交给智能体
      </p>
      {options.map(({ spec, enabled, reason }) => (
        <button
          key={spec.id}
          type="button"
          role="menuitem"
          disabled={!enabled}
          title={reason}
          onClick={(e) => {
            e.stopPropagation();
            if (!enabled) return;
            onPick(spec.id);
          }}
          className={cn(
            "flex w-full flex-col rounded-lg px-2 py-1.5 text-left",
            compact ? "py-1 text-[11px]" : "text-[12px]",
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
  );
}
