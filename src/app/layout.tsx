import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "Compétence — Professeurs vérifiés pour cours à domicile et en ligne",
  description:
    "Plateforme ivoirienne de réservation de cours à domicile et en ligne avec des professeurs vérifiés, un paiement sécurisé et un suivi administratif complet.",
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
  icons: {
    icon: "/images/brand/competence-icon.png",
    shortcut: "/images/brand/competence-icon.png",
  },
  openGraph: {
    title: "Compétence — Professeurs vérifiés en Côte d'Ivoire",
    description:
      "Trouvez un professeur vérifié, réservez votre cours et payez en toute sécurité. Le professeur est payé seulement après confirmation du cours.",
    siteName: "Compétence",
    type: "website",
    locale: "fr_CI",
  },
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
