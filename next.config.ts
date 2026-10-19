import type { NextConfig } from "next";

// `npm run build:pages` produces a static site for GitHub Pages under /gunpla-universe.
// `npm run dev` / `npm run build` stay a normal Next.js app at the root.
const isPages = process.env.PAGES_EXPORT === "1";
const basePath = isPages ? (process.env.NEXT_PUBLIC_BASE_PATH ?? "/gunpla-universe") : "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(isPages ? { output: "export", trailingSlash: true, images: { unoptimized: true } } : {}),
  basePath,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;
