import { describe, expect, it } from "vitest";
import { extractFirstJsonObject, coerceExtractField } from "@/lib/automations/steps";

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
