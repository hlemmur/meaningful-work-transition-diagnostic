import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  turbopack: {
    root: appRoot,
  },
  env: {
    APP_MODE: process.env.APP_MODE ?? "mock",
  },
};

export default nextConfig;
