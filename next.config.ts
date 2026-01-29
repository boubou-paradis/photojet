import type { NextConfig } from "next";

// Phase 1 - Headers de sécurité sans risque de casse
const securityHeaders = [
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(self), microphone=(self), geolocation=()',
  },
  // Phase 3 - CSP ACTIF (bloque les violations)
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com https://*.vercel-analytics.com https://vercel.live",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://unesekcovbxeapevuqmc.supabase.co https://animajet.fr https://*.supabase.co",
      "connect-src 'self' https://unesekcovbxeapevuqmc.supabase.co wss://unesekcovbxeapevuqmc.supabase.co https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://api.resend.com https://va.vercel-scripts.com https://*.vercel-analytics.com https://vercel.live wss://vercel.live",
      "frame-src 'self' https://checkout.stripe.com https://js.stripe.com https://vercel.live",
      "media-src 'self' blob: https://unesekcovbxeapevuqmc.supabase.co",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  trailingSlash: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
