import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Évite les redirections 307 sur les webhooks
  skipTrailingSlashRedirect: true,

  // Redirections SEO : www → non-www (301 permanent)
  async redirects() {
    return [
      // Redirection www.animajet.fr → animajet.fr
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.animajet.fr' }],
        destination: 'https://animajet.fr/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
