import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Reduce peak memory pressure in local dev webpack compilation.
    webpackMemoryOptimizations: true,
  },
  onDemandEntries: {
    // Evict inactive pages faster to keep next-server memory stable during long dev sessions.
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
  turbopack: {
    // Force workspace root to this project so "@/..." resolves correctly
    // even when parent folders contain another lockfile.
    root: __dirname,
  },
};

export default nextConfig;
