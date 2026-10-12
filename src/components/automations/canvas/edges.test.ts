import { describe, expect, it } from "vitest";
import { applyGraphMutation, flattenSteps, stableIdFromPath } from "@/components/automations/canvas/edges";
import type { Step } from "@/lib/automations/types";

describe("canvas — flattenSteps + applyGraphMutation", () => {
  it("flattens a branch with then and else sub-lists", () => {
    const steps: Step[] = [
      { type: "send_text", text: "a" },
      {
        type: "branch",
        if: { field: "channel", operator: "is", value: "whatsapp" },
        then: [
          { type: "send_text", text: "b" },
          { type: "add_tag", tagId: "x" },
        ],
        else: [{ type: "webhook", url: "https://example.com", method: "POST" }],
      },
      { type: "send_text", text: "c" },
    ];
    const flat = flattenSteps(steps);
    expect(flat).toHaveLength(6);
    expect(flat.filter((f) => f.branch === "then")).toHaveLength(2);
    expect(flat.filter((f) => f.branch === "else")).toHaveLength(1);
  });

  it("flattens a condition with yes and no sub-lists", () => {
    const steps: Step[] = [
      {
        type: "condition",
        subject: "vars_value",
        operand: "vars.response",
        yes: [{ type: "send_text", text: "y" }],
        no: [{ type: "send_text", text: "n" }],
      },
    ];
    const flat = flattenSteps(steps);
    expect(flat).toHaveLength(3);
    expect(flat[0].branch).toBeNull();
    expect(flat[1].branch).toBe("yes");
    expect(flat[2].branch).toBe("no");
  });

  it("emits stableIds from the step path", () => {
    const steps: Step[] = [
      { type: "send_text", text: "a" },
      {
        type: "branch",
        if: { field: "channel", operator: "is", value: "whatsapp" },
        then: [{ type: "send_text", text: "b" }],
      },
    ];
    const flat = flattenSteps(steps);
    // ponytail: branch children get a 0 suffix because walk recurses
    // with [...currentPath, 0] (the parent's own step is the 0
    // index in the recursive call). The stableId is path.join(".").
    expect(flat[0].stableId).toBe(stableIdFromPath([0]));
    expect(flat[1].stableId).toBe(stableIdFromPath([1]));
    expect(flat[2].stableId).toBe(stableIdFromPath([1, 0]));
  });

  it("appends to the top level", () => {
    const steps: Step[] = [{ type: "send_text", text: "a" }];
    const out = applyGraphMutation(steps, { kind: "append", step: { type: "send_text", text: "b" } });
    expect(out).toHaveLength(2);
  });

  it("removes a top-level step by stableId", () => {
    const steps: Step[] = [
      { type: "send_text", text: "a" },
      { type: "send_text", text: "b" },
      { type: "send_text", text: "c" },
    ];
    const flat = flattenSteps(steps);
    const target = flat[1];
    const out = applyGraphMutation(steps, { kind: "remove", stableId: target.stableId });
    expect(out).toHaveLength(2);
    expect((out[0] as { text: string }).text).toBe("a");
    expect((out[1] as { text: string }).text).toBe("c");
  });

  it("removes a step from branch.then sub-list by stableId", () => {
    const branch: Step = {
      type: "branch",
      if: { field: "channel", operator: "is", value: "whatsapp" },
      then: [
        { type: "send_text", text: "b" },
        { type: "add_tag", tagId: "x" },
      ],
    };
    const steps: Step[] = [{ type: "send_text", text: "a" }, branch];
    const flat = flattenSteps(steps);
    const target = flat.find(
      (f) => f.parentKey !== null && f.step.type === "add_tag",
    );
    expect(target).toBeDefined();
    const out = applyGraphMutation(steps, { kind: "remove", stableId: target!.stableId });
    expect(out).toHaveLength(2);
    const updatedBranch = out[1] as Extract<Step, { type: "branch" }>;
    expect(updatedBranch.then).toHaveLength(1);
    expect((updatedBranch.then[0] as { text: string }).text).toBe("b");
  });

  it("updates a step in place by stableId", () => {
    const steps: Step[] = [{ type: "send_text", text: "old" }];
    const flat = flattenSteps(steps);
    const out = applyGraphMutation(steps, {
      kind: "update",
      stableId: flat[0].stableId,
      step: { type: "send_text", text: "new" },
    });
    expect((out[0] as { text: string }).text).toBe("new");
  });
});
