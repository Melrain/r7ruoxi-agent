import { createElement } from "react";
import type { NodeProps, NodeTypes } from "@xyflow/react";
import { AgentNode } from "@/components/film/canvas/nodes/AgentNode";
import { AssetIconNode } from "@/components/film/canvas/nodes/AssetIconNode";
import { BreakdownAssetNode } from "@/components/film/canvas/nodes/BreakdownAssetNode";
import {
  isTextAssetCardData,
  TextAssetCardNode,
} from "@/components/film/canvas/nodes/TextAssetCardNode";
import { ScriptAssetNode } from "@/components/film/canvas/nodes/ScriptAssetNode";
import { ScriptNode } from "@/components/film/canvas/nodes/ScriptNode";
import { TextNode } from "@/components/film/canvas/nodes/TextNode";
import { isBreakdownAssetData } from "@/components/film/canvas/lib/breakdown-script-rows";
import type { AppNode } from "@/components/film/canvas/types/project";

/** text: 拆解镜号卡 / 文字资产便签 / 普通图标卡 */
function TextAssetRouter(props: NodeProps<AppNode>) {
  if (isTextAssetCardData(props.data)) {
    return createElement(TextAssetCardNode, props);
  }
  if (isBreakdownAssetData(props.data)) {
    return createElement(BreakdownAssetNode, props);
  }
  return createElement(AssetIconNode, props);
}

function CharacterOrSceneRouter(props: NodeProps<AppNode>) {
  if (isTextAssetCardData(props.data) || props.data.textAssetCard) {
    return createElement(TextAssetCardNode, props);
  }
  // Seed / 旧节点仍用 TextNode；silent continuum 会打 textAssetCard
  return createElement(TextNode, props);
}

export const nodeTypes = {
  text: TextAssetRouter,
  image: AssetIconNode,
  video: AssetIconNode,
  audio: AssetIconNode,
  file: AssetIconNode,
  script: ScriptAssetNode,
  storyboard: ScriptNode,
  scene: CharacterOrSceneRouter,
  character: CharacterOrSceneRouter,
  agent: AgentNode,
} satisfies NodeTypes;
