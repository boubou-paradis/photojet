import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Évite les redirections 307 sur les webhooks
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
