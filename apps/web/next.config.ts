import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg"],
  transpilePackages: [
    "@mindmap/db",
    "@mindmap/misconceptions",
    "@mindmap/llm",
    "@mindmap/router",
  ],
};

export default nextConfig;
