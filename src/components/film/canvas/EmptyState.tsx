"use client";

export function EmptyState() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
      <p
        data-testid="empty-canvas-hint"
        className="text-[13px] tracking-[0.18em] text-[#8a8478]"
      >
        右键导入资产（资产库或本地上传），或添加智能体
      </p>
    </div>
  );
}
