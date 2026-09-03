import type { Metadata } from "next";
import { LegalDocumentPage, type LegalSection } from "@/components/legal/legal-document-page";

export const metadata: Metadata = {
  title: "Conditions générales d'utilisation | Compétence.CI",
  description: "Conditions générales d'utilisation de la plateforme Compétence.CI.",
};

const version = "3 septembre 2026";

const highlights = [
  "Paiement serveur exact obligatoire : sans confirmation Jèko vérifiée, aucun cours, aucune commande et aucun partage de numéro ne sont activés.",
  "Boutique autorisée uniquement : la fenêtre de paiement doit afficher Compétence.CI ou Boutique Compétence. Toute boutique tierce, inconnue ou non autorisée bloque la commande.",
  "La fiche professeur administrée par Compétence est la source de vérité : système non coché = recherche, profil, réservation, paiement et remplacement verrouillés.",
  "Chaque professeur dispose automatiquement d'un lien public Compétence.CI, partageable sur les réseaux sociaux et contrôlé par la plateforme.",
  "Les tarifs sont officiels : le professeur ne remplace pas la grille Compétence, et le total exact est recalculé avant le paiement.",
  "Chaque date et chaque heure sont contrôlées côté serveur : un créneau payé, son chevauchement et son temps de déplacement deviennent indisponibles pour tout autre client.",
  "Avant d'annuler, le client peut demander une alternative professeur : la réservation reste active pendant que le moteur propose un profil compatible ou signale le dossier au service client.",
  "Le professeur déclenche son retrait dans son espace ; Jèko l'exécute automatiquement après les contrôles de solde, de litige et d'identité, sans validation manuelle de l'administration.",
  "Programme partenariat : aucune commission n'est acquise sans déclaration dans les délais, paiement Jèko confirmé par le serveur et réservation validée par Compétence.",
  "Un brouillon non payé reste supprimable par le client tant qu'aucun paiement vérifié ni workflow protégé n'est rattaché au dossier.",
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
      "L'acceptation est prouvée par case à cocher, action de réservation, connexion à un espace, validation de paiement ou poursuite d'utilisation après mise à jour importante. Compétence conserve la version acceptée, la date, l'adresse IP disponible et les journaux utiles comme preuve.",
      "Compétence se réserve le droit de refuser, suspendre ou limiter l'accès à la plateforme en cas de fraude, usage abusif, paiement non vérifié, contournement, comportement non professionnel, litige grave ou violation des présentes conditions.",
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
    title: "Liens publics professeurs et réseaux sociaux",
    body: [
      "Compétence attribue automatiquement à chaque professeur un lien public unique rattaché à sa fiche. Ce lien peut être copié ou partagé sur WhatsApp, Facebook, LinkedIn et tout autre canal compatible afin de présenter le profil et conduire le visiteur vers la réservation Compétence.CI.",
      "Le lien, son format, son adresse, sa redirection, sa présentation sociale, ses boutons et les données techniques associées appartiennent à l'écosystème Compétence.CI. Le professeur bénéficie d'un droit d'utilisation limité à la promotion loyale de son profil tant que celui-ci est autorisé et publié.",
      "Le lien ne transfère aucun droit sur le domaine, la marque, l'interface, les clients ou les données de Compétence. Il ne crée ni exclusivité, ni rémunération, ni commission, ni priorité de réservation en dehors d'un programme partenaire expressément validé par Compétence.",
      "Le professeur doit partager son lien sans spam, usurpation, promesse mensongère, faux résultat, tarif non officiel, publicité illicite ou contenu susceptible de nuire à Compétence.CI. Toute communication réalisée autour du lien demeure sous la responsabilité de son auteur.",
      "Compétence peut corriger la prévisualisation, rediriger, limiter, suspendre ou désactiver le lien lorsque le profil est incomplet, inactif, suspendu, blacklisté, frauduleux, trompeur, litigieux ou contraire à la qualité et à la réputation de la plateforme.",
      "Toute réservation provenant d'un lien reste soumise aux contrôles ordinaires de système, catalogue, disponibilité, déplacement, prix et paiement Jèko. Le partage du lien ne contourne aucune règle serveur et ne donne accès à aucune coordonnée privée avant le paiement vérifié.",
    ],
  },
  {
    title: "Mini-applications et systèmes enseignés",
    body: [
      "Un professeur est autorisé dans un seul système, dans deux systèmes ou dans les trois systèmes uniquement lorsque l'administration Compétence a coché les systèmes concernés sur sa fiche.",
      "L'autorisation d'un système suppose également un catalogue cohérent : matières, compétences, classes, niveaux ou profils compatibles avec ce système. Une autorisation sans catalogue suffisant est refusée, suspendue ou désactivée.",
      "La fiche professeur administrée par Compétence est la source de vérité opérationnelle. Les cases système contrôlent l'affichage public, les filtres, la page profil, la réservation, le lancement du paiement, les remplacements automatiques et les remplacements forcés par l'administration.",
      "Lorsqu'un professeur n'enseigne pas dans un système, l'action est verrouillée : le profil est masqué du parcours concerné, la réservation est impossible, le paiement ne doit pas être lancé et le remplacement ne sélectionne pas ce professeur pour ce système.",
      "Un système décoché ne supprime pas automatiquement les réservations historiques, les preuves, les paiements, les litiges ou les obligations déjà nés. Il bloque les nouvelles actions incompatibles et peut exiger la fin, l'annulation ou le remplacement des missions actives avant retrait complet de l'autorisation.",
      "Le client doit choisir un professeur compatible avec le système sélectionné. Lorsqu'il change de mini-application, la plateforme doit présenter uniquement les professeurs, cours, niveaux, formations, prix et filtres rattachés à ce système.",
      "Si une incohérence apparaît entre le système choisi, le niveau, la matière, le CV, le catalogue ou les cases d'autorisation, Compétence se réserve le droit de refuser la réservation, demander un autre profil, corriger la fiche ou suspendre l'affichage jusqu'à clarification.",
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
      "L'accès professeur est accordé uniquement par le service client après entretien, vérification et acceptation des règles Compétence. Il est retiré à tout moment en cas de risque, faute, indisponibilité, litige, refus répété, suspicion de contournement ou besoin opérationnel.",
      "Le professeur s'engage à fournir une photo réelle, des informations exactes, des disponibilités sincères, un numéro de paiement fiable et à respecter les consignes du service client.",
      "Le professeur accepte que Compétence qualifie, limite ou étende ses systèmes enseignés selon les preuves fournies, son CV, ses matières, ses niveaux, ses résultats, son expérience et les besoins de qualité de la plateforme. La présence dans un système n'est jamais automatique ni définitive.",
      "Une couverture de catalogue est décorative et ne remplace jamais la photo réelle. Toute couverture personnalisée, photo, CV ou information trompeuse, illicite ou portant atteinte aux droits d'un tiers est retirée immédiatement.",
      "En cas d'oubli de mot de passe professeur, le professeur doit contacter le service client. Compétence peut créer un mot de passe temporaire après vérification, puis imposer son changement à la connexion afin de protéger l'espace professeur et les données de mission.",
    ],
  },
  {
    title: "Réservations et paiement client",
    body: [
      "Une réservation n'est pas active tant que le paiement n'est pas effectué et confirmé côté serveur par Jèko. Avant cette vérification, la demande reste une intention ou un brouillon de réservation.",
      "Aucune notification opérationnelle ne doit être envoyée au professeur et aucune mission ne doit être considérée comme confirmée si le paiement n'est pas validé par le serveur de Compétence à partir d'une réponse API, webhook ou transaction vérifiable.",
      "Le client choisit un professeur, une matière, un niveau, un format, un lieu et un créneau. La réservation appartient au professeur choisi, sauf remplacement, indisponibilité, annulation, litige ou décision du service client.",
      "Avant d'ouvrir Jèko, Compétence peut recalculer la compatibilité du professeur avec le système choisi. Si le professeur n'est pas autorisé dans ce système ou si son catalogue ne couvre pas la demande, le paiement doit être bloqué afin d'éviter une commande impossible à exécuter.",
      "Un brouillon créé avant paiement apparaît dans l'espace client. Le client peut reprendre le paiement sécurisé ou supprimer définitivement le brouillon tant qu'aucun paiement vérifié, aucune mission et aucun historique opérationnel protégé ne lui sont rattachés.",
      "Le retour du navigateur, la fermeture de la fenêtre Jèko, une capture d'écran ou une déclaration orale ne créent aucune réservation active. Le moteur attend une confirmation serveur portant sur la référence, le marchand, le moyen de paiement et le montant exact.",
      "Si le marchand affiché, le montant, le moyen, le statut serveur ou la référence ne correspondent pas au dossier attendu, Compétence peut bloquer l'activation, demander un contrôle manuel, rejeter le webhook ou demander au client de relancer un paiement propre.",
    ],
    bullets: [
      "Les créneaux standards sont organisés par blocs de 2 heures. Dans « Autre horaire », le client peut choisir 1 heure ou 2 heures ; le tarif de la séance reste identique.",
      "La réservation doit être faite au moins 24 heures avant le cours.",
      "Pour les nouvelles réservations, le paiement se fait exclusivement via Jèko. Le client choisit son moyen de paiement dans la fenêtre sécurisée Jèko. Les anciens dossiers de paiement restent conservés uniquement dans l'historique.",
      "La fenêtre de paiement officielle doit identifier Compétence.CI ou la Boutique Compétence comme marchand ou bénéficiaire attendu. Si un autre nom de boutique apparaît, notamment une boutique étrangère au service Compétence, le client doit fermer la fenêtre et reprendre le paiement depuis la plateforme.",
      "Les frais de service Compétence, fixés à 3 %, sont affichés séparément avant paiement. Ils ne remplacent pas les frais de paiement Jèko : le client paie aussi les frais Jèko correspondant au moyen choisi, lorsqu'ils s'appliquent.",
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
      "Le petit groupe comprend de 2 à 12 participants : chaque participant après le premier ajoute 50 % du prix de base. Le grand groupe commence à 13 participants : les participants 2 à 12 suivent la règle de 50 %, puis chaque participant au-delà de 12 ajoute 40 % du prix de base.",
      "Un professeur ne peut être réservé que pour les parcours, matières, classes, niveaux ou formations validés sur sa fiche. Le serveur refuse une combinaison incompatible et demande au client de choisir un autre profil.",
    ],
    bullets: [
      "Système ivoirien : CP1 à CM1 15 000 FCFA, CM2 à 4e 20 000 FCFA, 3e à 1ère 25 000 FCFA, Terminale 30 000 FCFA par séance de 2 heures.",
      "Système français : CP1 à CM1 37 500 FCFA, CM2 à 4e 50 000 FCFA, 3e à 1ère 62 500 FCFA, Terminale 75 000 FCFA par séance de 2 heures.",
      "Professionnel : 40 000 FCFA par séance de 2 heures, sauf accord écrit spécifique validé par Compétence.",
      "Les frais de déplacement, frais de service Compétence et frais de paiement Jèko applicables sont affichés séparément avant paiement et ne remplacent pas la grille officielle du cours.",
    ],
  },
  {
    title: "Réservations multi-dates et packs",
    body: [
      "Le client peut sélectionner plusieurs dates dans une même réservation et attribuer à chacune une heure disponible. Chaque date constitue une séance distincte, avec son planning, sa durée, son statut et sa preuve de paiement.",
      "Le serveur recalcule le nombre total de séances avant le paiement et applique automatiquement le meilleur palier de pack atteint. Si le nombre choisi dépasse un palier sans atteindre le suivant, la réduction du palier précédent reste applicable aux séances éligibles.",
      "Les formules et leurs réductions sont affichées avant validation. La plateforme peut proposer d'ajouter les séances manquantes pour atteindre le palier suivant, sans jamais les ajouter ni les facturer sans l'action explicite du client.",
      "Le prix, la réduction de pack, le transport par déplacement, les frais de service Compétence et les frais de paiement Jèko sont recalculés côté serveur sur l'ensemble des séances avant l'ouverture de la fenêtre de paiement.",
      "Un pack ne garantit pas la disponibilité permanente d'un professeur en dehors des dates confirmées. Toute nouvelle date, modification ou séance de remplacement reste soumise aux contrôles de compatibilité, chevauchement et déplacement.",
    ],
  },
  {
    title: "Disponibilités, horaires et modification de créneau",
    body: [
      "Les disponibilités affichées ou proposées sont des créneaux opérationnels soumis à confirmation. Le professeur confirme, signale une indisponibilité ou propose un autre créneau selon le délai restant avant le cours.",
      "Un client ne peut pas sélectionner une plage déjà payée pour le même professeur, ni une plage qui la chevauche, même partiellement. Le contrôle concerne les créneaux standards, « Autre horaire », les réservations multi-dates, les packs, les reports, les remplacements, le lancement du paiement et la confirmation webhook Jèko.",
      "Le planning réserve aussi un temps de déplacement entre deux cours selon leurs lieux réels : dernier cours confirmé du professeur puis cours demandé, et non depuis le domicile du professeur. Le délai appliqué est celui configuré par Compétence selon le format, le quartier et la commune, généralement de 30 à 90 minutes ; deux cours en ligne peuvent se suivre sans déplacement.",
      "Lorsque la marge disponible est inférieure au temps requis, le créneau est verrouillé et le client doit choisir une autre heure. Lorsque l'écart est supérieur au délai requis, aucun blocage supplémentaire n'est appliqué.",
      "Tous les contrôles sont répétés côté serveur afin qu'une modification du navigateur ou deux paiements presque simultanés ne puissent pas créer deux cours incompatibles. En cas de concurrence de paiement, seule la première confirmation valide compatible peut activer le créneau ; l'autre dossier est bloqué pour traitement, remplacement ou remboursement selon son état.",
      "Si le professeur propose un nouveau créneau, le client accepte ou refuse depuis son espace. Une absence de réponse entraîne une relance, un remplacement ou une décision du service client.",
      "À moins de 24 heures du cours, le professeur ne peut pas annuler directement la réservation. Il doit prioritairement proposer un nouveau créneau. En cas d'empêchement absolu signalé comme urgence, la réservation reste active pendant que Compétence recherche automatiquement un remplaçant compatible et soumet la proposition au client.",
      "Compétence se réserve le droit de modifier, remplacer ou annuler une attribution si la qualité du service, la sécurité, le paiement, l'adresse, la disponibilité ou la satisfaction client l'exige.",
    ],
  },
  {
    title: "Programme partenariat et apporteurs d'affaires",
    body: [
      "Compétence peut activer, suspendre, prolonger ou arrêter une campagne partenaire. Lorsqu'un code partenaire valide est vérifié avant le premier paiement, le compte client est attribué à ce partenaire pendant six mois à compter du premier paiement Jèko confirmé par le serveur.",
      "Le client bénéficie de 10 % de réduction sur le montant éligible de son premier cours. Le partenaire reçoit une commission de 10 % sur le montant éligible de chaque cours payé par ce client pendant l'attribution de six mois. Ces avantages sont financés sur la marge Compétence et ne diminuent jamais la part officielle du professeur.",
      "Les réductions et commissions excluent le transport, le matériel, les frais de service Compétence, les frais techniques Jèko, les remboursements, pénalités et tout montant hors cours. La plateforme calcule et vérifie la base côté serveur avant l'ouverture du paiement.",
      "La déclaration ne devient pas automatiquement payable. Elle devient payable uniquement lorsque le paiement a été confirmé côté serveur par Jèko et lorsque la réservation a été validée par Compétence. Un brouillon, une promesse de paiement, une capture d'écran ou une réclamation verbale ne crée aucun droit au paiement.",
      "L'apporteur fournit son identité, une pièce justificative, une photo ou un numéro de dépôt lorsque Compétence les demande afin de vérifier la cohérence de la déclaration avant tout versement. Compétence se réserve le droit de refuser, différer ou annuler une commission en cas de doute, doublon, fraude, identité incohérente, déclaration tardive ou litige.",
      "Un code ou lien ne constitue pas à lui seul une commission acquise. Une attribution ne peut pas être changée vers un autre partenaire pendant sa période active, sauf décision justifiée de Compétence en cas d'erreur, fraude ou litige. Après expiration, aucune commission nouvelle n'est due au titre de cette attribution.",
      "Une annulation, un remboursement, une rétrofacturation, un paiement frauduleux ou une commande finalement non éligible annule ou corrige la réduction et la commission correspondantes. Les contrôles d'identité, de téléphone, d'unicité du compte, de référence Jèko et d'idempotence empêchent le cumul artificiel et le double versement.",
      "Le suivi des partenariats est effectué dans le dashboard administrateur. Les paiements aux apporteurs sont des dépôts manuels ou contrôlés par Compétence et ne constituent ni un salaire, ni un emploi, ni une relation d'agence permanente.",
    ],
  },
  {
    title: "Programme Cadeaux Compétence",
    body: [
      "Compétence peut attribuer automatiquement un cadeau après certains paiements Jèko confirmés. Entre deux cadeaux, le client doit effectuer de un à trois nouveaux paiements éligibles confirmés. Les réductions sont comprises entre 8 % et 15 % et leur durée d'utilisation entre 7 et 14 jours.",
      "Le cadeau disponible est appliqué automatiquement au prochain cours éligible avant paiement. Un seul avantage s'applique par paiement ; les cadeaux ne se cumulent pas entre eux ni avec une autre réduction lorsque ce cumul dépasse la marge disponible.",
      "La réduction porte uniquement sur le cours. Le transport, le matériel, les frais de service Compétence et les frais Jèko restent dus séparément. Le professeur conserve toujours sa part officielle calculée sur le cours avant avantage client.",
      "Compétence conserve une marge minimale, peut désactiver ou modifier les étapes futures du programme et peut annuler un cadeau obtenu par fraude, double paiement, remboursement, annulation abusive ou erreur technique. Un cadeau expiré n'est ni remboursable ni convertible en espèces.",
      "Un même paiement ne peut compter qu'une fois dans la progression. Un cadeau est réservé côté serveur, appliqué une seule fois à un paiement éligible puis marqué utilisé uniquement après confirmation Jèko ; en cas d'échec ou d'abandon, il peut redevenir disponible tant qu'il reste valide.",
    ],
  },
  {
    title: "Annulation, remboursement et pénalités",
    body: [
      "Toute annulation doit être demandée depuis l'espace prévu ou par le service client, avec un motif clair. Le client est informé des règles applicables avant la confirmation de l'annulation.",
      "Avant de confirmer une annulation, le client peut demander un autre professeur. Cette demande ne constitue pas une annulation : le paiement reste sécurisé, la réservation reste active et Compétence recherche automatiquement un professeur compatible avant tout traitement manuel.",
      "Pour une annulation demandée par le client plus de 24 heures avant le début du cours, aucun frais d'annulation n'est retenu. Entre 24 heures et 6 heures avant le cours, 25 % de la base remboursable est retenu. À moins de 6 heures, 50 % est retenu. Lorsque le cours a commencé ou que son horaire est dépassé, 100 % de la base peut être retenu et le dossier est soumis au service client.",
      "La base remboursable exclut les frais de service Compétence et les frais de paiement Jèko réellement engagés. Le montant exact des frais et le remboursement estimé sont recalculés par le serveur et affichés au client avant sa confirmation.",
      "Lorsqu'une pénalité client de 25 % est appliquée, 60 % de cette pénalité compense la mobilisation du professeur et 40 % revient à la plateforme. Pour une retenue de 50 % ou un dossier de cours commencé, la répartition est de 70 % pour le professeur et 30 % pour la plateforme, sous réserve d'un litige ou d'une décision motivée du service client.",
      "Lorsque l'annulation ou l'indisponibilité est imputable au professeur, le client ne supporte aucune pénalité d'annulation. La réservation reste protégée pendant la recherche d'un remplaçant ou d'un report ; si la solution est refusée ou impossible, le client peut demander l'annulation et le remboursement de la base remboursable.",
      "Une indisponibilité professeur est horodatée dans le dossier. Une annulation tardive, une absence injustifiée, des refus répétés ou un non-respect des horaires peuvent entraîner rappel, avertissement, observation, suspension temporaire ou exclusion après examen. Aucun prélèvement financier arbitraire n'est appliqué sans décision traçable liée au dossier, au litige ou à la sanction.",
      "Des annulations client répétées, tardives ou abusives peuvent entraîner une limitation du compte ou un contrôle renforcé par le service client.",
    ],
  },
  {
    title: "Remplacement d'un professeur",
    body: [
      "Compétence peut remplacer un professeur en cas d'indisponibilité, retard, absence, litige, mauvaise qualité, suspension, erreur d'affectation ou meilleure solution disponible.",
      "Lorsqu'un professeur se déclare indisponible, le moteur de remplacement peut sélectionner automatiquement un professeur actif possédant une photo réelle, la même matière, le même niveau, un format et un créneau compatibles, sans conflit actif ni litige récent. Le client reste libre d'accepter ou de refuser cette proposition.",
      "Si le client refuse un remplaçant proposé, Compétence peut rechercher automatiquement un autre professeur compatible. Lorsque le moteur ne trouve plus de profil immédiatement disponible, le dossier est transmis au service client pour arbitrage, nouveau créneau, remplacement manuel ou remboursement selon la situation.",
      "Pour les packs, le remplacement peut porter sur une séance précise sans modifier les autres séances. Une indisponibilité signalée sur une seule séance n'emporte pas automatiquement remplacement de toute la réservation.",
      "Lorsqu'un professeur signale une indisponibilité globale sur une mission comportant plusieurs séances, Compétence peut traiter le dossier comme une indisponibilité de mission entière, sauf correction ou précision du service client.",
      "Le client est informé du remplacement lorsque celui-ci impacte la réservation. L'ancien professeur et le nouveau professeur peuvent être notifiés par le service client.",
      "Le remplacement est enregistré dans l'historique de la réservation et entraîne un recalcul opérationnel ou financier lorsque la différence est justifiée.",
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
      "À moins de 24 heures, le professeur ne peut pas annuler directement : il propose en priorité un autre créneau ou signale une urgence. Le moteur cherche alors un remplaçant compatible et le client garde le choix d'accepter, de refuser ou de demander une autre solution.",
      "Le professeur ne doit pas demander un paiement direct au client, modifier un tarif hors plateforme, récupérer une mission sans validation du service client ou utiliser les coordonnées client en dehors du cadre du cours.",
      "Le professeur accepte le contrôle qualité, les avis, les notes du service client, les avertissements, les sanctions, les suspensions, les remplacements et les décisions de paiement interne lorsque les faits le justifient.",
    ],
  },
  {
    title: "Paiement professeur",
    body: [
      "La comptabilité professeur est suivie par Compétence et consultable dans l'espace professeur. Les sommes dues sont calculées à partir des réservations payées, vérifiées, réalisées, validées, non litigieuses et libérables.",
      "Pour une réservation comprenant plusieurs séances, chaque séance possède son propre planning, son professeur affecté et son décompte. Les fonds d'une séance deviennent libérables uniquement après sa réalisation puis sa confirmation par le client; les séances futures restent bloquées.",
      "Lorsque le professeur marque une séance terminée, le client voit avant toute validation une confirmation claire indiquant que l'action libère les fonds de cette séance. S'il confirme, la plateforme enregistre son accord et rend le montant libérable sous réserve d'un contrôle de sécurité ou d'un litige déjà ouvert.",
      "Si le cours n'a pas eu lieu, s'est mal déroulé ou fait l'objet d'un désaccord, le client ne doit pas confirmer sa réalisation : il doit ouvrir un litige ou contacter le service client. Compétence peut alors maintenir le blocage, rembourser tout ou partie du client, ajuster la part professeur ou proposer un report selon les preuves et les règles applicables.",
      "Une indisponibilité, un report, un remplacement, un litige, une retenue ou un paiement concernant une séance n'affecte pas automatiquement les autres séances du pack. Les versements partiels sont imputés aux séances libérées les plus anciennes et apparaissent sur la facture de paiement.",
      "Le retrait est exécuté exclusivement par l'infrastructure Jèko vers la destination Mobile Money disponible et confirmée par le professeur. Le numéro exact et le montant sont contrôlés avant création du transfert.",
      "La saisie du mot de passe actuel du professeur est obligatoire avant l'enregistrement d'une nouvelle destination de retrait et avant chaque nouveau retrait. Cette nouvelle authentification protège le portefeuille lorsqu'une session reste ouverte sur un appareil tiers.",
      "Le professeur retire le montant net libérable validé dans son espace. Lorsque Compétence décide de prendre en charge des frais techniques de transfert, ces frais sont comptabilisés séparément et ne diminuent pas le net professeur déjà validé.",
      "Lorsqu'un professeur lance un retrait, il saisit le montant demandé et confirme le numéro exact. Jèko renvoie un statut serveur qui seul peut valider le transfert. Un retrait correctement envoyé est normalement confirmé automatiquement, avec reprise possible entre 1 heure et 72 heures ouvrées selon le réseau et les vérifications Jèko.",
      "Ce délai est prolongé en cas de litige, erreur de numéro, paiement client non vérifié, retenue, remboursement, contrôle anti-fraude, indisponibilité du moyen de paiement Jèko ou information manquante.",
      "Compétence peut suspendre, différer, retenir ou ajuster le montant libérable lorsque la réservation, la qualité, le litige, la sanction ou les fonds disponibles le justifient. L'administration ne déclenche pas le retrait à la place du professeur.",
    ],
  },
  {
    title: "Avis, qualité et modération",
    body: [
      "Les clients peuvent laisser des avis et notes lorsque le cours le permet. Le service client peut également attribuer une note qualité interne ou publique selon son contrôle opérationnel.",
      "Compétence peut masquer, corriger, refuser ou modérer un avis abusif, injurieux, mensonger, non pertinent, frauduleux ou contraire à l'intérêt du service.",
      "Les notes et avis servent à améliorer la qualité, orienter les décisions du service client, détecter les litiges et protéger les clients.",
      "Une note très faible ou un commentaire signalant une absence, une menace, un faux profil, un paiement direct, un cours non assuré ou un autre risque grave peut placer automatiquement le profil en observation et créer une alerte prioritaire. La suspension ou la sanction définitive reste soumise à l'examen de Compétence.",
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
      "Compétence peut envoyer des notifications internes, notifications push, emails, SMS, messages WhatsApp, liens privés sécurisés ou messages du service client pour gérer les réservations, paiements, confirmations, remplacements, annulations, remboursements, missions, litiges et alertes.",
      "Les notifications push nécessitent l'autorisation de l'appareil. Elles peuvent être reçues lorsque l'application web est fermée si le navigateur et le système le permettent ; l'utilisateur peut les désactiver sur l'appareil à tout moment.",
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
      "La responsabilité de Compétence n'est pas engagée pour une information fausse fournie par un utilisateur, un cas de force majeure, une indisponibilité technique externe, un incident du prestataire de paiement, une erreur de numéro fournie par le professeur ou le client, ou un comportement fautif d'une partie.",
      "Compétence se réserve le droit de suspendre temporairement un service ou une action lorsque cela est nécessaire pour la maintenance, la sécurité, la fraude, le contrôle de qualité, le litige ou la conformité.",
      "Dans la mesure autorisée par la loi, Compétence n'indemnise pas les pertes indirectes, pertes d'opportunité, pertes de revenus, dommages résultant d'un usage hors plateforme ou conséquences d'informations inexactes fournies par une partie. Pour un dommage direct prouvé relatif à une réservation, la responsabilité totale de Compétence est limitée au montant effectivement payé à Compétence pour la réservation concernée.",
      "Aucune limitation ne s'applique lorsque la loi l'interdit, notamment en cas de faute lourde ou intentionnelle établie, d'atteinte corporelle imputable ou de droit légal du consommateur non renonçable.",
    ],
  },
  {
    title: "Preuve électronique et lutte contre la fraude",
    body: [
      "Les journaux horodatés, références, statuts Jèko, signatures de webhook, transactions du montant exact, emails, validations, historiques de connexion et actions enregistrées constituent des éléments de preuve du parcours numérique dans les conditions prévues par la loi.",
      "Une page de retour, une capture d'écran, un SMS isolé, un abandon de fenêtre ou une déclaration de paiement ne valent jamais confirmation. Seule la vérification serveur du prestataire et de la transaction exacte active la réservation ou libère des coordonnées.",
      "Un webhook, une réponse API ou une opération de rapprochement qui ne correspond pas à la boutique Compétence, à la référence attendue, au moyen autorisé, au montant exact ou au statut final est ignoré, rejeté, marqué à contrôler ou bloqué sans activer la commande.",
      "Avant l'ouverture du paiement, le serveur recalcule le cours, le transport, le matériel, les frais de service, les frais Jèko, la commission, le net professeur et le total. Toute incohérence, même issue d'un formulaire ou d'un ancien brouillon, bloque l'opération et impose un nouveau calcul.",
      "Les retraits font l'objet de contrôles de mot de passe, de solde, d'allocation, de destination, de montant, de fréquence, d'identifiant unique et de preuve Jèko. Une nouvelle tentative peut être temporairement limitée lorsqu'un volume anormal est détecté, sans doubler un transfert déjà enregistré.",
      "Compétence peut geler une réservation, un remboursement, un retrait ou un compte pendant le temps strictement nécessaire à une vérification anti-fraude, à un rapprochement financier ou à la préservation de preuves.",
      "Les coordonnées directes du client et du professeur ne sont partagées entre eux qu'après confirmation serveur d'un paiement exact et rattaché à la réservation concernée.",
    ],
  },
  {
    title: "Propriété intellectuelle et contenus",
    body: [
      "La marque, l'interface, le catalogue de couvertures, les textes, règles, composants, bases de données et éléments graphiques de Compétence.CI sont protégés. Toute extraction, copie systématique, revente, imitation ou réutilisation non autorisée est interdite.",
      "Les liens publics professeurs, les aperçus sociaux et les adresses courtes Compétence.CI sont des fonctionnalités de la plateforme. Ils peuvent être utilisés pour partager un profil, mais ne peuvent pas être revendus, détournés, imités, associés à une fausse boutique ou présentés comme un domaine appartenant au professeur.",
      "L'utilisateur reste responsable des contenus qu'il fournit et garantit disposer des droits nécessaires. Il accorde à Compétence une licence non exclusive, gratuite et limitée à l'hébergement, l'optimisation, la modération et l'affichage du contenu pour fournir et promouvoir son profil ou le service.",
      "Les couvertures proposées par Compétence sont attribuées automatiquement et aléatoirement aux profils professeurs. Un professeur dispose d'outils pour proposer une couverture, une couleur ou une photo personnelle, et Compétence se réserve le droit de la refuser, la remplacer ou la retirer si elle nuit à l'image, à la cohérence pédagogique, aux droits de tiers ou à la sécurité du service.",
      "Cette licence prend fin lorsque le contenu n'est plus nécessaire, après conservation des sauvegardes, preuves, obligations légales et contenus déjà intégrés à un dossier litigieux ou financier.",
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
    title: "Contact officiel",
    body: [
      "Le contact opérationnel de référence est contact@competence.ci. Les messages envoyés au service client peuvent être conservés lorsqu'ils servent à prouver une demande, une décision, un incident, une assistance mot de passe, un paiement, un retrait, un litige ou un remboursement.",
      "Les emails techniques et de sécurité sont présentés sous le nom Compétence.CI et utilisent un canal d'envoi autorisé par la plateforme. Un changement de prestataire technique ne change ni l'identité de Compétence.CI ni le cadre contractuel.",
      "Compétence ne demande jamais à un client ou à un professeur de communiquer son mot de passe par email, téléphone, WhatsApp ou SMS.",
    ],
  },
  {
    title: "Modification des conditions",
    body: [
      "Compétence se réserve le droit de modifier les présentes conditions pour tenir compte de l'évolution du service, des tarifs, des paiements, des règles d'annulation, des obligations légales ou de la sécurité.",
      "La version publiée sur la plateforme est applicable. Une modification importante entraîne, selon son impact, une notification, une demande de nouvelle acceptation ou une limitation temporaire de certaines actions jusqu'à acceptation.",
    ],
  },
  {
    title: "Droit applicable et règlement des différends",
    body: [
      "Les présentes conditions sont soumises au droit applicable en Côte d'Ivoire.",
      "En cas de différend, les parties doivent d'abord rechercher une solution amiable via le service client Compétence. À défaut, le litige relève des juridictions compétentes d'Abidjan, sauf disposition impérative contraire.",
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
