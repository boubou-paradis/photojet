// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import type { Metadata, Viewport } from "next";
import { Poppins, Inter, Playfair_Display } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { Analytics } from "@vercel/analytics/next";
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

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
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
  // Domaine canonique SEO = apex (non-www), figé volontairement : ne doit pas
  // dépendre de NEXT_PUBLIC_APP_URL pour que les canonicals/og:url restent stables.
  metadataBase: new URL('https://animajet.fr'),
  title: {
    default: "AnimaJet - Animation interactive pour événements professionnels",
    template: "%s | AnimaJet",
  },
  description: "Animation interactive pour vos événements : quiz, blind test, partage photo en direct sur écran géant. Créé par un DJ pour les pros. Sans application.",
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
    title: "AnimaJet - La plateforme d'animations interactives pour l'événementiel",
    description: "Faites participer tous vos invités depuis leur téléphone : quiz, roue de la destinée, photo mystère, partage photo en direct sur écran géant. Sans application. Développé par un DJ animateur pour les pros. Essai gratuit 24h.",
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
    title: "AnimaJet - Animations interactives pour l'événementiel",
    description: "Vos invités participent depuis leur téléphone. Quiz, roue, partage photo en direct sur écran géant. Sans appli. Essai gratuit, 29,90€/mois.",
    images: ["/images/animajet_logo_principal.png"],
    creator: "@animajet",
  },
  // Favicon + icône Apple : convention fichiers Next.js (src/app/favicon.ico, icon.png, apple-icon.png)
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
        className={`${poppins.variable} ${inter.variable} ${playfair.variable} font-sans antialiased`}
      >
        {children}
        <Toaster position="top-center" richColors />
        <Analytics />
      </body>
    </html>
  );
}
