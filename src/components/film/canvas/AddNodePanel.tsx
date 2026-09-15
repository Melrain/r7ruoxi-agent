"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  Clapperboard,
  FileText,
  FolderOpen,
  History,
  Wand2,
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
import {
  normalizeAgentSkillList,
  placeSkillOnCanvas,
} from "@/components/film/canvas/lib/place-skill";
import { listAgentSkills, type AgentSkillListItem } from "@/lib/api/skills";
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

type Branch = "asset" | "agent" | "skill";
/** Nested under 导入资产: library vs local upload kinds. */
type AssetStep = "source" | "local";

export function AddNodePanel({
  onPick,
  onStub,
  onOpenLibrary,
  onOpenSkillLibrary,
  onSkillPlaced,
  skillPlacePosition,
  className,
  menuX,
}: {
  onPick: (item: AddMenuItem) => void;
  onStub?: (item: AddMenuItem) => void;
  /** 从资产库 — parent should close menu and open AssetLibrarySheet. */
  onOpenLibrary?: () => void;
  /** Skill 库（次要）— 浏览正文；主路径是右侧 Skill 子菜单直接放入画布. */
  onOpenSkillLibrary?: () => void;
  /** After placing a Skill from the submenu — parent closes dropdown / menu. */
  onSkillPlaced?: () => void;
  /** Optional canvas position (e.g. right-click add menu flow coords). */
  skillPlacePosition?: { x: number; y: number };
  className?: string;
  menuX?: number;
}) {
  const lastAddNodeType = useProjectStore((s) => s.lastAddNodeType);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Branch | null>(null);
  const [assetStep, setAssetStep] = useState<AssetStep>("source");
  /** Search hit an asset kind → force 库|本地 before local-upload. */
  const [searchAssetChoice, setSearchAssetChoice] = useState<AddMenuItem | null>(
    null
  );
  const [skills, setSkills] = useState<AgentSkillListItem[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [skillsError, setSkillsError] = useState<string | null>(null);
  const [skillsLoaded, setSkillsLoaded] = useState(false);

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

  useEffect(() => {
    // 勿把 skillsLoading 放进 deps/guard：setLoading(true) 会重跑 effect →
    // cleanup abort 后 early-return，finally 又因 aborted 不清 loading → 永久「加载中」。
    if (open !== "skill" || skillsLoaded) return;
    const ac = new AbortController();
    let alive = true;
    setSkillsLoading(true);
    setSkillsError(null);
    void listAgentSkills({ status: "published", signal: ac.signal })
      .then((raw) => {
        if (!alive || ac.signal.aborted) return;
        setSkills(normalizeAgentSkillList(raw));
        setSkillsLoaded(true);
      })
      .catch((err) => {
        if (!alive || ac.signal.aborted) return;
        if (
          (typeof DOMException !== "undefined" &&
            err instanceof DOMException &&
            err.name === "AbortError") ||
          (err instanceof Error && err.name === "AbortError")
        ) {
          return;
        }
        setSkillsError(err instanceof Error ? err.message : "加载 Skill 失败");
        setSkills([]);
        setSkillsLoaded(true);
      })
      .finally(() => {
        if (alive) setSkillsLoading(false);
      });
    return () => {
      alive = false;
      ac.abort();
    };
  }, [open, skillsLoaded]);

  const pick = (item: AddMenuItem) => {
    if (item.stub) {
      onStub?.(item);
      return;
    }
    onPick(item);
  };

  /** Search results: asset kinds must not silently local-upload. */
  const pickFromSearch = (item: AddMenuItem) => {
    if (item.stub) {
      onStub?.(item);
      return;
    }
    if (item.section === "asset") {
      setSearchAssetChoice(item);
      return;
    }
    onPick(item);
  };

  const openBranch = (branch: Branch) => {
    setOpen(branch);
    if (branch === "asset") setAssetStep("source");
  };

  const pickSkill = (item: AgentSkillListItem) => {
    placeSkillOnCanvas(item, { position: skillPlacePosition });
    onSkillPlaced?.();
  };

  const renderItem = (
    item: AddMenuItem,
    onClick: (item: AddMenuItem) => void = pick
  ) => {
    const Icon = ICONS[item.id] ?? FileText;
    const recent = item.kind && lastAddNodeType === item.kind;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => onClick(item)}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] text-zinc-200 hover:bg-white/6",
          recent && "bg-white/6",
          item.stub && "text-zinc-400"
        )}
      >
        <Icon className="size-3.5 shrink-0 text-zinc-400" />
        <span className="min-w-0 flex-1">{item.label}</span>
        {searching && item.section === "asset" && !item.stub ? (
          <ChevronRight className="size-3.5 text-zinc-500" />
        ) : null}
      </button>
    );
  };

  const agentFlyout = () => {
    if (open !== "agent" || searching) return null;
    // Outer shell uses horizontal padding (not margin) so the trigger↔flyout
    // path stays inside this branch's hit box; never extends over Skill below.
    return (
      <div
        className={cn(
          "absolute top-0 z-10",
          openLeft ? "right-full pr-1" : "left-full pl-1"
        )}
      >
        <div
          data-testid="add-submenu-agent"
          className="w-52 rounded-2xl border border-[#363636] bg-[#1a1a1a] p-1.5 shadow-2xl"
        >
          {agents.map((item) => renderItem(item))}
        </div>
      </div>
    );
  };

  const skillFlyout = () => {
    if (open !== "skill" || searching) return null;
    return (
      <div
        className={cn(
          "absolute top-0 z-10",
          openLeft ? "right-full pr-1" : "left-full pl-1"
        )}
      >
        <div
          data-testid="add-submenu-skill"
          className="max-h-80 w-56 overflow-y-auto rounded-2xl border border-[#363636] bg-[#1a1a1a] p-1.5 shadow-2xl"
        >
          {skillsLoading ? (
            <p className="px-2 py-3 text-[12px] text-zinc-500">加载中…</p>
          ) : skillsError ? (
            <p className="px-2 py-3 text-[12px] text-zinc-500">{skillsError}</p>
          ) : skills.length === 0 ? (
            <p className="px-2 py-3 text-[12px] text-zinc-500">还没有 Skill</p>
          ) : (
            skills.map((item) => {
              const title = (item.title || item.name || "Skill").trim();
              const version = item.version?.trim();
              return (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`add-skill-item-${item.id}`}
                  onClick={() => pickSkill(item)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] text-zinc-200 hover:bg-white/6"
                >
                  <Wand2 className="size-3.5 shrink-0 text-zinc-400" />
                  <span className="min-w-0 flex-1 truncate">{title}</span>
                  {version ? (
                    <span className="shrink-0 text-[11px] text-zinc-500">
                      {version}
                    </span>
                  ) : null}
                </button>
              );
            })
          )}
          {onOpenSkillLibrary ? (
            <>
              <div className="my-1 h-px bg-white/8" />
              <button
                type="button"
                data-testid="add-open-skill-library"
                onClick={() => onOpenSkillLibrary()}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[12px] text-zinc-400 hover:bg-white/6 hover:text-zinc-200"
              >
                <span className="min-w-0 flex-1">浏览 Skill 库…</span>
              </button>
            </>
          ) : null}
        </div>
      </div>
    );
  };

  const assetFlyout = () => {
    if (open !== "asset" || searching) return null;
    return (
      <div
        className={cn(
          "absolute top-0 z-10",
          openLeft ? "right-full pr-1" : "left-full pl-1"
        )}
      >
        <div
          data-testid="add-submenu-asset"
          className="w-52 rounded-2xl border border-[#363636] bg-[#1a1a1a] p-1.5 shadow-2xl"
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
              onPointerEnter={() => setAssetStep("local")}
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
                className={cn(
                  "absolute top-0 z-10",
                  openLeft ? "right-full pr-1" : "left-full pl-1"
                )}
              >
                <div
                  data-testid="add-submenu-asset-kinds"
                  className="w-52 rounded-2xl border border-[#363636] bg-[#1a1a1a] p-1.5 shadow-2xl"
                >
                  {assets.map((item) => renderItem(item))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  const closeBranch = (branch: Branch) => {
    setOpen((cur) => (cur === branch ? null : cur));
  };

  const branchButton = (branch: Branch, label: string, icon?: typeof Wand2) => {
    const Icon = icon;
    return (
      <button
        type="button"
        data-testid={`add-branch-${branch}`}
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
        {Icon ? <Icon className="size-3.5 shrink-0 text-zinc-400" /> : null}
        <span className="min-w-0 flex-1">{label}</span>
        <ChevronRight className="size-3.5 text-zinc-500" />
      </button>
    );
  };

  const searchDualPath = () => {
    if (!searchAssetChoice) return null;
    const Icon = ICONS[searchAssetChoice.id] ?? FileText;
    return (
      <div
        data-testid="add-search-asset-dual-path"
        className="flex flex-col gap-0.5"
      >
        <button
          type="button"
          onClick={() => setSearchAssetChoice(null)}
          className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[12px] text-zinc-400 hover:bg-white/6 hover:text-zinc-200"
        >
          <span className="min-w-0 flex-1">← {searchAssetChoice.label}</span>
        </button>
        <div className="mb-0.5 flex items-center gap-2 px-2 py-1 text-[11px] text-zinc-500">
          <Icon className="size-3 shrink-0" />
          选择导入方式
        </div>
        <button
          type="button"
          data-testid="import-from-library"
          onClick={() => onOpenLibrary?.()}
          className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] text-zinc-200 hover:bg-white/6"
        >
          <FolderOpen className="size-3.5 shrink-0 text-zinc-400" />
          <span className="min-w-0 flex-1">从资产库</span>
        </button>
        <button
          type="button"
          data-testid="import-from-local"
          onClick={() => pick(searchAssetChoice)}
          className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] text-zinc-200 hover:bg-white/6"
        >
          <Upload className="size-3.5 shrink-0 text-zinc-400" />
          <span className="min-w-0 flex-1">从本地上传</span>
        </button>
      </div>
    );
  };

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
          setSearchAssetChoice(null);
        }}
        placeholder="搜索"
        className="mb-1 w-full rounded-lg bg-black/30 px-2 py-1.5 text-[12px] text-zinc-200 outline-none placeholder:text-zinc-600"
      />
      {searching ? (
        <div className="max-h-80 overflow-y-auto">
          {searchAssetChoice ? (
            searchDualPath()
          ) : items.length ? (
            items.map((item) => renderItem(item, pickFromSearch))
          ) : (
            <p className="px-2 py-3 text-[12px] text-zinc-500">没有匹配的类型</p>
          )}
        </div>
      ) : (
        <div className="relative">
          <div
            className="relative"
            onPointerEnter={() => openBranch("asset")}
            onPointerLeave={() => closeBranch("asset")}
          >
            {branchButton("asset", "导入资产")}
            {assetFlyout()}
          </div>
          <div
            className="relative"
            onPointerEnter={() => openBranch("agent")}
            onPointerLeave={() => closeBranch("agent")}
          >
            {branchButton("agent", "添加智能体")}
            {agentFlyout()}
          </div>
          <div
            className="relative"
            onPointerEnter={() => openBranch("skill")}
            onPointerLeave={() => closeBranch("skill")}
          >
            {branchButton("skill", "Skill", Wand2)}
            {skillFlyout()}
          </div>
          <div
            className="my-1 h-px bg-white/8"
            onPointerEnter={() => setOpen(null)}
          />
          <div onPointerEnter={() => setOpen(null)}>
            {resources.map((item) => renderItem(item))}
          </div>
        </div>
      )}
    </div>
  );
}
