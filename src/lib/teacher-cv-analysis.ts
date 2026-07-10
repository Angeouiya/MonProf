import { inflateRawSync } from "node:zlib";
import { extractText, getDocumentProxy } from "unpdf";

export type TeacherCvAnalysisFields = {
  fullName?: string;
  email?: string;
  phone?: string;
  commune?: string;
  quartier?: string;
  jobTitle?: string;
  bio?: string;
  experienceYears?: number;
  diploma?: string;
  careerSummary?: string;
  skills?: string;
  workHistory?: string;
  certifications?: string;
  teachingAchievements?: string;
  learnersCoached?: number;
  profileType?: "ENSEIGNANT" | "ETUDIANT" | "REPETITEUR" | "FORMATEUR" | "PROFESSIONNEL";
};

export type TeacherCvAnalysisResult = {
  fields: TeacherCvAnalysisFields;
  detectedSections: Array<{ label: string; items: string[] }>;
  generatedFields: Array<keyof TeacherCvAnalysisFields>;
  suggestedSubjects: string[];
  suggestedLevels: string[];
  missingCriticalFields: string[];
  previewText: string;
  extractedCharacters: number;
  confidence: number;
  warnings: string[];
};

const MAX_PREVIEW_CHARS = 1800;
const MAX_FIELD_CHARS = 900;
const MAX_LIST_ITEMS = 14;

const SECTION_PATTERNS = {
  summary: /^(profil|resume|résumé(?: de carrière)?|presentation|présentation|objectif|a propos|à propos|mini[- ]?cv)\b/i,
  skills: /^(competences|compétences)(?: clés?)?\b|^(savoir[- ]?faire|expertise|specialites|spécialités|matieres|matières|modules|outils?(?: & logiciels?)?|logiciels?)\b/i,
  experience: /^(experiences?|expériences?|parcours|emploi|emplois|missions?|enseignement|encadrement)\b/i,
  education: /^(formation|formations|diplomes?|diplômes?|etudes|études|cursus|universite|université)\b/i,
  certification: /^(certifications?|attestations?|preuves?|agrements?|agréments?)\b/i,
  achievement: /^(resultats?|résultats?|realisations?|réalisations?|references?|références?|encadrements?)\b/i,
};

const STOP_SECTION_PATTERN = /^(langues?|atouts?|qualités?|centres? d['’ ]intérêt|loisirs?|références?)(?:\s|$)/i;

const PROFESSIONAL_ROLE_PATTERN = /\b(ingénieur|technicien|responsable|consultant|coordinateur|superviseur|chef|conducteur|formateur|enseignant|professeur|répétiteur|coach|expert|architecte|dessinateur|artisan|gestionnaire|comptable|développeur)\b/i;

const IVOIRIAN_COMMUNES = [
  "Abobo", "Adjamé", "Anyama", "Attécoubé", "Bingerville", "Cocody", "Koumassi",
  "Marcory", "Plateau", "Port-Bouët", "Songon", "Treichville", "Yopougon",
];

const SUBJECT_HINTS = [
  "Mathématiques", "Français", "Anglais", "Physique-Chimie", "SVT", "Informatique",
  "Philosophie", "Histoire-Géographie", "Comptabilité", "Économie", "Droit",
  "Génie civil", "Couture", "Pâtisserie", "Électricité", "Plomberie", "Marketing",
  "Communication", "Design", "Bureautique", "Programmation",
];

const SKILL_HINTS = [
  "Préparation BAC", "Préparation BEPC", "Préparation concours", "Remise à niveau",
  "Cours à domicile", "Cours en ligne", "Pédagogie active", "Suivi parental",
  "Méthodologie", "Exercices corrigés", "Formation professionnelle", "Coaching",
  "Encadrement adulte", "Gestion de projet", "Excel", "Word", "PowerPoint",
  "Python", "JavaScript", "AutoCAD", "Lecture de plans", "Communication orale",
];

export async function analyzeTeacherCv(input: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}): Promise<TeacherCvAnalysisResult> {
  const warnings: string[] = [];
  const text = normalizeExtractedText(await extractCvText(input.buffer, input.filename, input.mimeType, warnings));
  if (text.length < 80) {
    warnings.push("Texte exploitable insuffisant. Le CV est peut-être scanné en image ou protégé.");
  }

  const lines = toLogicalLines(text).slice(0, 260);
  const sections = collectSections(lines);
  const { fields, generatedFields, subjectList } = buildTeacherFields(lines, sections);
  addCompletenessWarnings(fields, warnings, text);
  const detectedSections = buildDetectedSections(sections, fields);
  const confidence = computeConfidence(fields, text.length);
  const suggestedSubjects = suggestSubjects(subjectList);
  const suggestedLevels = suggestLevels(text, fields.profileType);
  const missingCriticalFields = findMissingCriticalFields(fields);

  return {
    fields,
    detectedSections,
    generatedFields,
    suggestedSubjects,
    suggestedLevels,
    missingCriticalFields,
    previewText: text.slice(0, MAX_PREVIEW_CHARS),
    extractedCharacters: text.length,
    confidence,
    warnings,
  };
}

async function extractCvText(buffer: Buffer, filename: string, mimeType: string, warnings: string[]) {
  const lowerName = filename.toLowerCase();
  if (mimeType.includes("text") || lowerName.endsWith(".txt") || lowerName.endsWith(".md")) {
    return decodeBuffer(buffer);
  }
  if (mimeType.includes("wordprocessingml") || lowerName.endsWith(".docx")) {
    const xml = extractDocxDocumentXml(buffer);
    if (!xml) {
      warnings.push("DOCX non lisible : impossible d'extraire word/document.xml.");
      return "";
    }
    return textFromDocxXml(xml);
  }
  if (mimeType.includes("pdf") || lowerName.endsWith(".pdf")) {
    const extracted = await extractPdfText(buffer, warnings);
    if (extracted.length < 80) {
      warnings.push("PDF partiellement lisible. Si le CV est scanné, convertissez-le en PDF texte ou DOCX.");
    }
    return extracted;
  }
  warnings.push("Format traité en mode texte brut. Utilisez PDF texte, DOCX, TXT ou MD pour de meilleurs résultats.");
  return decodeBuffer(buffer);
}

function decodeBuffer(buffer: Buffer) {
  return buffer.toString("utf8").replace(/\u0000/g, " ");
}

function extractDocxDocumentXml(buffer: Buffer) {
  let offset = 0;
  while (offset + 30 < buffer.length) {
    const signature = buffer.readUInt32LE(offset);
    if (signature !== 0x04034b50) {
      offset += 1;
      continue;
    }
    const method = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const filenameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const filenameStart = offset + 30;
    const filename = buffer.subarray(filenameStart, filenameStart + filenameLength).toString("utf8");
    const dataStart = filenameStart + filenameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    if (filename === "word/document.xml") {
      const payload = buffer.subarray(dataStart, dataEnd);
      if (method === 0) return payload.toString("utf8");
      if (method === 8) return inflateRawSync(payload).toString("utf8");
      return "";
    }
    offset = dataEnd;
  }
  return "";
}

function textFromDocxXml(xml: string) {
  return decodeXmlEntities(
    xml
      .replace(/<\/w:p>/g, "\n")
      .replace(/<w:tab\/>/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+\n/g, "\n"),
  );
}

async function extractPdfText(buffer: Buffer, warnings: string[]) {
  let pdf: Awaited<ReturnType<typeof getDocumentProxy>> | undefined;
  try {
    pdf = await getDocumentProxy(new Uint8Array(buffer));
    const result = await extractText(pdf, { mergePages: false });
    return result.text.join("\n");
  } catch {
    warnings.push("Le moteur PDF n'a pas pu lire ce document. Vérifiez qu'il n'est ni protégé ni corrompu.");
    return "";
  } finally {
    await pdf?.destroy().catch(() => undefined);
  }
}

function normalizeExtractedText(text: string) {
  return decodeXmlEntities(text)
    .replace(/\r/g, "\n")
    .replace(/[•●▪◦]/g, "\n- ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanLine(line: string) {
  return line.replace(/^[-–—*·\s]+/, "").replace(/\s+/g, " ").trim();
}

function toLogicalLines(text: string) {
  const result: string[] = [];
  let continuingBullet = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const raw = rawLine.replace(/\s+/g, " ").trim();
    if (!raw) continue;
    const startsBullet = /^[-*·]\s+/.test(raw);
    const line = cleanLine(raw);
    if (line.length < 3) continue;
    const heading = detectSection(line) || STOP_SECTION_PATTERN.test(normalizeForSearch(line)) || /^projets? s[eé]lectionn[eé]s?\b/i.test(line);
    if (continuingBullet && !startsBullet && !heading && !PROFESSIONAL_ROLE_PATTERN.test(line)) {
      result[result.length - 1] = `${result[result.length - 1]} ${line}`.slice(0, 360);
      continue;
    }
    result.push(line);
    continuingBullet = startsBullet;
  }
  return result;
}

function collectSections(lines: string[]) {
  const sections: Record<keyof typeof SECTION_PATTERNS, string[]> = {
    summary: [],
    skills: [],
    experience: [],
    education: [],
    certification: [],
    achievement: [],
  };
  let current: keyof typeof SECTION_PATTERNS | null = null;
  for (const line of lines) {
    const detected = detectSection(line);
    if (detected) {
      current = detected;
      continue;
    }
    if (STOP_SECTION_PATTERN.test(normalizeForSearch(line))) {
      current = null;
      continue;
    }
    if (current && sections[current].length < 80) {
      sections[current].push(line);
    }
  }
  return sections;
}

function detectSection(line: string): keyof typeof SECTION_PATTERNS | null {
  if (line.length > 65) return null;
  return (Object.keys(SECTION_PATTERNS) as Array<keyof typeof SECTION_PATTERNS>)
    .find((key) => SECTION_PATTERNS[key].test(normalizeForSearch(line))) ?? null;
}

function buildTeacherFields(lines: string[], sections: Record<keyof typeof SECTION_PATTERNS, string[]>) {
  const allText = lines.join("\n");
  const identity = detectIdentity(lines, allText);
  const profileType = detectProfileType(allText);
  const subjectEvidence = [
    ...lines.slice(0, 8),
    ...sections.summary,
    ...sections.skills,
    ...sections.education,
  ].join("\n");
  const subjectList = findKnownTerms(subjectEvidence, SUBJECT_HINTS);
  const explicitSkillText = normalizeForSearch(sections.skills.join(" "));
  const hintedSkills = findKnownTerms(allText, SKILL_HINTS)
    .filter((term) => !explicitSkillText.includes(normalizeForSearch(term)));
  const skillList = uniqueLines([
    ...sections.skills,
    ...hintedSkills,
    ...(profileType === "PROFESSIONNEL" ? [] : subjectList.map((subject) => `Enseignement ${subject}`)),
  ]).slice(0, MAX_LIST_ITEMS);
  const experienceLines = extractProfessionalExperiences(sections.experience);
  const certificationLines = uniqueLines([
    ...sections.certification,
    ...sections.education.filter((line) => /\b(master|licence|doctorat|bts|bac(?:\+\d)?|certificat|certification|dipl[oô]me|attestation|universit|école|ecole|institut)\b/i.test(line)),
    ...lines.filter((line) => /\b(master|licence|doctorat|bts|bac\s*\+\s*\d|certificat|certification|dipl[oô]me|attestation)\b/i.test(line)),
  ]).slice(0, 8);
  const achievementLines = uniqueLines([
    ...sections.achievement,
    ...lines.filter((line) => /\b(r[eé]ussite|progression|admis|admission|[0-9]+\s*(?:eleves|élèves|apprenants|etudiants|étudiants|personnes|logements|immeubles|localités)|programme résidentiel|cité résidentielle|immobilier (?:privé|résidentiel))\b/i.test(line)),
  ]).slice(0, 8);
  const summaryLines = uniqueLines(sections.summary).slice(0, 4);
  const experienceYears = detectExperienceYears(allText);
  const learnersCoached = detectLearnersCoached(allText);
  const jobTitle = detectJobTitle(lines, subjectList, identity.fullName);
  const diploma = detectPrimaryDiploma(certificationLines.length ? certificationLines : sections.education);
  const extractedSummary = toParagraph(summaryLines);
  const generatedBiography = buildEvidenceBasedBiography({
    fullName: identity.fullName,
    jobTitle,
    profileType,
    experienceYears,
    subjects: subjectList,
    skills: skillList,
    workHistory: experienceLines,
    diploma,
    commune: identity.commune,
  });
  const careerSummary = buildCareerSummary(extractedSummary, generatedBiography);
  const generatedFields: Array<keyof TeacherCvAnalysisFields> = [];
  if (careerSummary && (!extractedSummary || extractedSummary.length < 110)) {
    generatedFields.push("careerSummary", "bio");
  }

  const fields = compactFields({
    ...identity,
    jobTitle,
    bio: careerSummary,
    experienceYears,
    diploma,
    careerSummary,
    skills: toList(skillList),
    workHistory: toList(experienceLines),
    certifications: toList(certificationLines),
    teachingAchievements: toList(achievementLines),
    learnersCoached,
    profileType,
  });
  return { fields, generatedFields, subjectList };
}

function detectExperienceYears(text: string) {
  const matches = Array.from(text.matchAll(/(\d{1,2})\s*(?:\+?\s*)?(ans|annees|années)(?:\s+et\s+\d{1,2}\s+mois)?\s+(?:d['’]\s*)?(experience|expérience|enseignement|encadrement|pratique)/gi));
  const values = matches.map((match) => Number(match[1])).filter((value) => Number.isFinite(value) && value >= 0 && value <= 50);
  return values.length ? Math.max(...values) : undefined;
}

function detectLearnersCoached(text: string) {
  const matches = Array.from(text.matchAll(/(\d{2,5})\s*(eleves|élèves|apprenants|etudiants|étudiants|personnes|adultes)/gi));
  const values = matches.map((match) => Number(match[1])).filter((value) => Number.isFinite(value) && value > 0 && value < 100000);
  return values.length ? Math.max(...values) : undefined;
}

function detectJobTitle(lines: string[], subjects: string[], fullName?: string) {
  const header = lines.slice(0, 8).find((line) => (
    line !== fullName
    && PROFESSIONAL_ROLE_PATTERN.test(line)
    && line.length <= 140
    && !/^(email|téléphone|telephone|localisation|mobilité)\b/i.test(line)
  ));
  if (header) return titleCaseProfessional(header);
  const direct = lines.find((line) => PROFESSIONAL_ROLE_PATTERN.test(line) && line.length <= 90);
  if (direct) return titleCaseProfessional(direct);
  if (subjects[0]) return `Professeur de ${subjects[0]}`;
  return undefined;
}

function detectIdentity(lines: string[], text: string) {
  const fullName = lines.slice(0, 5).find((line) => (
    /^[A-Za-zÀ-ÿ'’-]+(?:\s+[A-Za-zÀ-ÿ'’-]+){1,4}$/.test(line)
    && !PROFESSIONAL_ROLE_PATTERN.test(line)
  ));
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLowerCase();
  const phoneRaw = text.match(/(?:t[eé]l[eé]phone|mobile|contact)\s*:\s*(\+?\d[\d\s().-]{7,20}\d)/i)?.[1];
  const phone = phoneRaw ? formatIvorianPhone(phoneRaw) : undefined;
  const locationLine = lines.find((line) => /^(localisation|adresse|lieu de r[eé]sidence)\s*:/i.test(line));
  const location = locationLine?.replace(/^[^:]+:\s*/, "").trim();
  const commune = location
    ? IVOIRIAN_COMMUNES.find((candidate) => normalizeForSearch(location).includes(normalizeForSearch(candidate)))
    : undefined;
  const locationParts = location?.split(",").map((part) => part.trim()).filter(Boolean) ?? [];
  const quartier = commune
    ? locationParts.find((part) => normalizeForSearch(part).includes(normalizeForSearch(commune)) && normalizeForSearch(part) !== normalizeForSearch(commune))
    : undefined;
  return compactFields({ fullName, email, phone, commune, quartier });
}

function formatIvorianPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  const local = digits.startsWith("225") ? digits.slice(3) : digits;
  if (local.length !== 10) return value.replace(/\s+/g, " ").trim();
  return `+225 ${local.slice(0, 2)} ${local.slice(2, 4)} ${local.slice(4, 6)} ${local.slice(6, 8)} ${local.slice(8, 10)}`;
}

function extractProfessionalExperiences(lines: string[]) {
  const experiences: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanLine(lines[index]);
    if (!PROFESSIONAL_ROLE_PATTERN.test(line) || line.length > 180) continue;
    let role = line;
    let next = cleanLine(lines[index + 1] ?? "");
    const afterNext = cleanLine(lines[index + 2] ?? "");
    if (next && !/\b(19\d{2}|20\d{2}|depuis|pr[eé]sent|janvier|f[eé]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[eé]cembre|abidjan|soubr[eé]|yamoussoukro|bouak[eé])\b/i.test(next)
      && /\b(19\d{2}|20\d{2}|depuis|pr[eé]sent|janvier|f[eé]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[eé]cembre|abidjan|soubr[eé]|yamoussoukro|bouak[eé])\b/i.test(afterNext)) {
      role = `${role} ${next}`;
      next = afterNext;
    }
    const hasDateOrLocation = /\b(19\d{2}|20\d{2}|depuis|pr[eé]sent|janvier|f[eé]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[eé]cembre|abidjan|soubr[eé]|yamoussoukro|bouak[eé])\b/i.test(next);
    experiences.push(hasDateOrLocation ? `${role} | ${next}` : role);
  }
  const unique = uniqueLines(experiences).slice(0, 10);
  return unique.length ? unique : uniqueLines(lines).slice(0, MAX_LIST_ITEMS);
}

function detectPrimaryDiploma(lines: string[]) {
  const scored = uniqueLines(lines).map((line) => {
    const normalized = normalizeForSearch(line);
    let score = 0;
    if (/doctorat|phd/.test(normalized)) score = 100;
    else if (/bac\+?5|master|diplome d[' ]ingenieur/.test(normalized)) score = 90;
    else if (/bac\+?4|diplome de maitrise/.test(normalized)) score = 80;
    else if (/bac\+?3|licence/.test(normalized)) score = 70;
    else if (/bts|dut|bac\+?2/.test(normalized)) score = 60;
    else if (/bac\b/.test(normalized)) score = 40;
    else if (/certificat|certification|attestation/.test(normalized)) score = 30;
    return { line, score };
  });
  return scored.sort((a, b) => b.score - a.score)[0]?.line;
}

function addCompletenessWarnings(fields: TeacherCvAnalysisFields, warnings: string[], text: string) {
  if (!fields.jobTitle) warnings.push("Titre professionnel non détecté : complétez-le manuellement.");
  if (!fields.skills) warnings.push("Compétences non détectées : vérifiez le document.");
  if (!fields.workHistory) warnings.push("Expériences non détectées : complétez le parcours manuellement.");
  if (!fields.diploma) warnings.push("Diplôme principal non détecté.");
  if (fields.learnersCoached === undefined) {
    warnings.push("Nombre d'apprenants encadrés non indiqué dans le CV : ce champ reste à confirmer manuellement.");
  }
  const preciseDuration = text.match(/(\d{1,2})\s*ans?\s+et\s+(\d{1,2})\s+mois/i);
  if (preciseDuration && fields.experienceYears !== undefined) {
    warnings.push(`Durée exacte détectée : ${preciseDuration[1]} ans et ${preciseDuration[2]} mois. Le champ numérique conserve ${fields.experienceYears} années entières et le mini CV garde le détail.`);
  }
}

function detectProfileType(text: string): TeacherCvAnalysisFields["profileType"] {
  if (/\b(formateur|formation professionnelle|atelier|entreprise)\b/i.test(text)) return "FORMATEUR";
  if (/\b(consultant|expert|professionnel|technicien|artisan)\b/i.test(text)) return "PROFESSIONNEL";
  if (/\b(r[eé]p[eé]titeur|soutien scolaire)\b/i.test(text)) return "REPETITEUR";
  if (/\b(etudiant|étudiant)\b/i.test(text)) return "ETUDIANT";
  return "ENSEIGNANT";
}

function buildCareerSummary(extractedSummary?: string, generatedBiography?: string) {
  if (extractedSummary && extractedSummary.length >= 110) return extractedSummary;
  if (!generatedBiography) return extractedSummary;
  if (!extractedSummary || normalizeForSearch(generatedBiography).includes(normalizeForSearch(extractedSummary))) {
    return generatedBiography;
  }
  return `${extractedSummary.replace(/[.!?]+$/, "")}. ${generatedBiography}`.slice(0, MAX_FIELD_CHARS);
}

function buildEvidenceBasedBiography({
  fullName,
  jobTitle,
  profileType,
  experienceYears,
  subjects,
  skills,
  workHistory,
  diploma,
  commune,
}: {
  fullName?: string;
  jobTitle?: string;
  profileType?: TeacherCvAnalysisFields["profileType"];
  experienceYears?: number;
  subjects: string[];
  skills: string[];
  workHistory: string[];
  diploma?: string;
  commune?: string;
}) {
  const sentences: string[] = [];
  const identity = fullName || "Ce profil";
  const role = jobTitle || profileTypeLabel(profileType);
  if (role) {
    sentences.push(`${identity} présente un parcours de ${lowercaseFirst(role)}${commune ? ` basé à ${commune}` : ""}.`);
  } else if (commune) {
    sentences.push(`${identity} présente un parcours professionnel basé à ${commune}.`);
  }

  const domains = uniqueLines([
    ...subjects,
    ...skills.filter((skill) => skill.length <= 90),
  ]).slice(0, 4);
  if (domains.length) {
    sentences.push(`Ses compétences documentées couvrent ${joinFrench(domains)}.`);
  }
  if (experienceYears !== undefined && experienceYears > 0) {
    sentences.push(`Le CV fait état de ${experienceYears} année${experienceYears > 1 ? "s" : ""} d'expérience.`);
  } else if (workHistory.length) {
    sentences.push(`Son expérience comprend notamment ${lowercaseFirst(trimExperienceForBiography(workHistory[0]))}.`);
  }
  if (diploma) {
    sentences.push(`Formation principale mentionnée : ${diploma.replace(/[.!?]+$/, "")}.`);
  }
  return sentences.length ? sentences.join(" ").slice(0, MAX_FIELD_CHARS) : undefined;
}

function profileTypeLabel(value?: TeacherCvAnalysisFields["profileType"]) {
  if (value === "FORMATEUR") return "formateur";
  if (value === "PROFESSIONNEL") return "professionnel";
  if (value === "REPETITEUR") return "répétiteur";
  if (value === "ETUDIANT") return "étudiant";
  if (value === "ENSEIGNANT") return "enseignant";
  return undefined;
}

function trimExperienceForBiography(value: string) {
  return value.split("|")[0]?.replace(/[—–-]\s*(depuis\s+)?(?:19|20)\d{2}.*$/i, "").trim() || value;
}

function lowercaseFirst(value: string) {
  const cleaned = value.trim().replace(/[.!?]+$/, "");
  return cleaned ? cleaned.charAt(0).toLocaleLowerCase("fr-FR") + cleaned.slice(1) : cleaned;
}

function joinFrench(values: string[]) {
  if (values.length <= 1) return values[0] ?? "";
  return `${values.slice(0, -1).join(", ")} et ${values.at(-1)}`;
}

function suggestSubjects(alreadyDetected: string[]) {
  return uniqueLines(alreadyDetected).slice(0, 10);
}

function suggestLevels(text: string, profileType?: TeacherCvAnalysisFields["profileType"]) {
  const normalized = normalizeForSearch(text);
  const levels: string[] = [];
  if (/\bcepe\b|\bprimaire\b|\bcp[12]?\b|\bce[12]\b|\bcm[12]\b/.test(normalized)) levels.push("Primaire");
  if (/\bbepc\b|\bcollege\b|\b6e\b|\b5e\b|\b4e\b|\b3e\b/.test(normalized)) levels.push("Collège", "BEPC");
  if (/\bbac\b(?!\s*\+)|\blycee\b|\bseconde\b|\bpremiere\b|\bterminale\b/.test(normalized)) levels.push("Lycée", "BAC");
  if (/\bbts\b/.test(normalized)) levels.push("BTS");
  if (/\blicence\b|\bbac\+?3\b/.test(normalized)) levels.push("Licence");
  if (/\bmaster\b|\bbac\+?[45]\b|\bingenieur\b/.test(normalized)) levels.push("Master", "Université");
  if (/\bconcours\b/.test(normalized)) levels.push("Concours");
  if (/\badulte\b|\bprofessionnel\b|\bentreprise\b/.test(normalized) || profileType === "PROFESSIONNEL") {
    levels.push("Adultes", "Professionnels");
  }
  return uniqueLines(levels).slice(0, 8);
}

function findMissingCriticalFields(fields: TeacherCvAnalysisFields) {
  const required: Array<[keyof TeacherCvAnalysisFields, string]> = [
    ["jobTitle", "Titre professionnel"],
    ["careerSummary", "Biographie professionnelle"],
    ["skills", "Compétences"],
    ["workHistory", "Expériences"],
    ["diploma", "Diplôme principal"],
  ];
  return required.filter(([key]) => !fields[key]).map(([, label]) => label);
}

function findKnownTerms(text: string, terms: string[]) {
  const normalizedText = normalizeForSearch(text);
  return terms.filter((term) => normalizedText.includes(normalizeForSearch(term)));
}

function uniqueLines(lines: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const line of lines.map(cleanLine).filter(Boolean)) {
    const key = normalizeForSearch(line);
    if (seen.has(key) || key.length < 3) continue;
    seen.add(key);
    result.push(line.slice(0, 180));
  }
  return result;
}

function toList(lines: string[]) {
  return uniqueLines(lines).slice(0, MAX_LIST_ITEMS).join("\n");
}

function toParagraph(lines: string[]) {
  const paragraph = uniqueLines(lines).join(" ");
  return paragraph ? paragraph.slice(0, MAX_FIELD_CHARS) : undefined;
}

function firstUsefulLine(lines: string[]) {
  return uniqueLines(lines).find((line) => line.length >= 4 && line.length <= 160);
}

function compactFields(fields: TeacherCvAnalysisFields) {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => {
      if (typeof value === "string") return value.trim().length > 0;
      return value !== undefined && value !== null;
    }),
  ) as TeacherCvAnalysisFields;
}

function buildDetectedSections(sections: Record<keyof typeof SECTION_PATTERNS, string[]>, fields: TeacherCvAnalysisFields) {
  return [
    { label: "Mini CV", items: fields.careerSummary ? [fields.careerSummary] : sections.summary },
    { label: "Compétences", items: fields.skills?.split("\n") ?? sections.skills },
    { label: "Parcours", items: fields.workHistory?.split("\n") ?? sections.experience },
    { label: "Diplômes / preuves", items: fields.certifications?.split("\n") ?? sections.certification },
    { label: "Résultats", items: fields.teachingAchievements?.split("\n") ?? sections.achievement },
  ].map((section) => ({
    label: section.label,
    items: uniqueLines(section.items).slice(0, 6),
  })).filter((section) => section.items.length > 0);
}

function computeConfidence(fields: TeacherCvAnalysisFields, extractedCharacters: number) {
  const weightedChecks: Array<[unknown, number]> = [
    [fields.jobTitle, 16], [fields.careerSummary, 14], [fields.skills, 16],
    [fields.workHistory, 18], [fields.diploma, 12], [fields.profileType, 6],
    [fields.fullName, 6], [fields.email || fields.phone, 5], [fields.teachingAchievements, 4],
  ];
  const filledScore = weightedChecks.reduce((total, [value, weight]) => total + (value ? weight : 0), 0);
  const textScore = extractedCharacters > 1200 ? 3 : extractedCharacters > 400 ? 2 : 0;
  return Math.min(93, Math.max(15, filledScore + textScore));
}

function normalizeForSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function titleCaseProfessional(value: string) {
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}
