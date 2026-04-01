import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { setResetTokenByEmail } from "@/lib/reset-token-store";

type MemoryDatabase = Record<string, unknown[]>;

const globalForAuth = globalThis as typeof globalThis & {
  smartPerumahanAuthDb?: MemoryDatabase;
};

const authDb = globalForAuth.smartPerumahanAuthDb ?? {};
const appBaseUrl = process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const appSecret = process.env.BETTER_AUTH_SECRET ?? "smart-perumahan-dev-secret-change-this-in-production";

const DEFAULT_AUTH_MODELS = ["user", "account", "session", "verification", "rateLimit"] as const;

for (const model of DEFAULT_AUTH_MODELS) {
  if (!Array.isArray(authDb[model])) {
    authDb[model] = [];
  }
}

if (!globalForAuth.smartPerumahanAuthDb) {
  globalForAuth.smartPerumahanAuthDb = authDb;
}

export const auth = betterAuth({
  baseURL: appBaseUrl,
  basePath: "/api/auth",
  secret: appSecret,
  database: memoryAdapter(authDb),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 8,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, token }) => {
      setResetTokenByEmail(user.email, token);
    },
  },
});
