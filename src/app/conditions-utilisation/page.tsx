import type { Metadata } from "next";
import { LegalDocumentPage, type LegalSection } from "@/components/legal/legal-document-page";

export const metadata: Metadata = {
  title: "Conditions générales d'utilisation | Compétence.CI",
  description: "Conditions générales d'utilisation de la plateforme Compétence.CI.",
};

const version = "12 août 2026";

const highlights = [
  "Paiement serveur exact obligatoire : sans confirmation Jèko vérifiée, aucun cours, aucune commande et aucun partage de numéro ne sont activés.",
  "Boutique autorisée uniquement : la fenêtre de paiement doit afficher Compétence.CI ou Boutique Compétence, jamais Buildify, Bluidify ou une boutique inconnue.",
  "La fiche professeur administrée par Compétence est la source de vérité : système non coché = recherche, profil, réservation, paiement et remplacement verrouillés.",
  "Les tarifs sont officiels : le professeur ne remplace pas la grille Compétence, et le total exact est recalculé avant le paiement.",
  "Le retrait professeur porte sur le net validé ; les frais techniques que Compétence prend en charge restent séparés et auditables.",
  "Programme partenariat : une commission de lancement peut être versée uniquement si l'apporteur est déclaré pendant la réservation, pendant la période promotionnelle, puis si le paiement et la réservation sont confirmés.",
  "Un brouillon non payé peut être supprimé par le client tant qu'aucun paiement vérifié ni workflow protégé n'est rattaché au dossier.",
];

const sections: LegalSection[] = [
  {
    title: "Résumé opposable",
    body: [
      "Ce résumé facilite la lecture, mais ne remplace pas les articles détaillés. En cas de contradiction apparente, les règles les plus protectrices de la sécurité, du paiement vérifié, de la protection des apprenants et des droits de Compétence s'appliquent dans la limite de la loi.",
      "Compétence.CI est une plateforme organisée autour d'un moteur interne : l'utilisateur voit un parcours simple, mais les contrôles de compatibilité, prix, paiement, déplacement, remplacement, retrait, fraude et preuve restent traités par le serveur.",
      "Les présentes conditions, la politique de confidentialité, les règles affichées avant paiement et les preuves enregistrées dans le dossier forment ensemble le cadre contractuel applicable au service.",
    ],
  },
  {
    title: "Champ d'application",
    body: [
      "Les présentes conditions générales d'utilisation encadrent l'accès et l'utilisation de la plateforme Compétence.CI, service ivoirien de réservation et de suivi de cours à domicile, cours en ligne, accompagnement scolaire, universitaire, professionnel, concours, métiers et formations.",
      "Toute création de compte, réservation, demande de cours, paiement, demande de remboursement, demande de paiement professeur, notification ou utilisation d'un espace Compétence implique l'acceptation pleine et entière des présentes conditions.",
      "L'acceptation peut être enregistrée par case à cocher, action de réservation, connexion à un espace, validation de paiement ou poursuite d'utilisation après mise à jour importante. Compétence peut conserver la version acceptée, la date, l'adresse IP disponible et les journaux utiles comme preuve.",
      "Compétence peut refuser, suspendre ou limiter l'accès à la plateforme en cas de fraude, usage abusif, paiement non vérifié, contournement, comportement non professionnel, litige grave ou violation des présentes conditions.",
    ],
  },
  {
    title: "Nature du service",
    body: [
      "Compétence met en relation des clients avec des professeurs vérifiés et suivis par le service client. La plateforme organise la réservation, le suivi, la notification, le paiement sécurisé, la traçabilité, la qualité, les avis, les remplacements et la comptabilité interne.",
      "Le service est structuré autour de trois mini-applications principales : Système ivoirien, Système français et Professionnel. Elles servent à afficher uniquement les offres, professeurs, niveaux, prix et règles compatibles avec le parcours choisi.",
      "Les professeurs ne disposent pas d'une inscription publique autonome. Ils sont enrôlés, vérifiés, activés, suspendus ou désactivés par le service client Compétence.",
      "Compétence conserve un pouvoir de contrôle opérationnel sur les professeurs, les missions, les paiements, les sanctions, les remplacements et la visibilité des profils.",
      "Compétence peut faire évoluer les écrans, boutons, filtres, tableaux de bord, moyens de paiement, règles de contrôle, catalogues, couvertures et automatisations afin d'améliorer la sécurité, la simplicité ou la qualité du service, sans altérer une réservation déjà payée sauf nécessité opérationnelle, légale ou antifraude.",
      "Sauf disposition impérative contraire, le professeur intervient comme prestataire indépendant et reste responsable de ses déclarations, qualifications, méthodes, obligations professionnelles et fiscales. L'accès à la plateforme ne constitue ni une garantie de mission, ni un salaire, ni une relation d'exclusivité.",
    ],
  },
  {
    title: "Mini-applications et systèmes enseignés",
    body: [
      "Un professeur peut être autorisé dans un seul système, dans deux systèmes ou dans les trois systèmes, uniquement si l'administration Compétence a coché les systèmes concernés sur sa fiche.",
      "L'autorisation d'un système suppose également un catalogue cohérent : matières, compétences, classes, niveaux ou profils compatibles avec ce système. Une autorisation sans catalogue suffisant peut être refusée ou désactivée.",
      "La fiche professeur administrée par Compétence est la source de vérité opérationnelle. Les cases système contrôlent l'affichage public, les filtres, la page profil, la réservation, le lancement du paiement, les remplacements automatiques et les remplacements forcés par l'administration.",
      "Lorsqu'un professeur n'enseigne pas dans un système, l'action est verrouillée : le profil peut être masqué du parcours, la réservation est impossible, le paiement ne doit pas être lancé et le remplacement ne peut pas sélectionner ce professeur pour ce système.",
      "Un système décoché ne supprime pas automatiquement les réservations historiques, les preuves, les paiements, les litiges ou les obligations déjà nés. Il bloque les nouvelles actions incompatibles et peut exiger la fin, l'annulation ou le remplacement des missions actives avant retrait complet de l'autorisation.",
      "Le client doit choisir un professeur compatible avec le système sélectionné. Lorsqu'il change de mini-application, la plateforme doit présenter uniquement les professeurs, cours, niveaux, formations, prix et filtres rattachés à ce système.",
      "Si une incohérence apparaît entre le système choisi, le niveau, la matière, le CV, le catalogue ou les cases d'autorisation, Compétence peut refuser la réservation, demander un autre profil, corriger la fiche ou suspendre l'affichage jusqu'à clarification.",
    ],
  },
  {
    title: "Compte client",
    body: [
      "Le client doit fournir des informations exactes, à jour et suffisantes pour permettre la réservation, le paiement, l'organisation du cours, la communication avec le professeur et le suivi service client.",
      "Le client est responsable de son compte, de son mot de passe, de ses informations de contact, de l'exactitude de l'adresse et des décisions prises depuis son espace.",
      "Le mot de passe client doit contenir au moins 6 caractères, avec au minimum une lettre et un chiffre. Compétence peut exiger un changement si le mot de passe est temporaire, compromis, réutilisé de manière risquée ou jugé insuffisant pour protéger le compte.",
      "La modification autonome du mot de passe client se fait par lien temporaire envoyé à l'adresse email enregistrée sur le compte. Si aucun email fiable n'est associé au compte, le client doit contacter le service client, qui peut vérifier son identité par téléphone avant de proposer une assistance manuelle.",
      "Une simple demande de mot de passe oublié par un client n'a pas vocation à créer une alerte administrative visible. L'intervention du service client devient nécessaire uniquement en cas d'assistance manuelle, d'absence d'email, de suspicion de fraude ou de blocage de sécurité.",
      "Lorsqu'un apprenant est mineur, le compte doit être utilisé par un parent, tuteur ou représentant autorisé. Le client garantit qu'il est habilité à réserver le cours pour l'apprenant concerné.",
    ],
  },
  {
    title: "Compte et accès professeur",
    body: [
      "L'accès professeur est un espace léger, interne et contrôlé. Il permet au professeur de consulter ses missions, confirmer sa disponibilité, signaler une indisponibilité selon la règle des 24 heures, proposer un créneau, suivre ses paiements, envoyer un message au service client et gérer certaines informations utiles.",
      "L'accès professeur est accordé uniquement par le service client après entretien, vérification et acceptation des règles Compétence. Il peut être retiré à tout moment en cas de risque, faute, indisponibilité, litige, refus répété, suspicion de contournement ou besoin opérationnel.",
      "Le professeur s'engage à fournir une photo réelle, des informations exactes, des disponibilités sincères, un numéro de paiement fiable et à respecter les consignes du service client.",
      "Le professeur accepte que Compétence qualifie, limite ou étende ses systèmes enseignés selon les preuves fournies, son CV, ses matières, ses niveaux, ses résultats, son expérience et les besoins de qualité de la plateforme. La présence dans un système n'est jamais automatique ni définitive.",
      "Une couverture de catalogue est décorative et ne remplace jamais la photo réelle. Toute couverture personnalisée, photo, CV ou information trompeuse, illicite ou portant atteinte aux droits d'un tiers peut être retirée immédiatement.",
      "En cas d'oubli de mot de passe professeur, le professeur doit contacter le service client. Compétence peut créer un mot de passe temporaire après vérification, puis imposer son changement à la connexion afin de protéger l'espace professeur et les données de mission.",
    ],
  },
  {
    title: "Réservations et paiement client",
    body: [
      "Une réservation n'est pas active tant que le paiement n'est pas effectué et confirmé côté serveur par Jèko ou, pour un ancien dossier, par le prestataire historique concerné. Avant cette vérification, la demande reste une intention ou un brouillon de réservation.",
      "Aucune notification opérationnelle ne doit être envoyée au professeur et aucune mission ne doit être considérée comme confirmée si le paiement n'est pas validé par le serveur de Compétence à partir d'une réponse API, webhook ou transaction vérifiable.",
      "Le client choisit un professeur, une matière, un niveau, un format, un lieu et un créneau. La réservation appartient au professeur choisi, sauf remplacement, indisponibilité, annulation, litige ou décision du service client.",
      "Avant d'ouvrir Jèko, Compétence peut recalculer la compatibilité du professeur avec le système choisi. Si le professeur n'est pas autorisé dans ce système ou si son catalogue ne couvre pas la demande, le paiement doit être bloqué afin d'éviter une commande impossible à exécuter.",
      "Un brouillon créé avant paiement apparaît dans l'espace client. Le client peut reprendre le paiement sécurisé ou supprimer définitivement le brouillon tant qu'aucun paiement vérifié, aucune mission et aucun historique opérationnel protégé ne lui sont rattachés.",
      "Le retour du navigateur, la fermeture de la fenêtre Jèko, une capture d'écran ou une déclaration orale ne créent aucune réservation active. Le moteur attend une confirmation serveur portant sur la référence, le marchand, le moyen de paiement et le montant exact.",
      "Si le marchand affiché, le montant, le moyen, le statut serveur ou la référence ne correspondent pas au dossier attendu, Compétence peut bloquer l'activation, demander un contrôle manuel, rejeter le webhook ou demander au client de relancer un paiement propre.",
    ],
    bullets: [
      "Les séances sont organisées par blocs de 2 heures, sauf mention contraire validée par Compétence.",
      "La réservation doit être faite au moins 24 heures avant le cours.",
      "Pour les nouvelles réservations, le paiement se fait exclusivement via Jèko. Le client choisit son moyen de paiement dans la fenêtre sécurisée Jèko. Les anciens dossiers PayDunya restent conservés uniquement dans l'historique.",
      "La fenêtre de paiement officielle doit identifier Compétence.CI ou la Boutique Compétence comme marchand ou bénéficiaire attendu. Si un autre nom de boutique apparaît, notamment une boutique étrangère au service Compétence, le client doit fermer la fenêtre et reprendre le paiement depuis la plateforme.",
      "Les frais de service Compétence, fixés à 3 %, sont affichés séparément avant paiement. Les frais propres au prestataire de paiement sont suivis séparément par la plateforme.",
      "Tout paiement direct hors plateforme est interdit et peut faire perdre les garanties Compétence.",
    ],
  },
  {
    title: "Tarifs officiels et participants",
    body: [
      "Le prix du cours est fixé par la grille officielle du parcours et de la classe. Les montants visibles pendant la navigation sont indicatifs tant que le dossier n'est pas recalculé par le serveur avec le parcours, le niveau, le format, le nombre de séances, les participants, le déplacement et les frais applicables.",
      "Le prix définitif est celui présenté avant paiement ou confirmé par le service client dans le dossier de réservation. Le client doit vérifier le montant total avant de payer.",
      "Aucun professeur ne peut remplacer la grille officielle par son propre prix public. Une exception commerciale ou un accord particulier doit être validé par Compétence et apparaître dans le dossier avant paiement.",
      "L'affichage “dès” sur un profil professeur dépend du système actif et des niveaux réellement couverts. Un profil professionnel doit afficher la base professionnelle lorsqu'il est consulté dans la mini-application Pro, tandis qu'un profil scolaire affiche la base du système ivoirien ou français concerné.",
      "Lorsque le cours se fait en groupe, chaque participant supplémentaire peut entraîner une majoration calculée selon la règle tarifaire en vigueur sur la plateforme.",
      "Un professeur ne peut être réservé que pour les parcours, matières, classes, niveaux ou formations validés sur sa fiche. Le serveur peut refuser une combinaison incompatible et demander au client de choisir un autre profil.",
    ],
    bullets: [
      "Système ivoirien : CP1 à CM1 15 000 FCFA, CM2 à 4e 20 000 FCFA, 3e à 1ère 25 000 FCFA, Terminale 30 000 FCFA par séance de 2 heures.",
      "Système français : CP1 à CM1 37 500 FCFA, CM2 à 4e 50 000 FCFA, 3e à 1ère 62 500 FCFA, Terminale 75 000 FCFA par séance de 2 heures.",
      "Professionnel : 40 000 FCFA par séance de 2 heures, sauf accord écrit spécifique validé par Compétence.",
      "Les frais de déplacement, frais de service et frais techniques éventuels sont affichés séparément avant paiement et ne remplacent pas la grille officielle du cours.",
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
    title: "Programme partenariat et apporteurs d'affaires",
    body: [
      "Compétence peut organiser une promotion temporaire permettant à une personne ayant apporté un client de recevoir une commission commerciale. Cette promotion est limitée dans le temps, par défaut sur la période officielle affichée par la plateforme ou validée par Compétence, généralement six mois ou un an selon la campagne.",
      "Pour qu'une déclaration soit valable, le client doit indiquer le nom de l'apporteur pendant la réservation, avant le paiement. Une personne qui n'a pas été déclarée pendant la période promotionnelle ne peut pas réclamer une commission après la fin de la promotion.",
      "La commission de lancement est fixée à 10 % du montant du cours ou de la formation effectivement confirmé. Les frais de transport, les frais de service Compétence, les frais techniques Jèko, les remboursements, pénalités et montants non liés au cours sont exclus de cette base.",
      "La déclaration ne devient pas automatiquement payable. Elle devient payable uniquement lorsque le paiement a été confirmé côté serveur par Jèko et lorsque la réservation a été validée par Compétence. Un brouillon, une promesse de paiement, une capture d'écran ou une réclamation verbale ne crée aucun droit au paiement.",
      "L'apporteur peut être invité à fournir son identité, une pièce justificative, une photo ou un numéro de dépôt afin que Compétence vérifie la cohérence de la déclaration avant tout versement. Compétence peut refuser, différer ou annuler une commission en cas de doute, doublon, fraude, identité incohérente, déclaration tardive ou litige.",
      "La déclaration valable reste active jusqu'à la fin officielle de la période promotionnelle. Si la promotion prend fin alors qu'aucune déclaration valable n'a été enregistrée pour un client, aucune commission ne sera due. Les déclarations enregistrées mais non confirmées par un paiement et une réservation validée pendant la période peuvent être expirées automatiquement à la fin de la promotion.",
      "Le suivi des partenariats est effectué dans le dashboard administrateur. Les paiements aux apporteurs sont des dépôts manuels ou contrôlés par Compétence et ne constituent ni un salaire, ni un emploi, ni une relation d'agence permanente.",
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
      "Le retrait est exécuté exclusivement par l'infrastructure Jèko vers la destination Mobile Money disponible et confirmée par le professeur. Le numéro exact et le montant sont contrôlés avant création du transfert.",
      "Le professeur retire le montant net libérable validé dans son espace. Lorsque Compétence décide de prendre en charge des frais techniques de transfert, ces frais sont comptabilisés séparément et ne diminuent pas le net professeur déjà validé.",
      "Lorsqu'un professeur fait une demande de retrait, il saisit le montant demandé et confirme le numéro exact. Jèko renvoie un statut serveur qui seul peut valider le transfert. Une demande correctement envoyée est normalement traitée entre 1 heure et 72 heures ouvrées après contrôle.",
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
      "La comparaison du quartier dépend des informations saisies, normalisées et disponibles. En cas d'ambiguïté entre quartier, sous-quartier ou libellé proche, Compétence peut corriger manuellement le dossier avant paiement, remboursement ou versement professeur.",
      "Pour les communes proches, éloignées ou les villes hors Grand Abidjan, la plateforme applique automatiquement le palier publié selon les informations disponibles. Le client doit vérifier la commune, le quartier et le montant avant paiement.",
      "Lorsque la réservation comporte plusieurs séances à domicile, le forfait de déplacement affiché est calculé pour chaque déplacement effectivement planifié puis multiplié par le nombre de séances. Le détail unitaire et le total sont présentés avant le paiement.",
    ],
  },
  {
    title: "Notifications et communications",
    body: [
      "Compétence peut envoyer des notifications internes, emails, SMS, messages WhatsApp, liens privés sécurisés ou messages du service client pour gérer les réservations, paiements, confirmations, remplacements, annulations, remboursements, missions, litiges et alertes.",
      "Les confirmations ordinaires sont affichées dans l'écran concerné. Les notifications flottantes sont réservées aux erreurs, risques de sécurité, changements financiers ou actions critiques qui exigent une attention immédiate.",
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
      "La responsabilité de Compétence ne peut être engagée pour une information fausse fournie par un utilisateur, un cas de force majeure, une indisponibilité technique externe, un incident du prestataire de paiement, une erreur de numéro fournie par le professeur ou le client, ou un comportement fautif d'une partie.",
      "Compétence peut suspendre temporairement un service ou une action lorsque cela est nécessaire pour la maintenance, la sécurité, la fraude, le contrôle de qualité, le litige ou la conformité.",
      "Dans la mesure autorisée par la loi, Compétence n'indemnise pas les pertes indirectes, pertes d'opportunité, pertes de revenus, dommages résultant d'un usage hors plateforme ou conséquences d'informations inexactes fournies par une partie. Pour un dommage direct prouvé relatif à une réservation, la responsabilité totale de Compétence est limitée au montant effectivement payé à Compétence pour la réservation concernée.",
      "Aucune limitation ne s'applique lorsqu'elle serait interdite par une disposition impérative, notamment en cas de faute lourde ou intentionnelle établie, d'atteinte corporelle imputable ou de droit légal du consommateur auquel il ne peut être renoncé.",
    ],
  },
  {
    title: "Preuve électronique et lutte contre la fraude",
    body: [
      "Les journaux horodatés, références, statuts Jèko, signatures de webhook, transactions du montant exact, emails, validations, historiques de connexion et actions enregistrées constituent des éléments de preuve du parcours numérique, sous réserve de leur recevabilité légale.",
      "Une page de retour, une capture d'écran, un SMS isolé, un abandon de fenêtre ou une déclaration de paiement ne valent jamais confirmation. Seule la vérification serveur du prestataire et de la transaction exacte active la réservation ou libère des coordonnées.",
      "Un webhook, une réponse API ou une opération de rapprochement qui ne correspond pas à la boutique Compétence, à la référence attendue, au moyen autorisé, au montant exact ou au statut final peut être ignoré, rejeté, marqué à contrôler ou bloqué sans activer la commande.",
      "Compétence peut geler une réservation, un remboursement, un retrait ou un compte pendant le temps strictement nécessaire à une vérification anti-fraude, à un rapprochement financier ou à la préservation de preuves.",
      "Les coordonnées directes du client et du professeur ne sont partagées entre eux qu'après confirmation serveur d'un paiement exact et rattaché à la réservation concernée.",
    ],
  },
  {
    title: "Propriété intellectuelle et contenus",
    body: [
      "La marque, l'interface, le catalogue de couvertures, les textes, règles, composants, bases de données et éléments graphiques de Compétence.CI sont protégés. Toute extraction, copie systématique, revente, imitation ou réutilisation non autorisée est interdite.",
      "L'utilisateur reste responsable des contenus qu'il fournit et garantit disposer des droits nécessaires. Il accorde à Compétence une licence non exclusive, gratuite et limitée à l'hébergement, l'optimisation, la modération et l'affichage du contenu pour fournir et promouvoir son profil ou le service.",
      "Les couvertures proposées par Compétence peuvent être attribuées automatiquement et aléatoirement aux profils professeurs. Un professeur peut proposer une couverture, une couleur ou une photo personnelle, mais Compétence peut la refuser, la remplacer ou la retirer si elle nuit à l'image, à la cohérence pédagogique, aux droits de tiers ou à la sécurité du service.",
      "Cette licence prend fin lorsque le contenu n'est plus nécessaire, sous réserve des sauvegardes, preuves, obligations légales et contenus déjà intégrés à un dossier litigieux ou financier.",
    ],
  },
  {
    title: "Garantie de l'utilisateur et indemnisation",
    body: [
      "Chaque utilisateur répond des informations, fichiers, instructions, coordonnées, qualifications et contenus qu'il fournit ainsi que de son comportement pendant le cours.",
      "Dans la mesure permise par la loi, l'utilisateur indemnise Compétence des réclamations de tiers résultant de sa fraude, de son contenu illicite, d'une usurpation, d'une violation de droits, d'un paiement direct interdit ou d'un usage de la plateforme contraire aux présentes conditions.",
    ],
  },
  {
    title: "Force majeure, divisibilité et absence de renonciation",
    body: [
      "Compétence n'est pas responsable d'un retard ou d'une impossibilité causé par un événement raisonnablement hors de son contrôle, notamment panne générale, indisponibilité du prestataire financier ou télécom, catastrophe, décision d'autorité, trouble civil ou événement de force majeure reconnu.",
      "Si une clause est déclarée invalide, les autres restent applicables et la clause concernée est interprétée au plus près de son objectif licite. Le fait de ne pas appliquer immédiatement une règle ne vaut pas renonciation à l'appliquer ultérieurement.",
    ],
  },
  {
    title: "Données personnelles",
    body: [
      "L'utilisation de Compétence implique le traitement de données personnelles nécessaires au service. Les règles détaillées sont présentées dans la politique de confidentialité.",
      "Le client accepte cette politique lors de son inscription. Le professeur en prend connaissance lors de l'enrôlement par le service client et peut la consulter depuis son espace.",
      "La réinitialisation du mot de passe client repose sur l'adresse email enregistrée par le client et respecte la règle client de 6 caractères minimum avec une lettre et un chiffre. Pour les professeurs, l'assistance mot de passe passe par le service client, qui peut émettre un mot de passe temporaire à changer à la connexion.",
    ],
  },
  {
    title: "Références légales",
    body: [
      "Les présentes conditions tiennent compte du droit applicable en Côte d'Ivoire, notamment des règles relatives aux transactions électroniques et à la protection des données personnelles, sans préjudice des règles impératives applicables aux consommateurs.",
      "Les transactions électroniques, confirmations numériques, informations précontractuelles, preuves et parcours de paiement s'inscrivent notamment dans le cadre de la loi n°2013-546 du 30 juillet 2013 relative aux transactions électroniques.",
      "Les traitements de données personnelles sont détaillés dans la politique de confidentialité et tiennent notamment compte de la loi n°2013-450 du 19 juin 2013 relative à la protection des données à caractère personnel.",
    ],
  },
  {
    title: "Contact officiel et canal transitoire",
    body: [
      "Le contact opérationnel de référence est contact@competence.ci. Les messages envoyés au service client peuvent être conservés lorsqu'ils servent à prouver une demande, une décision, un incident, une assistance mot de passe, un paiement, un retrait, un litige ou un remboursement.",
      "À titre transitoire, certains emails techniques de sécurité peuvent partir depuis diplomateimmobilier99@gmail.com avec le nom d'expéditeur Compétence.CI. Cette adresse ne modifie pas la marque, les droits, les obligations ni le cadre contractuel de Compétence.CI.",
      "Compétence ne demande jamais à un client ou à un professeur de communiquer son mot de passe par email, téléphone, WhatsApp ou SMS.",
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
      highlights={highlights}
      sections={sections}
    />
  );
}
