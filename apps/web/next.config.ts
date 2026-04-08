import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../../"),
  serverExternalPackages: ["pg"],
  transpilePackages: [
    "@mindmap/db",
    "@mindmap/misconceptions",
    "@mindmap/llm",
    "@mindmap/router",
  ],
};

export default nextConfig;
