import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { Providers } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

function resolveMetadataBase() {
  try {
    return new URL("https://competence.ci");
  } catch {
    return new URL("https://competence.ci");
  }
}

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
  applicationName: "Compétence",
  title: "Compétence — Professeurs vérifiés pour cours à domicile et en ligne",
  description:
    "Plateforme ivoirienne de réservation de cours à domicile et en ligne avec des professeurs vérifiés, un paiement sécurisé et un suivi service client complet.",
  keywords: [
    "cours à domicile",
    "Côte d'Ivoire",
    "professeur",
    "répétiteur",
    "cours en ligne",
    "Abidjan",
    "Compétence",
  ],
  authors: [{ name: "Compétence" }],
  alternates: {
    canonical: "/",
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/images/brand/competence-icon.png", sizes: "192x192", type: "image/png" },
      { url: "/images/brand/competence-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/images/brand/competence-icon.png",
    apple: "/images/brand/competence-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "Compétence",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  category: "education",
  openGraph: {
    title: "Compétence — Professeurs vérifiés en Côte d'Ivoire",
    description:
      "Trouvez un professeur vérifié, réservez votre cours et payez en toute sécurité. Le professeur est payé seulement après confirmation du cours.",
    siteName: "Compétence",
    type: "website",
    locale: "fr_CI",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#111B4D",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body
        className="font-sans antialiased bg-background text-foreground"
      >
        <Providers>
          {children}
          <Toaster />
          <SonnerToaster position="top-right" richColors />
        </Providers>
      </body>
    </html>
  );
}
