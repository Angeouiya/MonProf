import type { Metadata } from "next";
import { LegalDocumentPage, type LegalSection } from "@/components/legal/legal-document-page";

export const metadata: Metadata = {
  title: "Politique de confidentialité | Compétence",
  description: "Politique de confidentialité et protection des données personnelles de la plateforme Compétence.",
};

const version = "4 août 2026";

const sections: LegalSection[] = [
  {
    title: "Objet de la politique",
    body: [
      "La présente politique explique comment Compétence collecte, utilise, conserve, sécurise et partage les données personnelles nécessaires au fonctionnement de la plateforme de cours à domicile, cours en ligne, accompagnement professionnel, concours, métiers et formations.",
      "Elle s'applique aux visiteurs, clients, parents, apprenants, professeurs suivis par le service client, équipe Compétence habilitée, prospects, personnes qui contactent le service client et toute personne utilisant les services Compétence.",
      "Compétence s'engage à traiter les données de manière loyale, utile, proportionnée et conforme au cadre applicable en Côte d'Ivoire, notamment la loi n°2013-450 relative à la protection des données à caractère personnel.",
    ],
  },
  {
    title: "Responsable du traitement et contact",
    body: [
      "Le responsable du traitement est l'éditeur de la plateforme Compétence. Les demandes relatives aux données personnelles peuvent être adressées au service client de la plateforme.",
      "Contact opérationnel : contact@competence.ci. Adresse de référence : Abidjan, Côte d'Ivoire. Lorsque l'identité juridique complète de l'éditeur est finalisée, elle remplace automatiquement cette mention dans les documents contractuels.",
      "Compétence peut demander une preuve d'identité avant de traiter une demande sensible afin d'éviter toute divulgation frauduleuse.",
    ],
  },
  {
    title: "Données collectées",
    body: [
      "Compétence collecte uniquement les données utiles pour créer un compte, rechercher un professeur, réserver un cours, vérifier un paiement, suivre une mission, gérer un litige, traiter un remboursement, payer un professeur ou protéger la plateforme.",
    ],
    bullets: [
      "Données d'identification : nom, prénom ou nom affiché, email, téléphone, commune, quartier, adresse de cours si nécessaire.",
      "Données de compte : mot de passe chiffré, rôle, paramètres, historique de connexion, acceptation des conditions et de la politique de confidentialité.",
      "Données de réservation : professeur choisi, matière, niveau, date, heure, format, lieu, tarif, nombre de participants, règles d'annulation, confirmations et statuts.",
      "Données de brouillon : contenu du dossier non payé, référence éventuelle du prestataire de paiement, date de création et état de reprise ou de suppression.",
      "Données de paiement : montant payé, frais liés au moyen de paiement, référence Jèko ou PayDunya historique, statut serveur vérifié, montant remboursable, numéro de remboursement si le client le fournit.",
      "Données professeur : photo réelle obligatoire, couverture personnalisée ou choisie dans le catalogue, identité, téléphone, email, matières, niveaux, disponibilités, CV source privé, mini-CV structuré, expériences, notes du service client, avis, sanctions, paiements, destination Mobile Money, numéro confirmé et demandes de retrait.",
      "Données de communication : notifications, emails, messages au service client, messages client, messages professeur, traces d'appels manuels, demandes WhatsApp ou SMS lorsque le service client les utilise.",
      "Données techniques : adresse IP, user-agent, journaux de sécurité, horodatage, actions importantes et preuves nécessaires à la lutte contre les faux paiements.",
    ],
  },
  {
    title: "Finalités du traitement",
    body: [
      "Les données sont utilisées pour fournir le service, sécuriser les transactions, organiser les cours, permettre le suivi client, gérer les professeurs comme ressources opérationnelles internes et conserver une traçabilité complète du service client.",
    ],
    bullets: [
      "Créer et sécuriser les comptes clients et accès professeurs.",
      "Afficher des professeurs réels, vérifiés et adaptés à la demande de l'utilisateur.",
      "Calculer les tarifs, frais de déplacement, frais de service, annulations, remboursements et sommes dues.",
      "Vérifier les paiements du prestataire côté serveur avant toute réservation active ou notification professeur.",
      "Notifier les clients, professeurs et l'équipe Compétence sur les événements importants.",
      "Gérer les litiges, sanctions, remplacements, avis, remboursements, paiements professeurs et journaux d'activité.",
      "Rechercher automatiquement un professeur remplaçant compatible lorsque le professeur initial signale une indisponibilité, puis permettre au client d'accepter ou de refuser la proposition.",
      "Prévenir la fraude, les paiements non vérifiés, les abus, les contournements de plateforme et les comportements non professionnels.",
      "Améliorer l'ergonomie, la qualité du service, la sécurité et la performance de la plateforme.",
      "Analyser et structurer un CV professeur, supprimer les répétitions, suggérer des matières ou niveaux et signaler les preuves manquantes sans inventer de diplôme, d'expérience ou de résultat.",
    ],
  },
  {
    title: "Bases de traitement",
    body: [
      "Selon les situations, le traitement repose sur l'exécution du service demandé, l'acceptation des conditions d'utilisation, le consentement lorsque celui-ci est requis, les obligations légales ou l'intérêt légitime de Compétence à sécuriser son activité.",
      "Le consentement donné lors de l'inscription client est enregistré avec une date, une version juridique, l'adresse IP disponible et le navigateur utilisé. Le client peut demander des informations sur cette preuve d'acceptation auprès du service client.",
      "Le professeur n'a pas d'inscription publique autonome. Ses données sont collectées dans le cadre d'un processus d'enrôlement par le service client, d'entretien, de vérification et d'activation interne par Compétence.",
    ],
  },
  {
    title: "Partage des données",
    body: [
      "Compétence ne vend pas les données personnelles. Les données sont partagées uniquement lorsqu'elles sont nécessaires au service, à la sécurité, au paiement, à l'exécution d'une réservation ou à une obligation légale.",
    ],
    bullets: [
      "Le client reçoit le numéro du professeur uniquement après confirmation serveur du paiement correspondant. Un brouillon, une redirection abandonnée ou une capture d'écran ne débloque aucune coordonnée.",
      "Le professeur reçoit le numéro du client uniquement dans une mission rattachée à un paiement dont le prestataire, la transaction et le montant exact ont été vérifiés côté serveur.",
      "L'équipe Compétence habilitée accède aux données nécessaires au contrôle opérationnel, aux paiements, sanctions, notifications, litiges et remboursements.",
      "Jèko traite les informations strictement nécessaires aux nouveaux paiements et aux retraits professeurs ; PayDunya peut apparaître uniquement dans des dossiers historiques. La saisie financière se fait dans l'environnement sécurisé du prestataire.",
      "Des prestataires techniques peuvent intervenir pour l'hébergement, la base de données, l'email, les notifications ou la sécurité, dans la limite de leur mission.",
    ],
  },
  {
    title: "Paiements et remboursements",
    body: [
      "Aucune réservation active n'est créée tant que le paiement n'est pas effectué et confirmé côté serveur par le prestataire. Une réservation non payée reste un brouillon ou une intention de réservation.",
      "Le client peut reprendre un brouillon depuis son espace ou le supprimer si aucun paiement vérifié ni workflow protégé n'y est rattaché. La suppression retire le dossier et les notifications liées, tout en conservant une trace d'audit minimale non financière nécessaire à la sécurité.",
      "En cas d'annulation remboursable, le client peut être invité à fournir un numéro de remboursement. Ce numéro est utilisé uniquement pour traiter le remboursement selon les règles d'annulation, les frais applicables et les décisions du service client.",
      "Les demandes de retrait des professeurs sont suivies dans la comptabilité interne de Compétence puis exécutées et rapprochées par Jèko. Le professeur confirme la destination Mobile Money, le numéro et le montant exact. Les frais de transfert pris en charge par Compétence sont conservés séparément pour l'audit financier.",
    ],
  },
  {
    title: "Durée de conservation",
    body: [
      "Les données sont conservées pendant la durée nécessaire au service, à la preuve, à la sécurité, à la comptabilité interne, au règlement des litiges et aux obligations légales applicables.",
      "Les données de compte sont conservées tant que le compte est actif. Les réservations, paiements, factures, remboursements, litiges, sanctions, notifications et journaux d'activité peuvent être conservés plus longtemps lorsqu'ils servent de preuve opérationnelle, comptable ou juridique.",
      "Compétence peut anonymiser certaines données pour produire des statistiques internes sans identifier directement les personnes concernées.",
    ],
  },
  {
    title: "Sécurité",
    body: [
      "Compétence met en place des mesures raisonnables de sécurité : mots de passe chiffrés, accès différenciés par rôle, vérification serveur des paiements, journaux d'action, limitation des informations visibles selon le profil et contrôle du service client sur les actions sensibles.",
      "L'utilisateur reste responsable de la confidentialité de ses identifiants. Tout accès suspect, perte de téléphone, erreur de numéro de paiement ou tentative de fraude doit être signalé rapidement au service client.",
      "Aucun système n'étant invulnérable, Compétence peut suspendre temporairement une action, un paiement, une réservation ou un accès lorsqu'un risque de sécurité ou de fraude est détecté.",
    ],
  },
  {
    title: "Décisions automatisées et contrôle humain",
    body: [
      "Les moteurs de tarification, compatibilité professeur, transport, CV, détection de fraude et remplacement peuvent produire un calcul, une suggestion, un blocage préventif ou un classement à partir des informations du dossier.",
      "Aucun moteur CV n'est autorisé à créer un diplôme, une expérience, une ancienneté ou un résultat absent du document source. Les champs sensibles, preuves manquantes et suggestions de catalogue restent contrôlables par l'administration avant publication.",
      "Une personne peut demander l'examen humain d'une décision opérationnelle importante auprès du service client. Compétence conserve toutefois le droit de maintenir une mesure de sécurité, un gel de fonds ou une suspension pendant l'analyse d'une fraude, d'un litige ou d'un risque pour un apprenant.",
    ],
  },
  {
    title: "Droits des personnes concernées",
    body: [
      "Sous réserve des limites légales et de la nécessité de conserver certaines preuves, une personne concernée peut demander l'accès à ses données, leur rectification, leur suppression, la limitation du traitement, l'opposition à certains traitements ou le retrait d'un consentement lorsque celui-ci est la base du traitement.",
      "Une demande peut être adressée à contact@competence.ci. Compétence peut refuser ou différer une demande lorsqu'elle porte atteinte à la sécurité, à la prévention de la fraude, à une obligation légale, à un litige en cours ou aux droits d'une autre personne.",
      "En Côte d'Ivoire, les personnes concernées peuvent également saisir ou consulter l'ARTCI, Autorité de Protection des données à caractère personnel, dans les conditions de la loi n°2013-450 du 19 juin 2013.",
    ],
  },
  {
    title: "Mineurs et apprenants",
    body: [
      "Lorsqu'un cours concerne un mineur, le compte doit être créé ou utilisé par un parent, tuteur ou représentant autorisé. Le client s'engage à fournir des informations exactes et à ne pas exposer inutilement les données personnelles de l'apprenant.",
      "Compétence peut refuser, suspendre ou annuler une réservation si les informations fournies sont insuffisantes, incohérentes, dangereuses ou contraires à l'intérêt de l'apprenant.",
    ],
  },
  {
    title: "Cookies et mesures techniques",
    body: [
      "La plateforme peut utiliser des cookies ou technologies similaires nécessaires à la session, à la sécurité, à la mémorisation de préférences, à la prévention de fraude et à la mesure technique de fonctionnement.",
      "Les cookies strictement nécessaires permettent notamment la connexion, la navigation, la protection des formulaires, la continuité de réservation et la gestion des paiements.",
    ],
  },
  {
    title: "Mise à jour de la politique",
    body: [
      "Compétence peut modifier la présente politique pour tenir compte de l'évolution du service, des obligations légales, des prestataires techniques ou des règles internes de sécurité.",
      "La version publiée sur la plateforme est la version applicable. Une modification importante peut être signalée par notification, email, bannière ou demande de nouvelle acceptation selon son impact.",
    ],
  },
];

export default function PolitiqueConfidentialitePage() {
  return (
    <LegalDocumentPage
      eyebrow="Données personnelles"
      title="Politique de confidentialité"
      description="Ce document explique comment Compétence protège les données des clients, apprenants, professeurs et de l'équipe Compétence dans le cadre des réservations, paiements, notifications, remboursements, avis et opérations internes."
      version={version}
      sections={sections}
    />
  );
}
