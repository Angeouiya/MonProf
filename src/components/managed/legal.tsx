import Link from "next/link";
import { ManagedPublicShell } from "./public-shell";
import {
  MANAGED_PARENT_TERMS,
  MANAGED_TEACHER_TERMS,
  MANAGED_TERMS_VERSION,
} from "@/lib/managed-courses-core";
export function ManagedLegal({ privacy = false }: { privacy?: boolean }) {
  return (
    <ManagedPublicShell>
      <article className="mx-auto max-w-3xl space-y-6 leading-8">
        <h1 className="text-3xl font-semibold">
          {privacy
            ? "Confidentialité du service accompagné"
            : "Conditions du service accompagné"}
        </h1>
        <p className="text-sm text-slate-600">
          Version {MANAGED_TERMS_VERSION} · Nouvelles demandes du service
          accompagné. Chaque dossier conserve les conditions effectivement
          acceptées.
        </p>
        {privacy ? (
          <>
            <h2 className="text-xl font-semibold">Données nécessaires</h2>
            <p>
              Compétence collecte le nom et le téléphone du parent, le système,
              la classe, la matière, le format, le lieu utile, les séances et
              l'échéancier demandés, ainsi que les preuves d'accord et de
              règlement. L'âge, la pièce d'identité et la photo de l'élève ne
              sont pas demandés dans ce formulaire. Évitez toute information
              médicale ou autre donnée sensible dans les zones libres.
            </p>
            <p>
              Pour les professeurs, Compétence utilise les coordonnées, les
              informations professionnelles, les pièces de candidature fournies,
              les compétences, les disponibilités, les accès au portail et les
              écritures de rémunération nécessaires à la mission. Le nouveau
              service ne publie pas un catalogue public de ces profils.
            </p>
            <h2 className="text-xl font-semibold">Finalités et accès</h2>
            <p>
              Ces données servent à répondre à la demande, préparer le contrat,
              attribuer un professeur compatible, organiser les séances et tenir
              la comptabilité. Les accès sont limités à l'équipe autorisée. Le
              professeur proposé voit les informations pédagogiques et de
              planning ; les coordonnées et indications précises du lieu ne lui
              sont présentées qu'après acceptation de la mission. Compétence ne
              vend pas les données personnelles.
            </p>
            <p>
              Le professeur voit uniquement sa rémunération attribuée, sans le
              prix réglé par le parent, la répartition interne ni les
              partenaires commerciaux. Les partenaires sont enregistrés par les
              administrateurs habilités ; leur nom, numéro et commissions
              restent dans la gestion interne. Aucun programme cadeau ni saisie
              de partenaire n’est proposé aux clients.
            </p>
            <p>
              Un client connecté retrouve les dossiers qu’il a créés avec son
              compte ou rattachés au moyen d’un lien privé valide. Les
              confirmations de séances sont horodatées et conservées dans le
              journal du dossier. Un numéro de téléphone similaire ne suffit
              jamais à donner accès à un dossier existant.
            </p>
            <h2 className="text-xl font-semibold">Preuves et conservation</h2>
            <p>
              Le montant, les dates, les échéances, la version des conditions et
              l'horodatage de l'accord sont conservés avec le dossier. Les
              encaissements et règlements manuels comportent une référence et
              l'identité de l'opérateur autorisé. Leur enregistrement ne
              constitue pas une vérification automatique par une banque ou un
              opérateur Mobile Money. Les informations sont conservées pour les
              besoins du suivi, des réclamations et des obligations légales
              applicables, puis supprimées ou anonymisées lorsqu'elles ne sont
              plus nécessaires. Les livres et pièces justificatives comptables
              relevant de l'AUDCIF sont conservés pendant dix ans conformément à
              son article 24. Une demande concernant des données non nécessaires
              à ces obligations est examinée individuellement, sans effacer les
              preuves indispensables à un litige en cours.
            </p>
            <h2 className="text-xl font-semibold">
              Lien privé et notifications
            </h2>
            <p>
              Le lien privé de proposition donne accès au récapitulatif sans
              compte et expire au bout de sept jours. Ne le partagez pas
              publiquement. Il peut être remplacé par l'équipe si nécessaire. Ce
              lien et la case d'accord ne certifient pas l'identité du
              signataire. Les notifications système du professeur nécessitent un
              abonnement actif de son appareil et une autorisation du
              navigateur. Leur contenu peut être visible sur l'écran verrouillé
              selon les réglages de l'appareil ; vous pouvez désactiver cet
              affichage ou les notifications depuis votre téléphone.
            </p>
            <h2 className="text-xl font-semibold">Prestataires et droits</h2>
            <p>
              L'application utilise Cloudflare pour l'hébergement et Supabase
              pour la base de données. Les services push du navigateur ou du
              système interviennent après autorisation de l'appareil. Ces
              prestataires peuvent traiter des données hors de Côte d'Ivoire ;
              les formalités et garanties applicables aux transferts doivent
              être respectées. Ces mentions ne constituent pas une attestation
              d'autorisation administrative. Pour demander accès, rectification,
              suppression ou exercer vos autres droits,{" "}
              <Link href="/contact" className="underline">
                contactez Compétence
              </Link>
              . Certaines preuves doivent être conservées pour une obligation
              légale ou un litige ; une vérification proportionnée de votre
              identité peut être demandée avant communication.
            </p>
            <p className="text-sm">
              Références :{" "}
              <a
                className="underline"
                href="https://www.autoritedeprotection.ci/docs/Loi-2013-450.pdf"
              >
                loi ivoirienne relative aux données personnelles
              </a>{" "}
              ;{" "}
              <a
                className="underline"
                href="https://justice.sec.gouv.sn/wp-content/uploads/textes-reglements/OHADA/Acte-uniforme-relatif-droit-comptable-information-financiere-JAN-2017-JO.pdf"
              >
                AUDCIF, article 24
              </a>
              . Pour toute question sur le traitement de vos données, utilisez
              le contact de Compétence ; les voies de recours auprès de
              l'autorité compétente restent ouvertes.
            </p>
          </>
        ) : (
          <>
            <ol className="list-decimal space-y-4 pl-6">
              {MANAGED_PARENT_TERMS.map((term) => (
                <li key={term}>{term}</li>
              ))}
            </ol>
            <h2 className="text-xl font-semibold">Engagement professeur</h2>
            <p>{MANAGED_TEACHER_TERMS}</p>
            <h2 className="text-xl font-semibold">
              Acceptation et modifications
            </h2>
            <p>
              Une demande saisie par l'administration ne vaut pas accord du
              parent. Le parent accepte personnellement le récapitulatif par le
              formulaire ou le lien privé communiqué. Toute révision du tarif
              annule l'accord antérieur pour la nouvelle proposition. Le
              professeur accepte les séances et engagements dans son espace. La
              preuve conserve la version, la date et les termes acceptés ; elle
              n'est pas présentée comme une signature électronique qualifiée.
            </p>
            <h2 className="text-xl font-semibold">
              Règlements et contestations
            </h2>
            <p>
              Le parent règle Compétence, qui enregistre les encaissements
              réellement reçus. Tout montant négocié fait l’objet d’une nouvelle
              proposition acceptée par le parent avant engagement. La base
              initiale et les révisions sont conservées en interne. Le
              professeur accepte le montant de sa rémunération avant la mission,
              sans accès aux répartitions internes. Le crédit payable du
              professeur exige à la fois l'encaissement correspondant et la
              validation de la séance. Les règlements professeurs sont exécutés
              manuellement et enregistrés séparément. Toute contestation d'une
              séance ou d'un reçu doit être signalée à Compétence avant
              validation ou paiement. Aucune donnée historique, dette,
              rémunération ni recharge d'un ancien parcours n'est
              automatiquement convertie.
            </p>
            <h2 className="text-xl font-semibold">
              Droit applicable et recours
            </h2>
            <p>
              Le droit ivoirien des contrats, des transactions électroniques et
              des données personnelles s'applique, ainsi que les règles OHADA
              pertinentes. Ces clauses n'écartent pas les droits impératifs des
              parties. En cas de différend, Compétence recherche d'abord une
              solution amiable ; les recours légaux devant les autorités et
              juridictions compétentes restent ouverts. Pour toute difficulté,
              contactez l'équipe afin d'obtenir un examen humain du dossier.
            </p>
          </>
        )}
        <p>
          Les engagements et paiements historiques restent soumis aux versions
          et preuves de leurs dossiers ; aucune nouvelle règle ne leur est
          appliquée rétroactivement.
        </p>
      </article>
    </ManagedPublicShell>
  );
}
