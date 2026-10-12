"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  AlertCircle,
  CheckCircle2,
  XCircle,
  GitBranch,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NODE_COLORS, NODE_META, summarizeStep } from "./shared";
import type { Step } from "@/lib/automations/types";

type NodeData = { step: Step; index: number; hasError: boolean; key: string };

function AutomationNodeImpl(props: NodeProps) {
  const { data, selected } = props as unknown as NodeProps & { data: NodeData };
  const step = data.step;
  const hasError = data.hasError;
  const meta = NODE_META[step.type];
  const Icon = meta.icon;
  const c = NODE_COLORS[step.type];

  const isBrancher = step.type === "branch" || step.type === "condition";
  const branchLabel = step.type === "condition" ? "yes/no" : "then/else";

  return (
    <div
      style={
        {
          "--nc": c.solid,
          "--nc-soft": c.soft,
          "--nc-ring": c.ring,
          "--nc-text": c.text,
          borderColor: selected ? c.solid : hasError ? "#dc2626" : undefined,
        } as React.CSSProperties
      }
      className={cn(
        "bg-card relative max-w-[260px] min-w-[220px] rounded-xl border px-3 py-2.5 text-left shadow-[0_2px_6px_rgba(0,0,0,0.18)] transition-[box-shadow,border-color]",
        selected
          ? "border-[var(--nc)] shadow-[0_0_0_1px_var(--nc),0_14px_36px_-12px_var(--nc-ring)]"
          : hasError
            ? "border-red-500"
            : "border-border hover:border-[var(--nc-ring)]",
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !rounded-full !border-2 !border-[var(--nc-ring)] !bg-card"
      />

      <div className="flex items-center gap-2">
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
          style={{ background: c.soft, color: c.text }}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium" style={{ color: c.text }}>
            {meta.label}
          </div>
          <div className="truncate text-[11px] text-muted-foreground">
            {summarizeStep(step)}
          </div>
        </div>
        {hasError && <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />}
      </div>

      {isBrancher && (
        <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-green-600" />
            {branchLabel.split("/")[0]}
          </span>
          <span className="flex items-center gap-1">
            <XCircle className="h-3 w-3 text-red-500" />
            {branchLabel.split("/")[1]}
          </span>
        </div>
      )}

      {isBrancher ? (
        <>
          <Handle
            id="yes"
            type="source"
            position={Position.Right}
            style={{ top: "30%", background: "#16a34a" }}
            className="!h-2.5 !w-2.5 !rounded-full !border-2 !border-white"
          />
          <Handle
            id="no"
            type="source"
            position={Position.Right}
            style={{ top: "70%", background: "#dc2626" }}
            className="!h-2.5 !w-2.5 !rounded-full !border-2 !border-white"
          />
        </>
      ) : (
        <Handle
          type="source"
          position={Position.Right}
          className="!h-2.5 !w-2.5 !rounded-full !border-2 !border-[var(--nc-ring)] !bg-card"
        />
      )}

      {step.type === "branch" && (
        <GitBranch className="absolute -right-3 -top-3 h-5 w-5 rounded-full bg-white p-0.5 text-teal-600 shadow" />
      )}
    </div>
  );
}

export const AutomationNode = memo(AutomationNodeImpl);
