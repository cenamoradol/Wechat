import { afterEach, expect, it, vi } from "vitest";
import { legacyLoginUrl, metaRedirectUri } from "./login-config";

afterEach(() => vi.unstubAllEnvs());

it("keeps legacy OAuth separate from Embedded Signup and requests page permissions", () => {
  vi.stubEnv("NEXT_PUBLIC_META_CONFIG_ID", "123456");
  const url = new URL(legacyLoginUrl("123", "https://example.com/api/oauth/meta/callback", "random-state"));
  expect(url.searchParams.has("config_id")).toBe(false);
  expect(url.searchParams.get("state")).toBe("random-state");
  expect(url.searchParams.get("scope")?.split(",")).toEqual(expect.arrayContaining(["pages_read_engagement", "pages_manage_metadata", "instagram_manage_messages"]));
});

it("derives the same callback URL for authorization and exchange", () => {
  vi.stubEnv("NEXT_PUBLIC_META_REDIRECT_URI", "");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://example.com/");
  expect(metaRedirectUri()).toBe("https://example.com/api/oauth/meta/callback");
});
