import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sql.js", "adm-zip"],
  eslint: {
    // Keep production builds resilient; lint is run separately.
    ignoreDuringBuilds: true,
  },
  // Ensure the sql.js WASM binary is included in the serverless function that
  // parses .apkg uploads (it's loaded at runtime via fs, not require, so Next's
  // dependency tracer can't see it on its own — needed for Vercel).
  outputFileTracingIncludes: {
    "/api/import/parse": ["./node_modules/sql.js/dist/sql-wasm.wasm"],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
