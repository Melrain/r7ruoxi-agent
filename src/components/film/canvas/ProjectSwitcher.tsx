"use client";

import { useState } from "react";
import {
  Check,
  ChevronDown,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useProjectStore } from "@/components/film/canvas/store/project-store";

export function ProjectSwitcher({ className }: { className?: string }) {
  const projectId = useProjectStore((s) => s.projectId);
  const projectList = useProjectStore((s) => s.projectList);
  const workspaceTitle = useProjectStore((s) => s.workspaceTitle);
  const canvasName = useProjectStore((s) => s.canvasName);
  const switchProject = useProjectStore((s) => s.switchProject);
  const createEmptyProject = useProjectStore((s) => s.createEmptyProject);
  const renameCurrentProject = useProjectStore((s) => s.renameCurrentProject);
  const deleteCurrentProject = useProjectStore((s) => s.deleteCurrentProject);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState("");

  const title =
    workspaceTitle.trim() || canvasName.trim() || "未命名影片";
  // Always show recent strip (current included); cap 8.
  const recent = projectList.slice(0, 8);

  return (
    <div className={cn("flex min-w-0 items-center", className)}>
      <DropdownMenu
        onOpenChange={(open) => {
          if (!open) setRenaming(false);
        }}
      >
        {/* Text trigger — avoid a second gray pill sitting under the white menu */}
        <DropdownMenuTrigger className="inline-flex max-w-[min(220px,46vw)] items-center gap-0.5 rounded-md px-1.5 py-0.5 text-left text-[12px] text-zinc-300 outline-none hover:bg-white/8 hover:text-zinc-100 data-[popup-open]:bg-white/8">
          <span className="truncate font-medium">{title}</span>
          <ChevronDown className="size-3.5 shrink-0 text-zinc-500" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          sideOffset={6}
          className="min-w-56 border-white/10 bg-[#1a1d24] text-zinc-100 shadow-xl"
        >
          <p className="px-2 pb-1 pt-1.5 text-[10px] uppercase tracking-wide text-zinc-500">
            最近
          </p>
          {recent.length === 0 ? (
            <p className="px-2 py-2 text-[12px] text-zinc-500">暂无项目</p>
          ) : (
            recent.map((item) => (
              <DropdownMenuItem
                key={item.id}
                onClick={() => switchProject(item.id)}
                className="flex items-center justify-between gap-2 text-zinc-200 focus:bg-white/8 focus:text-zinc-50"
              >
                <span className="truncate">{item.title || "未命名影片"}</span>
                {item.id === projectId ? (
                  <Check className="size-3.5 shrink-0 text-zinc-400" />
                ) : null}
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator className="bg-white/10" />
          <DropdownMenuItem
            onClick={() => createEmptyProject()}
            className="gap-2 text-zinc-200 focus:bg-white/8"
          >
            <Plus className="size-3.5" />
            新建项目
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="gap-2 text-zinc-400 focus:bg-white/8 data-[state=open]:bg-white/8">
              <MoreHorizontal className="size-3.5" />
              管理
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="min-w-40 border-white/10 bg-[#1a1d24] text-zinc-100">
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  setDraft(title);
                  setRenaming(true);
                }}
                className="focus:bg-white/8"
              >
                重命名…
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  if (window.confirm(`删除「${title}」？`)) {
                    deleteCurrentProject();
                  }
                }}
                className="gap-2 text-zinc-400 focus:bg-white/8 focus:text-rose-300/90"
              >
                <Trash2 className="size-3.5" />
                删除
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          {renaming ? (
            <div
              className="border-t border-white/10 p-2"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    renameCurrentProject(draft);
                    setRenaming(false);
                  }
                  if (e.key === "Escape") setRenaming(false);
                }}
                className="w-full rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-[12px] text-zinc-100 outline-none"
                placeholder="项目名"
              />
            </div>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
