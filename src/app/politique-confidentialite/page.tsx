import type { Metadata } from "next";
import { LegalDocumentPage, type LegalSection } from "@/components/legal/legal-document-page";

export const metadata: Metadata = {
  title: "Politique de confidentialité | Compétence.CI",
  description: "Politique de confidentialité et protection des données personnelles de la plateforme Compétence.CI.",
};

const version = "12 août 2026";

const highlights = [
  "Compétence ne vend pas les données personnelles et limite l'accès aux personnes ou prestataires nécessaires au service.",
  "Les numéros client et professeur restent masqués jusqu'à la confirmation serveur du paiement exact.",
  "Les paiements et retraits Jèko conservent des preuves techniques afin d'empêcher les faux paiements et les doubles validations.",
  "Les brouillons supprimés retirent les données opérationnelles inutiles, sauf trace minimale nécessaire à la sécurité ou à la preuve.",
  "Les données partenariat sont limitées à la déclaration, la vérification, la commission et la preuve de dépôt nécessaire.",
  "Les CV, photos, couvertures et mini-CV professeurs peuvent être structurés, modérés ou remplacés pour protéger l'image de Compétence.CI.",
  "Les demandes sensibles peuvent exiger une vérification d'identité avant divulgation, correction ou suppression.",
];

const sections: LegalSection[] = [
  {
    title: "Résumé de protection",
    body: [
      "Ce résumé présente les engagements essentiels de Compétence.CI. Les articles détaillés ci-dessous précisent les finalités, données, preuves, droits et limites applicables.",
      "La plateforme collecte uniquement les données utiles au service : compte, réservation, système choisi, paiement, paiement professeur, sécurité, assistance, qualité, CV, avis, litiges et obligations légales.",
      "Compétence cherche à garder l'interface simple, mais conserve derrière elle les contrôles nécessaires pour protéger les clients, les apprenants, les professeurs et la plateforme.",
    ],
  },
  {
    title: "Objet de la politique",
    body: [
      "La présente politique explique comment Compétence.CI collecte, utilise, conserve, sécurise et partage les données personnelles nécessaires au fonctionnement de la plateforme de cours à domicile, cours en ligne, accompagnement professionnel, concours, métiers et formations.",
      "Elle s'applique aux visiteurs, clients, parents, apprenants, professeurs suivis par le service client, équipe Compétence habilitée, prospects, personnes qui contactent le service client et toute personne utilisant les services Compétence.",
      "Compétence s'engage à traiter les données de manière loyale, utile, proportionnée et conforme au cadre applicable en Côte d'Ivoire, notamment la loi n°2013-450 relative à la protection des données à caractère personnel et les règles utiles aux transactions électroniques.",
    ],
  },
  {
    title: "Responsable du traitement et contact",
    body: [
      "Le responsable du traitement est l'éditeur de la plateforme Compétence. Les demandes relatives aux données personnelles peuvent être adressées au service client de la plateforme.",
      "Contact opérationnel : contact@competence.ci. Adresse de référence : Abidjan, Côte d'Ivoire. Lorsque l'identité juridique complète de l'éditeur est finalisée, elle remplace automatiquement cette mention dans les documents contractuels.",
      "Pour certaines opérations transitoires, notamment l'envoi de liens de réinitialisation, Compétence peut utiliser l'adresse opérationnelle diplomateimmobilier99@gmail.com avec un nom d'expéditeur Compétence.CI. Cette adresse reste un canal technique de service et ne change pas l'identité de la plateforme.",
      "Les échanges liés à une demande de droit, un incident, une assistance mot de passe, une fraude, un paiement, un retrait, un remboursement ou un litige peuvent être conservés dans la limite nécessaire à la preuve et au suivi.",
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
      "Données de compte : mot de passe chiffré, rôle, paramètres, historique de connexion, acceptation des conditions et de la politique de confidentialité. Pour les clients, la règle minimale est de 6 caractères avec une lettre et un chiffre ; Compétence ne conserve jamais le mot de passe en clair.",
      "Données de consentement : version des CGU et de la politique acceptée, date, heure, adresse IP disponible, navigateur, preuve de case cochée ou action équivalente.",
      "Données de réservation : professeur choisi, matière, niveau, date, heure, format, lieu, tarif, nombre de participants, règles d'annulation, confirmations et statuts.",
      "Données de parcours : mini-application choisie, système ivoirien, système français ou professionnel, matières et niveaux compatibles, systèmes enseignés cochés par l'administration pour chaque professeur.",
      "Données de brouillon : contenu du dossier non payé, référence éventuelle du prestataire de paiement, date de création et état de reprise ou de suppression.",
      "Données de paiement : montant payé, frais liés au moyen de paiement, boutique ou marchand Jèko affiché, référence Jèko ou PayDunya historique, statut serveur vérifié, statut webhook, montant remboursable, numéro de remboursement si le client le fournit.",
      "Données partenariat : nom, téléphone et email facultatif de l'apporteur, client annoncé, code ou lien de recommandation, réservation concernée, période de promotion, statut de validation, montant du cours, commission calculée, preuve d'identité éventuellement fournie, moyen de dépôt, référence de paiement et notes de vérification administratives.",
      "Données professeur : photo réelle obligatoire, couverture personnalisée, couleur ou couverture choisie dans le catalogue, identité, téléphone, email, matières, niveaux, systèmes enseignés, disponibilités, CV source privé, mini-CV structuré, expériences, notes du service client, avis, sanctions, paiements, destination Mobile Money, numéro confirmé et demandes de retrait.",
      "Données de communication : notifications, emails de réinitialisation client, mots de passe temporaires professeurs émis par le service client, messages au service client, messages client, messages professeur, traces d'appels manuels, demandes WhatsApp ou SMS lorsque le service client les utilise.",
      "Données de preuve : version juridique acceptée, parcours de paiement, coordonnées partagées après confirmation, historique de suppression de brouillon, journaux de retrait et éléments nécessaires à la défense des droits de Compétence, d'un client, d'un professeur ou d'un apprenant.",
      "Données techniques : adresse IP, user-agent, journaux de sécurité, horodatage, actions importantes, signatures, empreintes de preuve et traces nécessaires à la lutte contre les faux paiements.",
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
      "Verrouiller les professeurs qui n'enseignent pas dans le système sélectionné et empêcher toute réservation, paiement ou remplacement incompatible.",
      "Calculer les tarifs, frais de déplacement, frais de service, annulations, remboursements et sommes dues.",
      "Vérifier les paiements Jèko côté serveur avant toute réservation active, notification professeur ou partage de coordonnées.",
      "Gérer le programme partenariat temporaire : enregistrer une pré-déclaration apporteur ou une déclaration faite pendant la réservation, générer un lien de recommandation, calculer la commission hors transport et frais, vérifier l'identité de l'apporteur, refuser les réclamations tardives ou frauduleuses et tracer le dépôt éventuel.",
      "Notifier les clients, professeurs et l'équipe Compétence sur les événements importants.",
      "Gérer les litiges, sanctions, remplacements, avis, remboursements, paiements professeurs et journaux d'activité.",
      "Rechercher automatiquement un professeur remplaçant compatible lorsque le professeur initial signale une indisponibilité, puis permettre au client d'accepter ou de refuser la proposition.",
      "Prévenir la fraude, les paiements non vérifiés, les abus, les contournements de plateforme et les comportements non professionnels.",
      "Améliorer l'ergonomie, la qualité du service, la sécurité et la performance de la plateforme.",
      "Analyser et structurer un CV professeur, supprimer les répétitions, suggérer des matières ou niveaux et signaler les preuves manquantes sans inventer de diplôme, d'expérience ou de résultat.",
      "Attribuer automatiquement une couverture, une couleur ou un visuel pédagogique lorsque le professeur n'en choisit pas, puis permettre au service client de modérer les contenus qui nuisent à la présentation professionnelle de la plateforme.",
    ],
  },
  {
    title: "Bases de traitement",
    body: [
      "Selon les situations, le traitement repose sur l'exécution du service demandé, l'acceptation des conditions d'utilisation, le consentement lorsque celui-ci est requis, les obligations légales ou l'intérêt légitime de Compétence à sécuriser son activité.",
      "Le consentement donné lors de l'inscription client est enregistré avec une date, une version juridique, l'adresse IP disponible et le navigateur utilisé. Le client peut demander des informations sur cette preuve d'acceptation auprès du service client.",
      "Le professeur n'a pas d'inscription publique autonome. Ses données sont collectées dans le cadre d'un processus d'enrôlement par le service client, d'entretien, de vérification et d'activation interne par Compétence.",
      "Lorsque le traitement concerne la sécurité, les faux paiements, les litiges, les retraits professeurs, les remboursements, les sanctions ou la protection d'un apprenant, Compétence peut s'appuyer sur son intérêt légitime et conserver les preuves strictement utiles même si une demande de suppression est formulée.",
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
      "Un administrateur habilité peut consulter ou partager les coordonnées uniquement pour organiser le cours, résoudre une difficulté, traiter un remboursement, contrôler un paiement, gérer un litige ou protéger la plateforme.",
      "L'équipe Compétence habilitée accède aux données nécessaires au contrôle opérationnel, aux paiements, sanctions, notifications, litiges et remboursements.",
      "Jèko traite les informations strictement nécessaires aux nouveaux paiements et aux retraits professeurs ; la boutique ou le marchand attendu doit correspondre à Compétence.CI ou à la Boutique Compétence. Une boutique tierce ou un marchand inattendu ne doit pas être utilisé pour valider un paiement Compétence. PayDunya peut apparaître uniquement dans des dossiers historiques.",
      "La saisie du numéro de paiement, de l'opérateur mobile money ou des informations financières s'effectue dans l'environnement sécurisé du prestataire lorsque celui-ci l'exige. Compétence conserve seulement les références, statuts, montants et informations nécessaires au rapprochement.",
      "Des prestataires techniques peuvent intervenir pour l'hébergement, la base de données, l'email, les notifications ou la sécurité, dans la limite de leur mission.",
    ],
  },
  {
    title: "Paiements et remboursements",
    body: [
      "Aucune réservation active n'est créée tant que le paiement n'est pas effectué et confirmé côté serveur par Jèko ou, pour un ancien dossier, par le prestataire historique concerné. Une réservation non payée reste un brouillon ou une intention de réservation.",
      "Le client peut reprendre un brouillon depuis son espace ou le supprimer si aucun paiement vérifié ni workflow protégé n'y est rattaché. La suppression retire le dossier et les notifications liées, tout en conservant une trace d'audit minimale non financière nécessaire à la sécurité.",
      "En cas d'annulation remboursable, le client peut être invité à fournir un numéro de remboursement. Ce numéro est utilisé uniquement pour traiter le remboursement selon les règles d'annulation, les frais applicables et les décisions du service client.",
      "Les demandes de retrait des professeurs sont suivies dans la comptabilité interne de Compétence puis exécutées et rapprochées par Jèko. Le professeur confirme la destination Mobile Money, le numéro et le montant exact. Les frais de transfert pris en charge par Compétence sont conservés séparément pour l'audit financier et ne sont pas utilisés pour réduire le net professeur validé.",
      "Les traces de webhook, réponses API, erreurs de prestataire, références ambiguës et statuts de rapprochement peuvent être conservés afin d'empêcher qu'un faux paiement, un paiement abandonné ou une tentative incomplète génère une vraie commande.",
    ],
  },
  {
    title: "Réinitialisation des mots de passe",
    body: [
      "Pour les clients, la réinitialisation autonome repose sur un lien temporaire envoyé à l'adresse email déclarée lors de la création du compte. Le lien est limité dans le temps et ne révèle jamais l'ancien mot de passe.",
      "Le nouveau mot de passe client doit respecter la règle minimale de 6 caractères avec une lettre et un chiffre. Seul le résultat chiffré, la date de changement et les preuves de sécurité nécessaires sont conservés.",
      "Lorsqu'un client n'a pas d'adresse email exploitable, il peut contacter le service client avec son numéro de téléphone. Compétence peut alors vérifier l'identité du demandeur avant de proposer une assistance manuelle ou un mot de passe temporaire.",
      "Pour les professeurs, l'oubli de mot de passe passe par le service client. Le mot de passe temporaire éventuellement créé doit être changé à la connexion et peut être désactivé en cas de doute.",
      "Les demandes ordinaires de mot de passe oublié ne sont pas destinées à exposer inutilement les données du client dans le dashboard administrateur. Une trace technique peut être conservée pour la sécurité, mais l'alerte humaine est réservée aux cas d'assistance, blocage ou risque.",
    ],
  },
  {
    title: "Durée de conservation",
    body: [
      "Les données sont conservées pendant la durée nécessaire au service, à la preuve, à la sécurité, à la comptabilité interne, au règlement des litiges et aux obligations légales applicables.",
      "Les données de compte sont conservées tant que le compte est actif. Les réservations, paiements, factures, remboursements, litiges, sanctions, notifications et journaux d'activité peuvent être conservés plus longtemps lorsqu'ils servent de preuve opérationnelle, comptable ou juridique.",
      "Lorsqu'un brouillon est supprimé avant paiement, Compétence supprime les données opérationnelles inutiles, mais peut conserver une trace minimale d'audit lorsqu'elle est nécessaire pour éviter les doublons, prouver l'absence de paiement ou protéger la plateforme.",
      "Les déclarations partenariat non confirmées peuvent expirer à la fin de la période promotionnelle. Les déclarations payées, rejetées ou liées à un litige financier peuvent être conservées aussi longtemps que nécessaire à la preuve, à la comptabilité interne et à la prévention de la fraude.",
      "Compétence peut anonymiser certaines données pour produire des statistiques internes sans identifier directement les personnes concernées.",
    ],
  },
  {
    title: "Sécurité",
    body: [
      "Compétence met en place des mesures raisonnables de sécurité : mots de passe chiffrés, règle client minimale de 6 caractères avec une lettre et un chiffre, liens de réinitialisation temporaires pour les clients, mots de passe temporaires professeurs à renouveler, accès différenciés par rôle, vérification serveur des paiements, journaux d'action, limitation des informations visibles selon le profil et contrôle du service client sur les actions sensibles.",
      "Les coordonnées entre client et professeur restent masquées tant qu'une réservation n'est pas confirmée par un paiement serveur exact. Cette séparation protège les utilisateurs et réduit le contournement, les faux paiements et les prises de contact non autorisées.",
      "L'utilisateur reste responsable de la confidentialité de ses identifiants. Tout accès suspect, perte de téléphone, erreur de numéro de paiement ou tentative de fraude doit être signalé rapidement au service client.",
      "Aucun système n'étant invulnérable, Compétence peut suspendre temporairement une action, un paiement, une réservation ou un accès lorsqu'un risque de sécurité ou de fraude est détecté.",
    ],
  },
  {
    title: "Décisions automatisées et contrôle humain",
    body: [
      "Les moteurs de tarification, compatibilité professeur, transport, CV, détection de fraude et remplacement peuvent produire un calcul, une suggestion, un blocage préventif ou un classement à partir des informations du dossier.",
      "Aucun moteur CV n'est autorisé à créer un diplôme, une expérience, une ancienneté ou un résultat absent du document source. Les champs sensibles, preuves manquantes et suggestions de catalogue restent contrôlables par l'administration avant publication.",
      "Les photos de profil, couvertures, couleurs, CV et mini-CV des professeurs peuvent être modérés, optimisés, masqués ou remplacés par un catalogue Compétence lorsque la qualité, la sécurité, les droits de tiers ou la cohérence pédagogique l'exigent.",
      "Une personne peut demander l'examen humain d'une décision opérationnelle importante auprès du service client. Compétence conserve toutefois le droit de maintenir une mesure de sécurité, un gel de fonds ou une suspension pendant l'analyse d'une fraude, d'un litige ou d'un risque pour un apprenant.",
    ],
  },
  {
    title: "Hébergement, prestataires et transferts techniques",
    body: [
      "La plateforme peut s'appuyer sur des prestataires techniques pour l'hébergement, la base de données, l'envoi d'emails, les notifications, la sécurité, les sauvegardes, l'analyse de fichiers et le paiement.",
      "Ces prestataires reçoivent uniquement les données nécessaires à leur mission. Lorsque certains traitements techniques impliquent un accès ou un hébergement hors de Côte d'Ivoire, Compétence cherche à appliquer des garanties contractuelles, organisationnelles et de sécurité adaptées à la nature des données.",
      "Compétence peut changer de prestataire lorsque cela améliore la sécurité, la disponibilité, le coût, la conformité ou la qualité de service, sous réserve de mettre à jour la présente politique lorsque le changement est significatif.",
    ],
  },
  {
    title: "Droits des personnes concernées",
    body: [
      "Sous réserve des limites légales et de la nécessité de conserver certaines preuves, une personne concernée peut demander l'accès à ses données, leur rectification, leur suppression, la limitation du traitement, l'opposition à certains traitements ou le retrait d'un consentement lorsque celui-ci est la base du traitement.",
      "Une demande peut être adressée à contact@competence.ci. Compétence peut refuser ou différer une demande lorsqu'elle porte atteinte à la sécurité, à la prévention de la fraude, à une obligation légale, à un litige en cours ou aux droits d'une autre personne.",
      "Une suppression ne peut pas effacer rétroactivement les écritures financières, preuves de paiement, preuves d'acceptation, litiges, sanctions, factures ou journaux nécessaires à la défense des droits de Compétence, d'un client, d'un professeur ou d'un apprenant.",
      "En Côte d'Ivoire, les personnes concernées peuvent également saisir ou consulter l'ARTCI, Autorité de Protection des données à caractère personnel, dans les conditions de la loi n°2013-450 du 19 juin 2013.",
    ],
  },
  {
    title: "Mineurs et apprenants",
    body: [
      "Lorsqu'un cours concerne un mineur, le compte doit être créé ou utilisé par un parent, tuteur ou représentant autorisé. Le client s'engage à fournir des informations exactes et à ne pas exposer inutilement les données personnelles de l'apprenant.",
      "Les informations concernant l'apprenant mineur sont utilisées pour organiser le cours, adapter le niveau, assurer le suivi pédagogique et protéger la sécurité de l'enfant. Elles ne sont pas vendues et ne doivent pas être utilisées par le professeur pour une relation commerciale hors plateforme.",
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
      highlights={highlights}
      sections={sections}
    />
  );
}
