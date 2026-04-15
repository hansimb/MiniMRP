import path from "node:path";
import type { NextConfig } from "next";
import { SERVER_ACTION_BODY_SIZE_LIMIT } from "./lib/uploads/validation.ts";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(import.meta.dirname),
  experimental: {
    serverActions: {
      bodySizeLimit: SERVER_ACTION_BODY_SIZE_LIMIT
    }
  }
};

export default nextConfig;
