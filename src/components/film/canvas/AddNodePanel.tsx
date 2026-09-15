"use client";

import { useMemo, useState } from "react";
import {
  ChevronRight,
  Clapperboard,
  FileText,
  FolderOpen,
  History,
  ImageIcon,
  MapPinned,
  Search,
  Sparkles,
  Table2,
  Upload,
  UserRound,
  Video,
  Volume2,
} from "lucide-react";
import { ADD_MENU_ITEMS, type AddMenuItem } from "@/components/film/canvas/lib/graph-ops";
import { cn } from "@/lib/utils";
import { useProjectStore } from "@/components/film/canvas/store/project-store";

const ICONS: Record<string, typeof FileText> = {
  text: FileText,
  image: ImageIcon,
  video: Video,
  audio: Volume2,
  file: FileText,
  "agent-parse": Search,
  "agent-write": Sparkles,
  "agent-script": Sparkles,
  "agent-storyboard": Table2,
  "agent-scene": MapPinned,
  "agent-character": UserRound,
  "agent-image": ImageIcon,
  "agent-video": Clapperboard,
  upload: Upload,
  history: History,
};

type Branch = "asset" | "agent";
/** Nested under 导入资产: library vs local upload kinds. */
type AssetStep = "source" | "local";

export function AddNodePanel({
  onPick,
  onStub,
  onOpenLibrary,
  className,
  menuX,
}: {
  onPick: (item: AddMenuItem) => void;
  onStub?: (item: AddMenuItem) => void;
  /** 从资产库 — parent should close menu and open AssetLibrarySheet. */
  onOpenLibrary?: () => void;
  className?: string;
  menuX?: number;
}) {
  const lastAddNodeType = useProjectStore((s) => s.lastAddNodeType);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Branch | null>(null);
  const [assetStep, setAssetStep] = useState<AssetStep>("source");

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ADD_MENU_ITEMS;
    return ADD_MENU_ITEMS.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q)
    );
  }, [query]);

  const searching = query.trim().length > 0;
  const assets = items.filter((item) => item.section === "asset");
  const agents = items.filter((item) => item.section === "agent");
  const resources = ADD_MENU_ITEMS.filter((item) => item.section === "resource");
  const openLeft =
    typeof window !== "undefined" && (menuX ?? 0) > window.innerWidth - 420;

  const pick = (item: AddMenuItem) => {
    if (item.stub) {
      onStub?.(item);
      return;
    }
    onPick(item);
  };

  const openBranch = (branch: Branch) => {
    setOpen(branch);
    if (branch === "asset") setAssetStep("source");
  };

  const renderItem = (item: AddMenuItem) => {
    const Icon = ICONS[item.id] ?? FileText;
    const recent = item.kind && lastAddNodeType === item.kind;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => pick(item)}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] text-zinc-200 hover:bg-white/6",
          recent && "bg-white/6",
          item.stub && "text-zinc-400"
        )}
      >
        <Icon className="size-3.5 shrink-0 text-zinc-400" />
        <span className="min-w-0 flex-1">{item.label}</span>
      </button>
    );
  };

  const agentFlyout = () => {
    if (open !== "agent" || searching) return null;
    return (
      <div
        data-testid="add-submenu-agent"
        className={cn(
          "absolute top-0 z-10 w-52 rounded-2xl border border-[#363636] bg-[#1a1a1a] p-1.5 shadow-2xl",
          openLeft ? "right-full mr-1" : "left-full ml-1"
        )}
      >
        {agents.map(renderItem)}
      </div>
    );
  };

  const assetFlyout = () => {
    if (open !== "asset" || searching) return null;
    return (
      <div
        data-testid="add-submenu-asset"
        className={cn(
          "absolute top-0 z-10 w-52 rounded-2xl border border-[#363636] bg-[#1a1a1a] p-1.5 shadow-2xl",
          openLeft ? "right-full mr-1" : "left-full ml-1"
        )}
      >
        <button
          type="button"
          data-testid="import-from-library"
          onClick={() => onOpenLibrary?.()}
          className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] text-zinc-200 hover:bg-white/6"
        >
          <FolderOpen className="size-3.5 shrink-0 text-zinc-400" />
          <span className="min-w-0 flex-1">从资产库</span>
        </button>
        <div className="relative">
          <button
            type="button"
            data-testid="import-from-local"
            onMouseEnter={() => setAssetStep("local")}
            onClick={() =>
              setAssetStep((cur) => (cur === "local" ? "source" : "local"))
            }
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] text-zinc-200 hover:bg-white/6",
              assetStep === "local" && "bg-white/6"
            )}
          >
            <Upload className="size-3.5 shrink-0 text-zinc-400" />
            <span className="min-w-0 flex-1">从本地上传</span>
            <ChevronRight className="size-3.5 text-zinc-500" />
          </button>
          {assetStep === "local" ? (
            <div
              data-testid="add-submenu-asset-kinds"
              className={cn(
                "absolute top-0 z-10 w-52 rounded-2xl border border-[#363636] bg-[#1a1a1a] p-1.5 shadow-2xl",
                openLeft ? "right-full mr-1" : "left-full ml-1"
              )}
            >
              {assets.map(renderItem)}
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  const branchButton = (branch: Branch, label: string) => (
    <button
      type="button"
      data-testid={`add-branch-${branch}`}
      onMouseEnter={() => openBranch(branch)}
      onClick={() =>
        setOpen((cur) => {
          if (cur === branch) return null;
          if (branch === "asset") setAssetStep("source");
          return branch;
        })
      }
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] text-zinc-200 hover:bg-white/6",
        open === branch && "bg-white/6"
      )}
    >
      <span className="min-w-0 flex-1">{label}</span>
      <ChevronRight className="size-3.5 text-zinc-500" />
    </button>
  );

  return (
    <div
      data-testid="add-node-menu"
      className={cn(
        "relative w-48 rounded-2xl border border-[#363636] bg-[#1a1a1a] p-1.5 shadow-2xl",
        className
      )}
    >
      <div className="mb-1 flex items-center justify-between px-2 py-1.5">
        <p className="text-[12px] text-zinc-400">添加到画布</p>
        <Search className="size-3.5 text-zinc-500" />
      </div>
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(null);
          setAssetStep("source");
        }}
        placeholder="搜索"
        className="mb-1 w-full rounded-lg bg-black/30 px-2 py-1.5 text-[12px] text-zinc-200 outline-none placeholder:text-zinc-600"
      />
      {searching ? (
        <div className="max-h-80 overflow-y-auto">
          {items.length ? items.map(renderItem) : (
            <p className="px-2 py-3 text-[12px] text-zinc-500">没有匹配的类型</p>
          )}
        </div>
      ) : (
        <div className="relative">
          <div className="relative">
            {branchButton("asset", "导入资产")}
            {assetFlyout()}
          </div>
          <div className="relative">
            {branchButton("agent", "添加智能体")}
            {agentFlyout()}
          </div>
          <div className="my-1 h-px bg-white/8" />
          {resources.map(renderItem)}
        </div>
      )}
    </div>
  );
}
