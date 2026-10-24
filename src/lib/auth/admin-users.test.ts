// ponytail: the generated password is handed to a human over the phone and
// must satisfy the SAME policy signupAction enforces — otherwise the admin
// provisions a login that the app itself would have rejected.

import { describe, expect, it } from "vitest";
import { generatePassword } from "./admin-users";

describe("generatePassword", () => {
  it("satisfies the signup policy (>=8, uppercase, digit)", () => {
    for (let i = 0; i < 50; i++) {
      const p = generatePassword();
      expect(p.length).toBeGreaterThanOrEqual(8);
      expect(p).toMatch(/[A-Z]/);
      expect(p).toMatch(/[0-9]/);
    }
  });

  it("avoids glyphs that get misread out loud", () => {
    for (let i = 0; i < 50; i++) {
      expect(generatePassword()).not.toMatch(/[il1O0]/);
    }
  });

  it("does not repeat itself", () => {
    const set = new Set(Array.from({ length: 20 }, () => generatePassword()));
    expect(set.size).toBe(20);
  });
});
