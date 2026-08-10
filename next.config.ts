import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Pin the workspace root explicitly — an unrelated package-lock.json in the
  // parent home directory otherwise makes Next misdetect the project root.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
