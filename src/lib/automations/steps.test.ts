import { describe, expect, it } from "vitest";
import {
  extractFirstJsonObject,
  recoverFieldsFromMarkdown,
  coerceExtractField,
} from "@/lib/automations/steps";

describe("extractFirstJsonObject", () => {
  it("returns pure JSON untouched", () => {
    expect(extractFirstJsonObject('{"a":1,"b":"x"}')).toBe('{"a":1,"b":"x"}');
  });

  it("strips ```json fences", () => {
    expect(extractFirstJsonObject('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("strips plain ``` fences", () => {
    expect(extractFirstJsonObject('```\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("drops a one-line preamble", () => {
    expect(extractFirstJsonObject('Here you go:\n{"a":1,"b":2}')).toBe('{"a":1,"b":2}');
  });

  it("handles nested objects correctly", () => {
    const text = '{"a":{"b":{"c":1}},"d":2}';
    expect(extractFirstJsonObject(text)).toBe(text);
  });

  it("does not get confused by braces inside strings", () => {
    const text = '{"a":"hello {world}","b":1}';
    expect(extractFirstJsonObject(text)).toBe(text);
  });

  it("returns the substring from the first { to end if no closing brace", () => {
    const text = 'partial {"a":1,';
    expect(extractFirstJsonObject(text)).toBe('{"a":1,');
  });

  it("returns the whole trimmed text when no { is present", () => {
    expect(extractFirstJsonObject("nothing here")).toBe("nothing here");
  });
});

describe("recoverFieldsFromMarkdown", () => {
  const fields = [
    { name: "brand", type: "string" as const },
    { name: "model", type: "string" as const },
    { name: "year", type: "number" as const },
  ];

  it("recovers fields from a Spanish markdown list with **bold** names", () => {
    const text = `He extraído los siguientes campos:
- **Brand:** Honda
- **Model:** Civic
- **Year:** 2016
*Asumo que "honds" es un error de escritura por "Honda".*`;
    const out = recoverFieldsFromMarkdown(text, fields);
    expect(out.brand).toBe("Honda");
    expect(out.model).toBe("Civic");
    expect(out.year).toBe("2016");
  });

  it("recovers fields from a plain 'Name: value' style", () => {
    const text = `Brand: Toyota
Model: Corolla
Year: 2017`;
    const out = recoverFieldsFromMarkdown(text, fields);
    expect(out.brand).toBe("Toyota");
    expect(out.model).toBe("Corolla");
    expect(out.year).toBe("2017");
  });

  it("matches case-insensitively", () => {
    const text = `BRAND: Honda
model: civic`;
    const out = recoverFieldsFromMarkdown(text, fields);
    expect(out.brand).toBe("Honda");
    expect(out.model).toBe("civic");
  });

  it("strips parenthetical commentary", () => {
    const text = `Brand: Toyota (asumo typo por Toyota)
Model: Corolla`;
    const out = recoverFieldsFromMarkdown(text, fields);
    expect(out.brand).toBe("Toyota");
  });

  it("strips trailing markdown asterisks", () => {
    const text = `Brand: **Toyota**`;
    const out = recoverFieldsFromMarkdown(text, fields);
    expect(out.brand).toBe("Toyota");
  });

  it("returns empty when no declared fields match", () => {
    const text = `Something else: 42`;
    expect(recoverFieldsFromMarkdown(text, fields)).toEqual({});
  });

  it("ignores prose that mentions field names without naming them as headers", () => {
    const text = `The customer wants a brand new car.`;
    expect(recoverFieldsFromMarkdown(text, fields)).toEqual({});
  });
});

describe("coerceExtractField", () => {
  it("coerces string fields", () => {
    expect(coerceExtractField("Toyota", "string", "brand")).toBe("Toyota");
    expect(coerceExtractField(42, "string", "x")).toBe("42");
    expect(coerceExtractField("  ", "string", "x")).toBeUndefined();
  });

  it("coerces number fields", () => {
    expect(coerceExtractField(2023, "number", "year")).toBe(2023);
    expect(coerceExtractField("2023", "number", "year")).toBe(2023);
    expect(coerceExtractField("  42  ", "number", "x")).toBe(42);
    expect(coerceExtractField("not a number", "number", "x")).toBeUndefined();
  });

  it("coerces boolean fields", () => {
    expect(coerceExtractField(true, "boolean", "x")).toBe(true);
    expect(coerceExtractField("true", "boolean", "x")).toBe(true);
    expect(coerceExtractField("yes", "boolean", "x")).toBe(true);
    expect(coerceExtractField("1", "boolean", "x")).toBe(true);
    expect(coerceExtractField("false", "boolean", "x")).toBe(false);
    expect(coerceExtractField("no", "boolean", "x")).toBe(false);
    expect(coerceExtractField("maybe", "boolean", "x")).toBeUndefined();
  });

  it("returns undefined for null/undefined", () => {
    expect(coerceExtractField(null, "string", "x")).toBeUndefined();
    expect(coerceExtractField(undefined, "number", "x")).toBeUndefined();
  });
});
