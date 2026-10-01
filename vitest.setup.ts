import "@testing-library/jest-dom/vitest";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

// Validate ENCRYPTION_KEY: must decode to exactly 32 bytes
function isValidKey(b64: string | undefined): boolean {
  if (!b64) return false;
  try {
    return Buffer.from(b64, "base64").length === 32;
  } catch {
    return false;
  }
}

if (!isValidKey(process.env.ENCRYPTION_KEY)) {
  // Override invalid/empty key with a deterministic test key (32 bytes)
  process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
}
if (!process.env.META_APP_SECRET) {
  process.env.META_APP_SECRET = "test-meta-app-secret";
}
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
}
if (!process.env.NEXT_PUBLIC_META_APP_ID) {
  process.env.NEXT_PUBLIC_META_APP_ID = "test-meta-app-id";
}
if (!process.env.NEXT_PUBLIC_META_CONFIG_ID) {
  process.env.NEXT_PUBLIC_META_CONFIG_ID = "test-meta-config-id";
}
if (!process.env.NEXT_PUBLIC_META_REDIRECT_URI) {
  process.env.NEXT_PUBLIC_META_REDIRECT_URI = "http://localhost:3000/api/oauth/meta/callback";
}
if (!process.env.NEXT_PUBLIC_APP_URL) {
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
}