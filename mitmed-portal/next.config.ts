import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // mitmed-portal is a separate app inside the mitmed repo (which has its
  // own lockfile for the static marketing site) — pin the workspace root so
  // Turbopack doesn't try to infer it.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
