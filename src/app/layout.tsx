import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { Providers } from "@/components/providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "MonProf CI — Professeurs vérifiés pour cours à domicile et en ligne",
  description:
    "Plateforme ivoirienne de réservation de cours à domicile et en ligne avec des professeurs vérifiés, un paiement sécurisé et un suivi administratif complet.",
  keywords: [
    "cours à domicile",
    "Côte d'Ivoire",
    "professeur",
    "répétiteur",
    "cours en ligne",
    "Abidjan",
    "MonProf CI",
  ],
  authors: [{ name: "MonProf CI" }],
  openGraph: {
    title: "MonProf CI — Professeurs vérifiés en Côte d'Ivoire",
    description:
      "Trouvez un professeur vérifié, réservez votre cours et payez en toute sécurité. Le professeur est payé seulement après confirmation du cours.",
    siteName: "MonProf CI",
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
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${inter.variable} font-sans antialiased bg-background text-foreground`}
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
