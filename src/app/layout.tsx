// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import type { Metadata, Viewport } from "next";
import { Poppins, Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#D4AF37",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://animajet.fr'),
  title: {
    default: "AnimaJet - Animation interactive pour événements professionnels",
    template: "%s | AnimaJet",
  },
  description: "Plateforme d'animation interactive pour professionnels : DJ, entreprises, bars, restaurants, campings, mariages. Photos en direct, 7 jeux interactifs, QR codes. Essai gratuit 24h, 29,90€/mois.",
  keywords: [
    "animation événement",
    "animation entreprise",
    "animation bar restaurant",
    "animation camping",
    "animation mariage",
    "DJ animateur",
    "photo booth",
    "borne photo",
    "photobooth",
    "jeux interactifs",
    "diaporama en direct",
    "quiz interactif",
    "animation soirée",
    "QR code événement",
    "animation professionnelle",
  ],
  authors: [{ name: "AnimaJet", url: "https://animajet.fr" }],
  creator: "MG Events Animation",
  publisher: "AnimaJet",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "AnimaJet",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: "AnimaJet - Animation interactive pour événements professionnels",
    description: "Plateforme d'animation interactive : photos en direct, 7 jeux interactifs, QR codes personnalisés. Pour DJ, entreprises, bars, restaurants, campings, mariages. Essai gratuit 24h.",
    images: [
      {
        url: "/images/animajet_logo_principal.png",
        width: 1200,
        height: 630,
        alt: "AnimaJet - Animation interactive pour événements",
      },
    ],
    url: "https://animajet.fr",
    siteName: "AnimaJet",
    type: "website",
    locale: "fr_FR",
  },
  twitter: {
    card: "summary_large_image",
    title: "AnimaJet - Animation interactive pour événements",
    description: "Photos en direct, 7 jeux interactifs, QR codes. Essai gratuit 24h, 29,90€/mois.",
    images: ["/images/animajet_logo_principal.png"],
    creator: "@animajet",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/images/animajet_logo_vector.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/images/animajet_logo_vector.png",
  },
  alternates: {
    canonical: "https://animajet.fr",
  },
  category: "technology",
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body
        className={`${poppins.variable} ${inter.variable} font-sans antialiased`}
      >
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
