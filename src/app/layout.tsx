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
  title: "AnimaJet - L'animation de vos événements, simplifiée",
  description: "Plateforme tout-en-un pour DJ et animateurs : photos en direct, 7 jeux interactifs, QR codes personnalisés. 29,90€/mois tout inclus.",
  keywords: ["animation événement", "DJ", "mariage", "photo booth", "jeux interactifs", "diaporama", "borne photo", "photobooth"],
  authors: [{ name: "AnimaJet" }],
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
    title: "AnimaJet - L'animation de vos événements, simplifiée",
    description: "Plateforme tout-en-un pour DJ et animateurs : photos en direct, 7 jeux interactifs, QR codes personnalisés.",
    images: ["/images/animajet_logo_principal.png"],
    url: "https://animajet.fr",
    siteName: "AnimaJet",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AnimaJet",
    description: "L'animation de vos événements, simplifiée",
    images: ["/images/animajet_logo_principal.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/images/animajet_logo_vector.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/images/animajet_logo_vector.png",
  },
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
