import type { NextConfig } from "next";

// Balise Google Ads de la vitrine (chargée seulement après consentement, voir
// src/lib/tracking/google-ads.ts). Origines AJOUTÉES aux directives existantes,
// rien n'est retiré. Liste minimale relevée par test navigateur local (07/11/2026) :
// domaines réellement contactés par gtag.js après accord + événements de conversion.
const GOOGLE_ADS_CSP = {
  script: 'https://www.googletagmanager.com',
  img: 'https://www.googletagmanager.com https://www.google.com https://www.google.fr https://googleads.g.doubleclick.net https://ad.doubleclick.net https://www.googleadservices.com',
  connect: 'https://www.google.com https://www.google.fr https://googleads.g.doubleclick.net https://ad.doubleclick.net https://www.googleadservices.com',
};

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
      `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com https://*.vercel-analytics.com https://vercel.live ${GOOGLE_ADS_CSP.script}`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com",
      `img-src 'self' data: blob: https://unesekcovbxeapevuqmc.supabase.co https://animajet.fr https://*.supabase.co ${GOOGLE_ADS_CSP.img}`,
      `connect-src 'self' https://unesekcovbxeapevuqmc.supabase.co wss://unesekcovbxeapevuqmc.supabase.co https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://api.resend.com https://va.vercel-scripts.com https://*.vercel-analytics.com https://vercel.live wss://vercel.live ${GOOGLE_ADS_CSP.connect}`,
      "frame-src 'self' https://checkout.stripe.com https://js.stripe.com https://vercel.live https://www.youtube-nocookie.com https://www.youtube.com",
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
  async redirects() {
    return [
      // URL accentuée tapée ou partagée à la main (404 avec des clics dans GSC)
      { source: '/photo-myst%C3%A8re', destination: '/photo-mystere', permanent: true },
    ];
  },
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
