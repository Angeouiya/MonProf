import { ArrowRight, BookOpen, CalendarDays, Check, Clock3, Home, MessageCircle, Monitor, ShieldCheck } from "lucide-react";
import { ManagedPublicShell } from "./public-shell";
import { ManagedCountryFlag } from "./country-flag";
import { MANAGED_CLASSES, MANAGED_MONTHLY_PRICES } from "@/lib/managed-courses-core";
import styles from "./managed-public.module.css";

export function ManagedLanding() {
  return (
    <ManagedPublicShell>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Le savoir, à votre rythme</p>
          <h1>Un professeur.<br /><span>Un vrai suivi.</span></h1>
          <p className={styles.intro}>Dites-nous l'essentiel. Nous organisons les cours, à domicile ou en ligne.</p>
          <div className={styles.heroActions}>
            <a className={styles.primaryButton} href="/demande-cours">Demander un cours<ArrowRight size={17} aria-hidden="true" /></a>
            <a className={styles.textLink} href="/tarifs">Voir les tarifs<ArrowRight size={14} aria-hidden="true" /></a>
          </div>
          <p className={styles.quietNote}><Check size={14} aria-hidden="true" />Sans compte. Aucun paiement en ligne.</p>
        </div>
        <div className={styles.journeyCard}>
          <div className={styles.journeyCardHeader}>
            <span className={styles.emblem}><BookOpen size={25} strokeWidth={1.4} aria-hidden="true" /></span>
            <div><p>Tout commence ici</p><h2>Quel parcours ?</h2></div>
          </div>
          <div className={styles.journeys}>
            <a className={styles.journey} href="/demande-cours?systeme=ivoirien">
              <span className={styles.flag}><ManagedCountryFlag journey="ivoirien" /></span>
              <span><strong>Système ivoirien</strong><small>De la 6e à la Terminale</small></span>
              <ArrowRight size={17} aria-hidden="true" />
            </a>
            <a className={styles.journey} href="/demande-cours?systeme=francais">
              <span className={styles.flag}><ManagedCountryFlag journey="francais" /></span>
              <span><strong>Système français</strong><small>De la 6e à la Terminale</small></span>
              <ArrowRight size={17} aria-hidden="true" />
            </a>
          </div>
          <div className={styles.cardFoot}><Home size={14} aria-hidden="true" />À domicile<span aria-hidden="true">·</span><Monitor size={14} aria-hidden="true" />En ligne</div>
        </div>
      </section>
      <section className={styles.serviceStrip} aria-label="Votre accompagnement">
        {[
          { icon: ShieldCheck, title: "Un professeur adapté", text: "Choisi avec vous, par notre équipe." },
          { icon: CalendarDays, title: "Vos disponibilités", text: "Des séances de 2 h, à votre rythme." },
          { icon: MessageCircle, title: "Une équipe à votre écoute", text: "Un contact pour tout organiser." },
        ].map(({ icon: Icon, title, text }) => (
          <div key={title} className={styles.serviceItem}>
            <span className={styles.serviceIcon}><Icon size={20} strokeWidth={1.5} aria-hidden="true" /></span>
            <div><h2>{title}</h2><p>{text}</p></div>
          </div>
        ))}
      </section>
    </ManagedPublicShell>
  );
}

export function ManagedTariffs() {
  return (
    <ManagedPublicShell>
      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>Sans surprise</p>
        <h1>Des tarifs clairs.</h1>
        <p>4 séances de 2 h. Le montant s'adapte au nombre de séances choisi.</p>
      </header>
      <div className={styles.tariffGrid}>
        {(["ivoirien", "francais"] as const).map((journey) => (
          <section className={styles.tariffCard} key={journey}>
            <h2><span className={styles.flag}><ManagedCountryFlag journey={journey} /></span>Système {journey === "ivoirien" ? "ivoirien" : "français"}</h2>
            <table>
              <caption className="sr-only">Tarifs en FCFA — système {journey === "ivoirien" ? "ivoirien" : "français"}</caption>
              <thead><tr><th scope="col">Classe</th><th scope="col">4 séances</th><th scope="col">8 séances</th></tr></thead>
              <tbody>{MANAGED_CLASSES.map((level, index) => (
                <tr key={level}>
                  <th scope="row">{level}</th>
                  <td>{MANAGED_MONTHLY_PRICES[journey][index].toLocaleString("fr-FR")} F</td>
                  <td>{(MANAGED_MONTHLY_PRICES[journey][index] * 2).toLocaleString("fr-FR")} F</td>
                </tr>
              ))}</tbody>
            </table>
          </section>
        ))}
      </div>
      <p className={styles.tariffNote}>Montants en FCFA. Règlement auprès de Compétence selon l'échéancier accepté. Pour le primaire, une formation professionnelle ou une demande particulière, <a href="/contact">contactez-nous</a>.</p>
      <div className="text-center"><a className={styles.primaryButton} href="/demande-cours">Préparer ma demande<ArrowRight size={17} aria-hidden="true" /></a></div>
      <p className={styles.quietNote}><Clock3 size={14} aria-hidden="true" />Tout supplément doit être accepté avant engagement.</p>
    </ManagedPublicShell>
  );
}
