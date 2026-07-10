import type { Metadata } from "next";
import { LegalDocumentPage, type LegalSection } from "@/components/legal/legal-document-page";

export const metadata: Metadata = {
  title: "Conditions générales d'utilisation | Compétence",
  description: "Conditions générales d'utilisation de la plateforme Compétence.",
};

const version = "10 juillet 2026";

const sections: LegalSection[] = [
  {
    title: "Champ d'application",
    body: [
      "Les présentes conditions générales d'utilisation encadrent l'accès et l'utilisation de la plateforme Compétence, service ivoirien de réservation et de suivi de cours à domicile, cours en ligne, accompagnement scolaire, universitaire, professionnel, concours, métiers et formations.",
      "Toute création de compte, réservation, demande de cours, paiement, demande de remboursement, demande de paiement professeur, notification ou utilisation d'un espace Compétence implique l'acceptation pleine et entière des présentes conditions.",
      "Compétence peut refuser, suspendre ou limiter l'accès à la plateforme en cas de fraude, usage abusif, paiement non vérifié, contournement, comportement non professionnel, litige grave ou violation des présentes conditions.",
    ],
  },
  {
    title: "Nature du service",
    body: [
      "Compétence met en relation des clients avec des professeurs vérifiés et suivis par le service client. La plateforme organise la réservation, le suivi, la notification, le paiement sécurisé, la traçabilité, la qualité, les avis, les remplacements et la comptabilité interne.",
      "Les professeurs ne disposent pas d'une inscription publique autonome. Ils sont enrôlés, vérifiés, activés, suspendus ou désactivés par le service client Compétence.",
      "Compétence conserve un pouvoir de contrôle opérationnel sur les professeurs, les missions, les paiements, les sanctions, les remplacements et la visibilité des profils.",
    ],
  },
  {
    title: "Compte client",
    body: [
      "Le client doit fournir des informations exactes, à jour et suffisantes pour permettre la réservation, le paiement, l'organisation du cours, la communication avec le professeur et le suivi service client.",
      "Le client est responsable de son compte, de son mot de passe, de ses informations de contact, de l'exactitude de l'adresse et des décisions prises depuis son espace.",
      "Lorsqu'un apprenant est mineur, le compte doit être utilisé par un parent, tuteur ou représentant autorisé. Le client garantit qu'il est habilité à réserver le cours pour l'apprenant concerné.",
    ],
  },
  {
    title: "Compte et accès professeur",
    body: [
      "L'accès professeur est un espace léger, interne et contrôlé. Il permet au professeur de consulter ses missions, confirmer sa disponibilité, signaler une indisponibilité selon la règle des 24 heures, proposer un créneau, suivre ses paiements, envoyer un message au service client et gérer certaines informations utiles.",
      "L'accès professeur est accordé uniquement par le service client après entretien, vérification et acceptation des règles Compétence. Il peut être retiré à tout moment en cas de risque, faute, indisponibilité, litige, refus répété, suspicion de contournement ou besoin opérationnel.",
      "Le professeur s'engage à fournir une photo réelle, des informations exactes, des disponibilités sincères, un numéro de paiement fiable et à respecter les consignes du service client.",
    ],
  },
  {
    title: "Réservations et paiement client",
    body: [
      "Une réservation n'est pas active tant que le paiement PayDunya n'est pas effectué et vérifié côté serveur. Avant cette vérification, la demande reste une intention ou un brouillon de réservation.",
      "Aucune notification opérationnelle ne doit être envoyée au professeur et aucune mission ne doit être considérée comme confirmée si le paiement PayDunya n'est pas validé par le serveur de Compétence.",
      "Le client choisit un professeur, une matière, un niveau, un format, un lieu et un créneau. La réservation appartient au professeur choisi, sauf remplacement, indisponibilité, annulation, litige ou décision du service client.",
      "Un brouillon créé avant paiement apparaît dans l'espace client. Le client peut reprendre le paiement PayDunya ou supprimer définitivement le brouillon tant qu'aucun paiement vérifié, aucune mission et aucun historique opérationnel protégé ne lui sont rattachés.",
    ],
    bullets: [
      "Les séances sont organisées par blocs de 2 heures, sauf mention contraire validée par Compétence.",
      "La réservation doit être faite au moins 24 heures avant le cours.",
      "Le paiement se fait via PayDunya. Le client choisit le moyen de paiement directement sur PayDunya.",
      "Les frais de service du moyen de paiement peuvent s'ajouter au montant du cours selon le canal utilisé.",
      "Tout paiement direct hors plateforme est interdit et peut faire perdre les garanties Compétence.",
    ],
  },
  {
    title: "Tarifs, prix indicatifs et participants",
    body: [
      "Les prix affichés peuvent être indicatifs lorsqu'ils dépendent du professeur, du niveau, de la matière, du format, du lieu, du nombre de séances, du nombre de participants, du déplacement ou d'une validation du service client.",
      "Le prix définitif est celui présenté avant paiement ou confirmé par le service client dans le dossier de réservation. Le client doit vérifier le montant total avant de payer.",
      "Lorsque le cours se fait en groupe, chaque participant supplémentaire peut entraîner une majoration calculée selon la règle tarifaire en vigueur sur la plateforme.",
    ],
  },
  {
    title: "Disponibilités, horaires et modification de créneau",
    body: [
      "Les disponibilités affichées ou proposées doivent être interprétées comme des créneaux opérationnels soumis à confirmation. Un professeur peut confirmer, signaler une indisponibilité ou proposer un autre créneau selon le délai restant avant le cours.",
      "Si le professeur propose un nouveau créneau, le client peut accepter ou refuser depuis son espace. Une absence de réponse peut entraîner une relance, un remplacement ou une décision du service client.",
      "À moins de 24 heures du cours, le professeur ne peut pas annuler directement la réservation. Il doit prioritairement proposer un nouveau créneau. En cas d'empêchement absolu signalé comme urgence, la réservation reste active pendant que Compétence recherche automatiquement un remplaçant compatible et soumet la proposition au client.",
      "Compétence peut modifier, remplacer ou annuler une attribution si la qualité du service, la sécurité, le paiement, l'adresse, la disponibilité ou la satisfaction client l'exige.",
    ],
  },
  {
    title: "Annulation, remboursement et pénalités",
    body: [
      "Toute annulation doit être demandée depuis l'espace prévu ou par le service client, avec un motif clair. Le client est informé des règles applicables avant la confirmation de l'annulation.",
      "Le remboursement dépend du délai d'annulation, du statut du paiement, des frais du moyen de paiement, de la préparation déjà engagée, du comportement des parties, du litige éventuel et de la politique d'annulation en vigueur.",
      "Lorsque l'annulation est imputable au professeur ou à Compétence, le client peut se voir proposer un remplacement, un report, un autre créneau ou un remboursement selon la situation.",
      "Des annulations répétées, tardives ou abusives peuvent entraîner des pénalités, une limitation du compte ou un contrôle renforcé par le service client.",
    ],
  },
  {
    title: "Remplacement d'un professeur",
    body: [
      "Compétence peut remplacer un professeur en cas d'indisponibilité, retard, absence, litige, mauvaise qualité, suspension, erreur d'affectation ou meilleure solution disponible.",
      "Lorsqu'un professeur se déclare indisponible, le moteur de remplacement peut sélectionner automatiquement un professeur actif possédant une photo réelle, la même matière, le même niveau, un format et un créneau compatibles, sans conflit actif ni litige récent. Le client reste libre d'accepter ou de refuser cette proposition.",
      "Le client est informé du remplacement lorsque celui-ci impacte la réservation. L'ancien professeur et le nouveau professeur peuvent être notifiés par le service client.",
      "Le remplacement est enregistré dans l'historique de la réservation et peut entraîner un recalcul opérationnel ou financier lorsque la différence est justifiée.",
    ],
  },
  {
    title: "Obligations du client",
    body: [
      "Le client doit être joignable, fournir une adresse claire, respecter les horaires, traiter le professeur avec respect, ne pas contourner la plateforme et confirmer le cours après réalisation.",
      "Le client ne doit pas proposer au professeur un paiement direct, une mission hors plateforme, une modification non déclarée ou une relation commerciale parallèle visant à éviter les règles Compétence.",
      "Le client reconnaît que l'apprenant doit disposer du matériel nécessaire à sa formation, notamment pour les formations professionnelles, techniques, artistiques ou pratiques. Compétence ne fournit pas ce matériel sauf accord écrit spécifique.",
    ],
  },
  {
    title: "Obligations du professeur",
    body: [
      "Le professeur doit respecter les créneaux confirmés, informer rapidement le service client de toute indisponibilité, répondre aux notifications, préparer son cours, adopter une conduite professionnelle et ne pas contourner la plateforme.",
      "Le professeur ne doit pas demander un paiement direct au client, modifier un tarif hors plateforme, récupérer une mission sans validation du service client ou utiliser les coordonnées client en dehors du cadre du cours.",
      "Le professeur accepte le contrôle qualité, les avis, les notes du service client, les avertissements, les sanctions, les suspensions, les remplacements et les décisions de paiement interne lorsque les faits le justifient.",
    ],
  },
  {
    title: "Paiement professeur",
    body: [
      "La comptabilité professeur est interne à Compétence. Le professeur ne dispose pas d'un wallet autonome. Les sommes dues sont calculées à partir des réservations payées, vérifiées, réalisées, validées, non litigieuses et libérables par le service client.",
      "Pour une réservation comprenant plusieurs séances, chaque séance possède son propre planning, son professeur affecté et son décompte. Les fonds d'une séance deviennent libérables uniquement après sa réalisation puis sa confirmation par le client; les séances futures restent bloquées.",
      "Une indisponibilité, un report, un remplacement, un litige, une retenue ou un paiement concernant une séance n'affecte pas automatiquement les autres séances du pack. Les versements partiels sont imputés aux séances libérées les plus anciennes et apparaissent sur la facture de paiement.",
      "Le professeur choisit le moyen sur lequel il souhaite recevoir ses fonds parmi Wave, Orange Money, MTN Money et Moov Money. Il saisit puis confirme deux fois le numéro exact. Ce choix est enregistré comme préférence et peut être modifié dans Paramètres ou lors d'une nouvelle demande.",
      "Lorsqu'un professeur fait une demande de paiement, il doit saisir le montant demandé, le moyen de paiement et confirmer le numéro exact. Une demande de paiement validement envoyée est traitée entre 1 heure et 72 heures ouvrées après contrôle du service client.",
      "Ce délai peut être prolongé en cas de litige, erreur de numéro, paiement client non vérifié, retenue, remboursement, contrôle anti-fraude, indisponibilité du moyen de paiement, décision du service client ou information manquante.",
      "Compétence peut payer partiellement, suspendre, différer, refuser ou ajuster un paiement professeur lorsque la réservation, la qualité, le litige, la sanction ou les fonds disponibles le justifient.",
    ],
  },
  {
    title: "Avis, qualité et modération",
    body: [
      "Les clients peuvent laisser des avis et notes lorsque le cours le permet. Le service client peut également attribuer une note qualité interne ou publique selon son contrôle opérationnel.",
      "Compétence peut masquer, corriger, refuser ou modérer un avis abusif, injurieux, mensonger, non pertinent, frauduleux ou contraire à l'intérêt du service.",
      "Les notes et avis servent à améliorer la qualité, orienter les décisions du service client, détecter les litiges et protéger les clients.",
    ],
  },
  {
    title: "Frais de déplacement",
    body: [
      "Les frais de déplacement concernent uniquement les cours à domicile. Aucun frais de déplacement n'est appliqué aux cours en ligne.",
      "Même quartier exact : lorsque le quartier du professeur et celui du client correspondent dans la même commune, les frais de déplacement sont de 0 FCFA. Lorsque la commune est identique mais le quartier différent, le forfait local affiché avant paiement peut s'appliquer.",
      "Pour les communes proches, éloignées ou les villes hors Grand Abidjan, la plateforme applique automatiquement le palier publié selon les informations disponibles. Le client doit vérifier la commune, le quartier et le montant avant paiement.",
      "Lorsque la réservation comporte plusieurs séances à domicile, le forfait de déplacement affiché est calculé pour chaque déplacement effectivement planifié puis multiplié par le nombre de séances. Le détail unitaire et le total sont présentés avant le paiement.",
    ],
  },
  {
    title: "Notifications et communications",
    body: [
      "Compétence peut envoyer des notifications internes, emails, SMS, messages WhatsApp, liens privés sécurisés ou messages du service client pour gérer les réservations, paiements, confirmations, remplacements, annulations, remboursements, missions, litiges et alertes.",
      "Le professeur accepte que les missions puissent lui être communiquées par téléphone, WhatsApp, SMS, email, lien privé ou espace professeur léger. Le client accepte de recevoir les informations utiles à la sécurité et au suivi de sa réservation.",
      "Les communications importantes peuvent être conservées comme preuve dans l'historique de la plateforme.",
    ],
  },
  {
    title: "Interdictions et sanctions",
    body: [
      "Sont interdits : faux paiement, usurpation d'identité, photo professeur non réelle, information mensongère, contournement de plateforme, paiement direct, harcèlement, injure, fraude, abus de remboursement, manipulation d'avis, tentative d'accès non autorisé ou usage contraire à la loi.",
      "Compétence peut appliquer des mesures proportionnées : avertissement, suspension, désactivation, annulation, remboursement, retenue manuelle justifiée, remplacement, blocage de paiement, suppression de contenu, limitation d'accès ou signalement aux autorités compétentes.",
    ],
  },
  {
    title: "Responsabilité de Compétence",
    body: [
      "Compétence met en œuvre des moyens sérieux pour vérifier les professeurs, sécuriser les paiements, organiser les cours et suivre la qualité, mais ne garantit pas un résultat scolaire, professionnel, concours ou financier déterminé.",
      "La responsabilité de Compétence ne peut être engagée pour une information fausse fournie par un utilisateur, un cas de force majeure, une indisponibilité technique externe, un incident de paiement PayDunya, une erreur de numéro fournie par le professeur ou le client, ou un comportement fautif d'une partie.",
      "Compétence peut suspendre temporairement un service ou une action lorsque cela est nécessaire pour la maintenance, la sécurité, la fraude, le contrôle de qualité, le litige ou la conformité.",
    ],
  },
  {
    title: "Données personnelles",
    body: [
      "L'utilisation de Compétence implique le traitement de données personnelles nécessaires au service. Les règles détaillées sont présentées dans la politique de confidentialité.",
      "Le client accepte cette politique lors de son inscription. Le professeur en prend connaissance lors de l'enrôlement par le service client et peut la consulter depuis son espace.",
    ],
  },
  {
    title: "Modification des conditions",
    body: [
      "Compétence peut modifier les présentes conditions pour tenir compte de l'évolution du service, des tarifs, des paiements, des règles d'annulation, des obligations légales ou de la sécurité.",
      "La version publiée sur la plateforme est applicable. Une modification importante peut entraîner une notification, une demande de nouvelle acceptation ou une limitation temporaire de certaines actions jusqu'à acceptation.",
    ],
  },
  {
    title: "Droit applicable et règlement des différends",
    body: [
      "Les présentes conditions sont soumises au droit applicable en Côte d'Ivoire.",
      "En cas de différend, les parties doivent d'abord rechercher une solution amiable via le service client Compétence. À défaut, le litige peut être porté devant les juridictions compétentes d'Abidjan, sauf disposition impérative contraire.",
    ],
  },
];

export default function ConditionsUtilisationPage() {
  return (
    <LegalDocumentPage
      eyebrow="Règles de plateforme"
      title="Conditions générales d'utilisation"
      description="Ces conditions définissent les droits, obligations et règles opérationnelles applicables aux clients, professeurs et à l'équipe Compétence utilisant la plateforme."
      version={version}
      sections={sections}
    />
  );
}
