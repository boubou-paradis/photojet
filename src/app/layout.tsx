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
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://photojet.vercel.app'),
  title: "PhotoJet - Partage de photos en temps réel",
  description: "Application premium de partage de photos en temps réel pour événements. Partagez vos photos instantanément lors de mariages, soirées et événements d'entreprise.",
  keywords: ["photo", "événement", "mariage", "partage", "temps réel", "diaporama", "borne photo", "photobooth"],
  authors: [{ name: "PhotoJet" }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "PhotoJet",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: "PhotoJet - Partage de photos en temps réel",
    description: "Application premium de partage de photos pour vos événements",
    images: ["/logo-full.png"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PhotoJet",
    description: "Partage de photos en temps réel pour événements",
    images: ["/logo-full.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/logo.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/logo.png",
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
