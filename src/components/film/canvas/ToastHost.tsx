"use client";

import { useProjectStore } from "@/components/film/canvas/store/project-store";

export function ToastHost() {
  const toast = useProjectStore((s) => s.toast);
  if (!toast) return null;
  return (
    <div
      data-testid="toast"
      className="pointer-events-none fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 max-w-[min(92vw,28rem)] text-center rounded-full border border-[#363636] bg-[#1a1a1a] px-3 py-1.5 text-[12px] text-zinc-200 shadow-xl"
    >
      {toast}
    </div>
  );
}
