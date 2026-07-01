"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X, GraduationCap, LayoutDashboard, Phone, Mail, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSession } from "next-auth/react";

const navLinks = [
  { href: "/professeurs", label: "Trouver un professeur" },
  { href: "/comment-ca-marche", label: "Comment ça marche" },
  { href: "/tarifs", label: "Tarifs" },
  { href: "/contact", label: "Contact" },
];

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "ADMIN";
  const isClient = (session?.user as any)?.role === "CLIENT";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
            <Image src="/logo.svg" alt="MonProf CI" width={140} height={28} priority />
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  pathname?.startsWith(link.href)
                    ? "text-primary"
                    : "text-foreground/70 hover:text-foreground hover:bg-muted"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            {isClient && (
              <Button asChild variant="ghost" size="sm">
                <Link href="/client">
                  <LayoutDashboard className="mr-1.5 h-4 w-4" /> Mon espace
                </Link>
              </Button>
            )}
            {isAdmin && (
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin">Admin</Link>
              </Button>
            )}
            {!session && (
              <Button asChild variant="ghost" size="sm">
                <Link href="/connexion">Connexion</Link>
              </Button>
            )}
            {!session && (
              <Button asChild size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Link href="/inscription">Créer un compte</Link>
              </Button>
            )}
            {session && !isAdmin && !isClient && (
              <Button asChild variant="ghost" size="sm">
                <Link href="/connexion">Connexion</Link>
              </Button>
            )}
          </div>

          <button
            className="inline-flex items-center justify-center rounded-lg p-2 text-foreground md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileOpen && (
          <div className="border-t border-border bg-white md:hidden">
            <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm font-medium",
                    pathname?.startsWith(link.href)
                      ? "bg-primary/10 text-primary"
                      : "text-foreground/70 hover:bg-muted"
                  )}
                >
                  {link.label}
                </Link>
              ))}
              <div className="mt-2 flex flex-col gap-2 border-t border-border pt-3">
                {isClient && (
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link href="/client" onClick={() => setMobileOpen(false)}>
                      <LayoutDashboard className="mr-1.5 h-4 w-4" /> Mon espace
                    </Link>
                  </Button>
                )}
                {isAdmin && (
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link href="/admin" onClick={() => setMobileOpen(false)}>Admin</Link>
                  </Button>
                )}
                {!session && (
                  <>
                    <Button asChild variant="outline" size="sm" className="w-full">
                      <Link href="/connexion" onClick={() => setMobileOpen(false)}>Connexion</Link>
                    </Button>
                    <Button asChild size="sm" className="w-full bg-primary text-primary-foreground">
                      <Link href="/inscription" onClick={() => setMobileOpen(false)}>Créer un compte</Link>
                    </Button>
                  </>
                )}
              </div>
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mt-auto border-t border-border bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-4">
            <div className="md:col-span-1">
              <Image src="/logo.svg" alt="MonProf CI" width={140} height={28} />
              <p className="mt-3 max-w-xs text-sm text-muted-foreground">
                Plateforme ivoirienne de réservation de cours à domicile et en ligne, avec des professeurs vérifiés et un paiement sécurisé.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">Plateforme</h4>
              <ul className="mt-3 space-y-2 text-sm">
                <li><Link href="/professeurs" className="text-muted-foreground hover:text-foreground">Trouver un professeur</Link></li>
                <li><Link href="/comment-ca-marche" className="text-muted-foreground hover:text-foreground">Comment ça marche</Link></li>
                <li><Link href="/tarifs" className="text-muted-foreground hover:text-foreground">Tarifs</Link></li>
                <li><Link href="/contact" className="text-muted-foreground hover:text-foreground">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">Compte</h4>
              <ul className="mt-3 space-y-2 text-sm">
                <li><Link href="/connexion" className="text-muted-foreground hover:text-foreground">Connexion</Link></li>
                <li><Link href="/inscription" className="text-muted-foreground hover:text-foreground">Créer un compte</Link></li>
                <li><Link href="/client" className="text-muted-foreground hover:text-foreground">Espace client</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">Contact</h4>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2"><Phone className="h-4 w-4" /> +225 27 22 00 00 00</li>
                <li className="flex items-center gap-2"><Mail className="h-4 w-4" /> support@monprof.ci</li>
                <li className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Cocody, Abidjan</li>
              </ul>
            </div>
          </div>
          <div className="mt-8 flex flex-col items-start justify-between gap-2 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
            <p>© {new Date().getFullYear()} MonProf CI — Tous droits réservés.</p>
            <p className="flex items-center gap-1.5"><GraduationCap className="h-3.5 w-3.5 text-primary" /> Professeurs vérifiés · Paiement sécurisé</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
