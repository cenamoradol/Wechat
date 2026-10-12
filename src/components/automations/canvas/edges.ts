"use client";

/**
 * Maps the wechat JSON step model (`Step[]`) to React Flow's
 * `nodes` + `edges` model and back. Simpler than wacrm's because
 * we don't have a separate `next_node_key` field — branches and
 * conditions nest their sub-steps directly.
 *
 * Linear sequence: step[i] → step[i+1] (one edge)
 * `branch` step:   parent → first child of `then`; first child of `then` → next sibling; etc.
 *                  parent → first child of `else` (if present)
 * `condition` step: parent → first child of `yes`; parent → first child of `no`
 */

import type { Edge as RfEdge, Node as RfNode } from "@xyflow/react";
import type { Step } from "@/lib/automations/types";
import type { AutomationNodeData, AutomationNodeType } from "./shared";

export type AutomationRfNode = RfNode<AutomationNodeData & { step: Step; key: string }>;

const NODE_WIDTH = 240;
const NODE_HEIGHT = 100;
const ROW_GAP_Y = 50;
const COL_GAP_X = 280;
const BRANCH_GAP_X = 60;
const CHILD_GAP_X = 80;

type Flat = {
  step: Step;
  /** Ephemeral React-Flow key (regenerated per render). */
  key: string;
  /** Stable id derived from the step's path; survives reloads. */
  stableId: string;
  path: number[];
  /** Index within the parent branch/condition sub-array, if any. */
  childIndex: number | null;
  parentKey: string | null;
  branch: "then" | "else" | "yes" | "no" | null;
};

let keyCounter = 0;
function nextKey(prefix: string): string {
  keyCounter += 1;
  return `${prefix}_${keyCounter}`;
}

/**
 * ponytail: stable id derived from a step's position in the tree.
 * Used as the key in the canvas_positions map so user-dragged
 * positions survive reloads. Path-based: "0.2.1" = top-level step
 * 3, inside its `then` slot, second child. Adding/removing a step
 * invalidates keys for steps below it — same fragility as
 * spreadsheet row indices, acceptable for v1.
 */
export function stableIdFromPath(path: number[]): string {
  return path.join(".");
}

export function flattenSteps(steps: Step[]): Flat[] {
  keyCounter = 0;
  const out: Flat[] = [];
  walk(steps, [], null, null, out);
  return out;
}

function walk(
  steps: Step[],
  parentPath: number[],
  parentKey: string | null,
  branch: Flat["branch"],
  out: Flat[],
): void {
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const key = nextKey(step.type);
    // ponytail: the stableId is a path of indices, one per nesting
    // level. Top-level: [i]. Child of branch.then[0]: [parentI, 0].
    // We rebuild the path on each recursion to make stableIds
    // uniquely identify their node, and keep `parentPath` for the
    // parent's own identifier (separate from this child's path).
    const childPath = parentKey === null ? [i] : [...parentPath, i];
    out.push({
      step,
      key,
      stableId: stableIdFromPath(childPath),
      path: childPath,
      childIndex: parentKey === null ? null : i,
      parentKey,
      branch,
    });
    if (step.type === "branch") {
      walk(step.then, childPath, key, "then", out);
      if (step.else) walk(step.else, childPath, key, "else", out);
    } else if (step.type === "condition") {
      walk(step.yes, childPath, key, "yes", out);
      walk(step.no, childPath, key, "no", out);
    }
  }
}

type LayoutNode = { key: string; step: Step; x: number; y: number; parent: string | null; branch: Flat["branch"] };

export function buildRfGraph(
  steps: Step[],
  invalidKeys: Set<string> = new Set(),
  savedPositions: Record<string, { x: number; y: number }> | null = null,
): { nodes: AutomationRfNode[]; edges: RfEdge[]; stableIdMap: Map<string, string> } {
  const flat = flattenSteps(steps);
  if (flat.length === 0) return { nodes: [], edges: [], stableIdMap: new Map() };

  const layout = layoutTree(flat);
  const stableIdMap = new Map<string, string>();
  for (const f of flat) stableIdMap.set(f.stableId, f.key);

  const nodes: AutomationRfNode[] = layout.map((n) => {
    const flatEntry = flat.find((f) => f.key === n.key);
    const stableId = flatEntry?.stableId ?? "";
    const saved = savedPositions?.[stableId];
    return {
      id: stableId,
      type: "automation",
      position: saved ? { x: saved.x, y: saved.y } : { x: n.x, y: n.y },
      data: {
        step: n.step,
        index: flat.findIndex((f) => f.key === n.key),
        hasError: invalidKeys.has(stableId),
        key: n.key,
        stableId,
      },
    };
  });

  const edges: RfEdge[] = [];
  for (let i = 0; i < flat.length; i++) {
    const f = flat[i];
    if (f.parentKey) {
      const parentFlat = flat.find((x) => x.key === f.parentKey);
      if (!parentFlat) continue;
      edges.push({
        id: `${parentFlat.stableId}->${f.stableId}`,
        source: parentFlat.stableId,
        target: f.stableId,
        label: f.branch === "then" || f.branch === "yes" ? "✓" : f.branch === "else" || f.branch === "no" ? "✗" : undefined,
        style: {
          stroke:
            f.branch === "then" || f.branch === "yes"
              ? "#16a34a"
              : f.branch === "else" || f.branch === "no"
                ? "#dc2626"
                : "#94a3b8",
        },
        labelStyle: { fontSize: 11, fontWeight: 600 },
        labelBgPadding: [4, 2] as [number, number],
      });
      continue;
    }
    // Linear sequence: connect to next top-level sibling.
    if (f.path.length === 1) {
      const next = flat[i + 1];
      if (next && next.path.length === 1 && next.parentKey === null) {
        edges.push({
          id: `${f.stableId}->${next.stableId}`,
          source: f.stableId,
          target: next.stableId,
        });
      }
    }
  }

  return { nodes, edges, stableIdMap };
}

function layoutTree(flat: Flat[]): LayoutNode[] {
  const out: LayoutNode[] = [];
  let x = 0;
  let y = 0;
  // Group by top-level index for linear stacking.
  const topLevel = flat.filter((f) => f.parentKey === null);
  for (const f of topLevel) {
    if (f.step.type === "branch") {
      const thenChildren = flat.filter((c) => c.parentKey === f.key && c.branch === "then");
      const elseChildren = flat.filter((c) => c.parentKey === f.key && c.branch === "else");
      const heightThen = layoutChildren(thenChildren, flat, x + COL_GAP_X, y + ROW_GAP_Y, "then", out);
      const heightElse = layoutChildren(elseChildren, flat, x + COL_GAP_X + 220, y + ROW_GAP_Y, "else", out);
      out.push({ key: f.key, step: f.step, x, y, parent: null, branch: null });
      // push y past the deeper of the two branches (max depth in branch)
      const depth = Math.max(heightThen, heightElse);
      y += NODE_HEIGHT + ROW_GAP_Y + depth;
    } else if (f.step.type === "condition") {
      const yesChildren = flat.filter((c) => c.parentKey === f.key && c.branch === "yes");
      const noChildren = flat.filter((c) => c.parentKey === f.key && c.branch === "no");
      const heightYes = layoutChildren(yesChildren, flat, x + COL_GAP_X, y + ROW_GAP_Y, "yes", out);
      const heightNo = layoutChildren(noChildren, flat, x + COL_GAP_X + 220, y + ROW_GAP_Y, "no", out);
      out.push({ key: f.key, step: f.step, x, y, parent: null, branch: null });
      const depth = Math.max(heightYes, heightNo);
      y += NODE_HEIGHT + ROW_GAP_Y + depth;
    } else {
      out.push({ key: f.key, step: f.step, x, y, parent: null, branch: null });
      y += NODE_HEIGHT + ROW_GAP_Y;
    }
  }
  return out;
}

function layoutChildren(
  children: Flat[],
  all: Flat[],
  startX: number,
  startY: number,
  branch: Flat["branch"],
  out: LayoutNode[],
): number {
  if (children.length === 0) return 0;
  let cursorY = startY;
  let totalHeight = 0;
  for (const c of children) {
    if (c.step.type === "branch" || c.step.type === "condition") {
      // recurse one level
      const grandchildren = all.filter((g) => g.parentKey === c.key);
      out.push({ key: c.key, step: c.step, x: startX, y: cursorY, parent: null, branch });
      const thenG = grandchildren.filter((g) => g.branch === (branch === "then" || branch === "yes" ? "then" : "then"));
      // ponytail: nested branches aren't a v1 concern; render children linearly below.
      const sub = all.filter((g) => g.parentKey === c.key);
      const subHeight = layoutChildren(sub, all, startX + CHILD_GAP_X, cursorY + NODE_HEIGHT + ROW_GAP_Y, branch, out);
      cursorY += NODE_HEIGHT + ROW_GAP_Y + subHeight;
      totalHeight += NODE_HEIGHT + ROW_GAP_Y + subHeight;
    } else {
      out.push({ key: c.key, step: c.step, x: startX, y: cursorY, parent: null, branch });
      cursorY += NODE_HEIGHT + ROW_GAP_Y;
      totalHeight += NODE_HEIGHT + ROW_GAP_Y;
    }
  }
  return totalHeight;
}

/**
 * Reconstruct `Step[]` from a mutated graph. We need this when the
 * canvas reorders or removes a node. For v1 the canvas only allows
 * append, remove, and config edit (not reorder) — so we rebuild
 * from the flat list preserving the original tree shape.
 */
export function applyGraphMutation(
  steps: Step[],
  mutation:
    | { kind: "remove"; stableId: string }
    | { kind: "append"; step: Step }
    | { kind: "update"; stableId: string; step: Step },
): Step[] {
  if (mutation.kind === "append") {
    return [...steps, mutation.step];
  }
  // ponytail: callers pass the React-Flow node id, which is the
  // stableId (we use stableId as the node id so saved positions
  // re-apply on reload). Look the step up by stableId, then walk
  // the tree to patch it.
  const flat = flattenSteps(steps);
  const target = flat.find((f) => f.stableId === mutation.stableId);
  if (!target) return steps;
  if (target.parentKey === null) {
    if (mutation.kind === "update") {
      return steps.map((s, i) => (i === target.path[0] ? mutation.step : s));
    }
    return steps.filter((_, i) => i !== target.path[0]);
  }
  return patchByParentKey(steps, target.parentKey, target.branch!, target.childIndex!, target.step, mutation);
}

/**
 * Find the parent step in the tree (by reference equality with the
 * flat-list entry) and patch its child array.
 */
function patchByParentKey(
  steps: Step[],
  parentKey: string,
  branch: "then" | "else" | "yes" | "no",
  idx: number,
  targetStep: Step,
  mutation:
    | { kind: "remove"; stableId: string }
    | { kind: "update"; stableId: string; step: Step },
): Step[] {
  const flat = flattenSteps(steps);
  const parentFlat = flat.find((f) => f.key === parentKey);
  if (!parentFlat) return steps;
  const parentStep = parentFlat.step;
  function walk(s: Step): Step {
    if (s === parentStep) {
      if (s.type === "branch") {
        return {
          ...s,
          then: branch === "then" ? patchArr(s.then) : s.then,
          else: branch === "else" ? (s.else ? patchArr(s.else) : undefined) : s.else,
        };
      }
      if (s.type === "condition") {
        return {
          ...s,
          yes: branch === "yes" ? patchArr(s.yes) : s.yes,
          no: branch === "no" ? patchArr(s.no) : s.no,
        };
      }
    }
    if (s.type === "branch") {
      return {
        ...s,
        then: s.then.map(walk),
        else: s.else?.map(walk),
      };
    }
    if (s.type === "condition") {
      return {
        ...s,
        yes: s.yes.map(walk),
        no: s.no.map(walk),
      };
    }
    return s;
  }

  function patchArr(arr: Step[]): Step[] {
    const out: Step[] = [];
    for (let j = 0; j < arr.length; j++) {
      if (j === idx && arr[j] === targetStep) {
        if (mutation.kind === "update") out.push(mutation.step);
        // remove: skip
      } else {
        out.push(arr[j]);
      }
    }
    return out;
  }

  return steps.map(walk);
}
