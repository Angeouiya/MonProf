import { BrandLogo } from "@/components/shared/brand-logo";
import styles from "./workspace.module.css";

export function PrivateAccessShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={styles.accessShell}>
      <header className={styles.profHeader}>
        <a href="/" aria-label="Compétence · accueil">
          <BrandLogo size="sm" priority />
        </a>
        <a href="/contact" className={styles.button}>
          Besoin d’aide ?
        </a>
      </header>
      <main>{children}</main>
      <footer className="flex flex-wrap justify-center gap-6 border-t p-6 text-xs text-slate-600">
        <a href="/conditions-utilisation">CGU</a>
        <a href="/politique-confidentialite">Confidentialité</a>
      </footer>
    </div>
  );
}
