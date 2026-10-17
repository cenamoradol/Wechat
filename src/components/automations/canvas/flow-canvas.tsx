"use client";

/**
 * Automation canvas — N8N-style visual editor.
 *
 * Adapted from wacrm's flow-canvas, but simpler: wechat stores steps
 * as a JSON array (not a relational graph), so the canvas derives
 * nodes+edges from that array on every render. No need for
 * next_node_key; branches/conditions are nested children.
 *
 * What this does:
 *   - Renders every step as a draggable card with pan + zoom + minimap
 *   - Connects them with bezier edges (linear) and branch edges
 *     (yes/no, then/else) with labels
 *   - Click a node → side panel opens with config form
 *   - Backspace / Delete on a selected node → removes it
 *   - "+ Add step" floating menu drops a new step at the visible
 *     viewport center
 *
 * Two-way binding: the canvas reads `steps` from props and bubbles
 * mutations up via `onChange`. The parent (automation-editor.tsx)
 * owns the source of truth; this view never persists directly.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge as RfEdge,
  type Node as RfNode,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import type { Step } from "@/lib/automations/types";
import { defaultStepFor } from "@/components/automations/step-form";
import { AutomationNode } from "./automation-node";
import {
  NODE_CATEGORIES,
  NODE_META,
  categoryOf,
  type AutomationNodeType,
} from "./shared";
import { applyGraphMutation, buildRfGraph, flattenSteps } from "./edges";
import { NodeConfigForm } from "./node-config-form";
import { validateStepsForActivation } from "@/lib/automations/validate";
import { saveCanvasPositionsAction } from "@/app/(workspace)/automations/actions";

const NODE_TYPES: AutomationNodeType[] = [
  "send_text",
  "send_template",
  "webhook",
  "send_images",
  "add_tag",
  "remove_tag",
  "set_field",
  "wait",
  "assign_to",
  "set_status",
  "close_conversation",
  "branch",
  "condition",
  "ai_reply",
  "ai_extract",
  "llm_draft_message",
];

const nodeTypes = { automation: AutomationNode };

type Props = {
  steps: Step[];
  onChange: (steps: Step[]) => void;
  options: {
    tags: Array<{ id: string; name: string; color: string }>;
    templates: Array<{ id: string; name: string; language: string }>;
    members: Array<{ id: string; full_name: string | null; email: string }>;
    customFields: Array<{ id: string; name: string; type: string }>;
    aiAgents: Array<{ id: string; name: string; provider: string; model: string }>;
  };
  /** When set, the canvas persists position changes to this row. */
  automationId?: string;
  /** Server-saved positions; applied as initial layout. */
  initialPositions?: Record<string, { x: number; y: number }> | null;
};

export function AutomationCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <AutomationCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function AutomationCanvasInner({
  steps,
  onChange,
  options,
  automationId,
  initialPositions,
}: Props) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  // ponytail: recompute the graph on every render. Cheap — N is in
  // the dozens for any reasonable automation, and the layout is
  // deterministic so node positions are stable.
  const invalidKeys = useMemo(() => {
    const issues = validateStepsForActivation(steps);
    if (issues.length === 0) return new Set<string>();
    const flat = flattenSteps(steps);
    const pathToStableId = new Map<string, string>();
    for (const f of flat) {
      const dot = "steps" + f.path.map((i) => `[${i}]`).join(".");
      pathToStableId.set(dot, f.stableId);
    }
    const out = new Set<string>();
    for (const issue of issues) {
      const m = issue.path.match(/^((?:steps\[\d+\])(?:\.(?:then|else|yes|no)\.steps\[\d+\])*)/);
      if (!m) continue;
      const sid = pathToStableId.get(m[1]);
      if (sid) out.add(sid);
    }
    return out;
  }, [steps]);

  const { nodes: rfNodes, edges: rfEdges } = useMemo(
    () => buildRfGraph(steps, invalidKeys, initialPositions ?? null),
    [steps, invalidKeys, initialPositions],
  );

  const selectedStep = useMemo(() => {
    if (!selectedKey) return null;
    const flat = flattenSteps(steps);
    const target = flat.find((f) => f.stableId === selectedKey);
    return target?.step ?? null;
  }, [selectedKey, steps]);

  // ponytail: collect the latest known position for every node so we
  // can persist on dragStop. We update this on every position change
  // and only push to the server on the final drag (changes with
  // `dragging: false`).
  const livePositionsRef = useRef<Record<string, { x: number; y: number }>>(
    initialPositions ?? {},
  );
  useEffect(() => {
    livePositionsRef.current = initialPositions ?? {};
  }, [initialPositions]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      let positionChanged = false;
      const next = { ...livePositionsRef.current };
      for (const c of changes) {
        if (c.type === "remove") {
          const updated = applyGraphMutation(steps, { kind: "remove", stableId: c.id });
          onChange(updated);
          if (selectedKey === c.id) setSelectedKey(null);
          continue;
        }
        if (c.type === "position" && c.position) {
          next[c.id] = { x: c.position.x, y: c.position.y };
          livePositionsRef.current = next;
          // ponytail: only persist on dragStop (dragging === false).
          // RF fires position changes continuously during drag; we
          // batch by only saving when the drag ends.
          if ("dragging" in c && c.dragging === false) {
            positionChanged = true;
          }
        }
      }
      if (positionChanged && automationId) {
        // ponytail: fire-and-forget. The user keeps dragging; we
        // don't await. A failure here means the next reload uses
        // the deterministic layout — not data loss because the
        // server keeps the old canvas_positions intact.
        void saveCanvasPositionsAction(automationId, livePositionsRef.current).catch(
          (e) => console.error("[canvas] persist positions failed", e),
        );
      }
    },
    [steps, onChange, selectedKey, automationId],
  );

  const addStep = useCallback(
    (type: AutomationNodeType) => {
      const bounds = containerRef.current?.getBoundingClientRect();
      const pos = bounds
        ? screenToFlowPosition({ x: bounds.width / 2, y: bounds.height / 2 })
        : { x: 0, y: 0 };
      void pos; // positions aren't persisted in v1
      const step = defaultStepFor(type);
      onChange(applyGraphMutation(steps, { kind: "append", step }));
      toast.success(`Step "${NODE_META[type].label}" añadido`);
    },
    [steps, onChange, screenToFlowPosition],
  );

  const updateStep = useCallback(
    (stableId: string, step: Step) => {
      onChange(applyGraphMutation(steps, { kind: "update", stableId, step }));
    },
    [steps, onChange],
  );

  const handleSelectionChange = useCallback(
    ({ nodes }: { nodes: RfNode[]; edges: RfEdge[] }) => {
      setSelectedKey(nodes[0]?.id ?? null);
    },
    [],
  );

  // ponytail: keyboard delete on the canvas. React Flow's onNodesDelete
  // fires after our onNodesChange handles it; this is the safety net for
  // when only the React Flow internal selection is set.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!selectedKey) return;
      if (e.key !== "Backspace" && e.key !== "Delete") return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      e.preventDefault();
      onChange(applyGraphMutation(steps, { kind: "remove", stableId: selectedKey }));
      setSelectedKey(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedKey, steps, onChange]);

  return (
    <div ref={containerRef} className="relative h-[600px] w-full overflow-hidden rounded-lg border bg-background">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onSelectionChange={handleSelectionChange}
        fitView
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ animated: false, style: { stroke: "#94a3b8", strokeWidth: 1.5 } }}
        deleteKeyCode={null}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls position="bottom-left" />
        <MiniMap
          position="bottom-right"
          pannable
          zoomable
          nodeColor={(n) => {
            const step = (n.data as { step?: Step })?.step;
            if (!step) return "#94a3b8";
            // ponytail: dynamic import would be circular; use the same color map directly.
            const colors: Record<string, string> = {
              send_text: "#F59E0B",
              send_template: "#14B8A6",
              add_tag: "#22C55E",
              remove_tag: "#F8B22B",
              set_field: "#5EA6F7",
              wait: "#A8A29E",
              assign_to: "#38BDF8",
              set_status: "#A8A29E",
              close_conversation: "#78716C",
              webhook: "#F59E0B",
              ai_reply: "#EC4899",
              ai_extract: "#EC4899",
              branch: "#14B8A6",
              llm_draft_message: "#EC4899",
              send_images: "#F246B7",
              condition: "#22C55E",
            };
            return colors[step.type] ?? "#94a3b8";
          }}
        />
        <Panel position="top-right">
          <AddStepMenu onAdd={addStep} />
        </Panel>
      </ReactFlow>

      {selectedStep && selectedKey && (
        <div className="absolute right-0 top-0 z-10 flex h-full w-full max-w-sm flex-col border-l bg-card shadow-xl">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold">{NODE_META[selectedStep.type].label}</h3>
              <p className="text-xs text-muted-foreground">{NODE_META[selectedStep.type].blurb}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setSelectedKey(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <NodeConfigForm
              step={selectedStep}
              onChange={(s) => updateStep(selectedKey, s)}
              options={options}
            />
          </div>
          <div className="border-t p-3">
            <Button
              variant="outline"
              className="w-full text-destructive"
              onClick={() => {
                onChange(applyGraphMutation(steps, { kind: "remove", stableId: selectedKey }));
                setSelectedKey(null);
              }}
            >
              <X className="h-4 w-4" />
              Eliminar step
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddStepMenu({ onAdd }: { onAdd: (t: AutomationNodeType) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          Añadir step
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {NODE_CATEGORIES.map((cat) => {
          const types = NODE_TYPES.filter((t) => categoryOf(t) === cat.id);
          if (types.length === 0) return null;
          return (
            <DropdownMenuGroup key={cat.id}>
              <DropdownMenuLabel>{cat.label}</DropdownMenuLabel>
              {types.map((t) => {
                const meta = NODE_META[t];
                const Icon = meta.icon;
                return (
                  <DropdownMenuItem
                    key={t}
                    onClick={() => onAdd(t)}
                  >
                    <Icon className="h-4 w-4" />
                    {meta.label}
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator />
            </DropdownMenuGroup>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Re-export so tests / consumers can use the graph builder without
// pulling in React Flow internals.
export { buildRfGraph } from "./edges";
