"use client";

import { useState } from "react";
import { CONTRACT_KINDS } from "@/components/film/canvas/lib/agent-catalog";
import { KIND_LABEL } from "@/components/film/canvas/lib/labels";
import { cn } from "@/lib/utils";
import { useProjectStore } from "@/components/film/canvas/store/project-store";
import type { AssetKind } from "@/components/film/canvas/types/project";

export function CreateAgentSheet() {
  const draft = useProjectStore((s) => s.createAgentDraft);
  const closeCreateAgent = useProjectStore((s) => s.closeCreateAgent);
  const addCustomAgent = useProjectStore((s) => s.addCustomAgent);
  const [label, setLabel] = useState("");
  const [accepts, setAccepts] = useState<AssetKind[]>(["text"]);
  const [emits, setEmits] = useState<AssetKind>("script");

  if (!draft) return null;

  const toggle = (kind: AssetKind) => {
    setAccepts((cur) =>
      cur.includes(kind) ? cur.filter((item) => item !== kind) : [...cur, kind]
    );
  };

  const ready = accepts.length > 0 && Boolean(emits);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4"
      onClick={closeCreateAgent}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/8 bg-[#0c0c0e] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.55)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-baseline justify-between">
          <p className="text-[14px] text-zinc-200">写一份合同</p>
          <p className="font-mono text-[10px] tracking-wider text-zinc-600">智能体</p>
        </div>

        <label className="mb-4 block">
          <span className="mb-1.5 block font-mono text-[10px] tracking-[0.18em] text-zinc-500">
            名字
          </span>
          <input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="未命名智能体"
            className="w-full rounded-lg border border-white/8 bg-black/30 px-3 py-2 text-[13px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-amber-400/40"
          />
        </label>

        <div className="mb-4">
          <p className="mb-1.5 font-mono text-[10px] tracking-[0.18em] text-zinc-500">
            入 · 可多选
          </p>
          <div className="flex flex-wrap gap-1.5">
            {CONTRACT_KINDS.map((kind) => {
              const on = accepts.includes(kind);
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => toggle(kind)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[12px]",
                    on
                      ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-200"
                      : "border-white/8 text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  {KIND_LABEL[kind]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-5">
          <p className="mb-1.5 font-mono text-[10px] tracking-[0.18em] text-zinc-500">
            出 · 恰好一种
          </p>
          <div className="flex flex-wrap gap-1.5">
            {CONTRACT_KINDS.map((kind) => {
              const on = emits === kind;
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setEmits(kind)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[12px]",
                    on
                      ? "border-amber-400/40 bg-amber-500/10 text-amber-200"
                      : "border-white/8 text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  {KIND_LABEL[kind]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={closeCreateAgent}
            className="rounded-full px-3 py-1.5 text-[12px] text-zinc-500 hover:text-zinc-300"
          >
            取消
          </button>
          <button
            type="button"
            disabled={!ready}
            onClick={() => {
              addCustomAgent({ label, accepts, emits });
              setLabel("");
              setAccepts(["text"]);
              setEmits("script");
            }}
            className="rounded-full border border-[#fbbf24]/70 bg-[#0b0d14] px-3.5 py-1.5 text-[12px] text-[#fbbf24] disabled:border-white/10 disabled:text-slate-600"
          >
            放到画布
          </button>
        </div>
      </div>
    </div>
  );
}
