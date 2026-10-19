import path from "node:path";
import { fileURLToPath } from "node:url";
const projectRoot = path.dirname(fileURLToPath(import.meta.url));
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  outputFileTracingRoot: projectRoot,
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
