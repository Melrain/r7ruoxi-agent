"use client";

import {
  Handle,
  useNodeConnections,
  type HandleProps,
} from "@xyflow/react";
import { cn } from "@/lib/utils";

type LitHandleProps = HandleProps & {
  /** Extra class when this handle has ≥1 edge. */
  connectedClassName?: string;
  /**
   * When true, edges that omit sourceHandle/targetHandle also count as
   * connected to this port (legacy / auto product edges).
   */
  primaryForNull?: boolean;
};

/**
 * xyflow Handle that adds `is-connected` when linked, so idle ports stay quiet
 * (no glow) while connected / hover / connecting can light up via CSS.
 */
export function LitHandle({
  className,
  connectedClassName = "is-connected",
  id,
  type,
  primaryForNull = false,
  ...rest
}: LitHandleProps) {
  const connections = useNodeConnections({ handleType: type });
  const hid = id != null ? String(id) : null;
  const connected = connections.some((c) => {
    const h = type === "source" ? c.sourceHandle : c.targetHandle;
    if (h == null) return primaryForNull;
    return h === hid;
  });

  return (
    <Handle
      id={id}
      type={type}
      className={cn(className, connected && connectedClassName)}
      {...rest}
    />
  );
}
