import { BrandLogo } from "@/components/shared/brand-logo";
import { BookOpen, Menu, MessageCircle, UserRound, WalletCards } from "lucide-react";
import styles from "./managed-public.module.css";
export function ManagedPublicShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={styles.shell}>
      <a className="sr-only focus:not-sr-only" href="#contenu">Aller au contenu</a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <a href="/" className={styles.brand} aria-label="Compétence — Accueil">
            <BrandLogo size="sm" priority />
          </a>
          <nav aria-label="Navigation parents et clients" className={styles.desktopNav}>
            <a href="/demande-cours">Les cours</a>
            <a href="/tarifs">Tarifs</a>
            <a href="/contact">Contact</a>
            <a href="/client" className={styles.account}><UserRound size={16} aria-hidden="true" />Mon espace</a>
          </nav>
          <div className={styles.mobileActions}>
            <a href="/client" aria-label="Mon espace client" className={styles.iconButton}><UserRound size={19} aria-hidden="true" /></a>
            <details className={styles.mobileMenu}>
              <summary className={styles.iconButton} aria-label="Ouvrir le menu"><Menu size={20} aria-hidden="true" /></summary>
              <nav aria-label="Menu parents et clients">
                <a href="/demande-cours"><BookOpen size={18} aria-hidden="true" />Demander un cours</a>
                <a href="/tarifs"><WalletCards size={18} aria-hidden="true" />Les tarifs</a>
                <a href="/contact"><MessageCircle size={18} aria-hidden="true" />Nous contacter</a>
              </nav>
            </details>
          </div>
        </div>
      </header>
      <main id="contenu" className={styles.main}>{children}</main>
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span className={styles.footerBrand}>Compétence.CI · L'essentiel, bien accompagné.</span>
          <nav className={styles.footerLinks} aria-label="Informations légales">
            <a href="/engagements-accompagnement">Engagements</a>
            <a href="/conditions-utilisation">CGU</a>
            <a href="/politique-confidentialite">Confidentialité</a>
            <a href="/client/reservations">Mes anciens cours</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
