import { inflateRawSync } from "node:zlib";

export type TeacherCvAnalysisFields = {
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
  previewText: string;
  extractedCharacters: number;
  confidence: number;
  warnings: string[];
};

const MAX_PREVIEW_CHARS = 1800;
const MAX_FIELD_CHARS = 900;
const MAX_LIST_ITEMS = 8;

const SECTION_PATTERNS = {
  summary: /^(profil|resume|résumé|presentation|présentation|objectif|a propos|à propos|mini[- ]?cv)\b/i,
  skills: /^(competences|compétences|savoir[- ]?faire|expertise|specialites|spécialités|matieres|matières|modules)\b/i,
  experience: /^(experiences?|expériences?|parcours|emploi|emplois|missions?|enseignement|encadrement)\b/i,
  education: /^(formation|formations|diplomes?|diplômes?|etudes|études|cursus|universite|université)\b/i,
  certification: /^(certifications?|attestations?|preuves?|agrements?|agréments?)\b/i,
  achievement: /^(resultats?|résultats?|realisations?|réalisations?|references?|références?|encadrements?)\b/i,
};

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
  const text = normalizeExtractedText(extractCvText(input.buffer, input.filename, input.mimeType, warnings));
  if (text.length < 80) {
    warnings.push("Texte exploitable insuffisant. Le CV est peut-être scanné en image ou protégé.");
  }

  const lines = text
    .split(/\r?\n/)
    .map(cleanLine)
    .filter((line) => line.length >= 3)
    .slice(0, 260);
  const sections = collectSections(lines);
  const fields = buildTeacherFields(lines, sections);
  const detectedSections = buildDetectedSections(sections, fields);
  const confidence = computeConfidence(fields, text.length);

  return {
    fields,
    detectedSections,
    previewText: text.slice(0, MAX_PREVIEW_CHARS),
    extractedCharacters: text.length,
    confidence,
    warnings,
  };
}

function extractCvText(buffer: Buffer, filename: string, mimeType: string, warnings: string[]) {
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
    const extracted = extractPdfText(buffer);
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

function extractPdfText(buffer: Buffer) {
  const raw = buffer.toString("latin1");
  const chunks: string[] = [raw];
  const streamRegex = /<<(?:.|\n|\r)*?>>\s*stream\r?\n?([\s\S]*?)\r?\n?endstream/g;
  let match: RegExpExecArray | null;
  while ((match = streamRegex.exec(raw))) {
    const dictionary = match[0].slice(0, Math.max(0, match[0].indexOf("stream")));
    if (!dictionary.includes("/FlateDecode")) continue;
    try {
      chunks.push(inflateRawSync(Buffer.from(match[1], "latin1")).toString("latin1"));
    } catch {
      // Ignore unreadable PDF streams; the raw pass below may still find usable text.
    }
  }

  return chunks
    .map((chunk) => {
      const strings = Array.from(chunk.matchAll(/\((?:\\.|[^\\)]){2,}\)\s*Tj/g))
        .map((item) => decodePdfLiteral(item[0].replace(/\)\s*Tj$/, "").slice(1, -1)));
      const arrays = Array.from(chunk.matchAll(/\[([\s\S]*?)\]\s*TJ/g))
        .flatMap((item) => Array.from(item[1].matchAll(/\((?:\\.|[^\\)])+\)/g)).map((part) => decodePdfLiteral(part[0].slice(1, -1))));
      const fallback = Array.from(chunk.matchAll(/[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9'’.,:;()\/+\- ]{8,}/g)).map((item) => item[0]);
      return [...strings, ...arrays, ...fallback].join("\n");
    })
    .join("\n");
}

function decodePdfLiteral(value: string) {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .replace(/\\t/g, " ")
    .replace(/\\([()\\])/g, "$1")
    .replace(/\\(\d{3})/g, (_, octal: string) => String.fromCharCode(parseInt(octal, 8)));
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
    if (current && sections[current].length < 18) {
      sections[current].push(line);
    }
  }
  return sections;
}

function detectSection(line: string): keyof typeof SECTION_PATTERNS | null {
  return (Object.keys(SECTION_PATTERNS) as Array<keyof typeof SECTION_PATTERNS>)
    .find((key) => SECTION_PATTERNS[key].test(normalizeForSearch(line))) ?? null;
}

function buildTeacherFields(lines: string[], sections: Record<keyof typeof SECTION_PATTERNS, string[]>) {
  const allText = lines.join("\n");
  const subjectList = findKnownTerms(allText, SUBJECT_HINTS);
  const skillList = uniqueLines([
    ...sections.skills,
    ...findKnownTerms(allText, SKILL_HINTS),
    ...subjectList.map((subject) => `Enseignement ${subject}`),
  ]).slice(0, MAX_LIST_ITEMS);
  const experienceLines = uniqueLines([
    ...sections.experience,
    ...lines.filter((line) => /\b(20\d{2}|19\d{2}|professeur|enseignant|formateur|encadr|cours|lycee|lycée|college|collège|universit|cabinet|centre)\b/i.test(line)),
  ]).slice(0, MAX_LIST_ITEMS);
  const certificationLines = uniqueLines([
    ...sections.certification,
    ...sections.education.filter((line) => /\b(master|licence|doctorat|bts|bac|certificat|dipl[oô]me|attestation|universit|école|ecole)\b/i.test(line)),
  ]).slice(0, 6);
  const achievementLines = uniqueLines([
    ...sections.achievement,
    ...lines.filter((line) => /\b(r[eé]ussite|progression|admis|admission|bac|bepc|concours|[0-9]+\s*(eleves|élèves|apprenants|etudiants|étudiants|personnes))\b/i.test(line)),
  ]).slice(0, 6);
  const summaryLines = uniqueLines([
    ...sections.summary,
    ...lines.filter((line) => /\b(professeur|enseignant|formateur|p[eé]dagogie|exp[eé]rience|sp[eé]cialiste)\b/i.test(line)),
  ]).slice(0, 4);
  const experienceYears = detectExperienceYears(allText);
  const learnersCoached = detectLearnersCoached(allText);
  const jobTitle = detectJobTitle(lines, subjectList);
  const diploma = firstUsefulLine(certificationLines) || firstUsefulLine(sections.education);
  const profileType = detectProfileType(allText);
  const careerSummary = toParagraph(summaryLines) || buildFallbackSummary(jobTitle, experienceYears, subjectList);

  return compactFields({
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
}

function detectExperienceYears(text: string) {
  const matches = Array.from(text.matchAll(/(\d{1,2})\s*(?:\+?\s*)?(ans|annees|années)\s+(?:d['’]\s*)?(experience|expérience|enseignement|encadrement|pratique)/gi));
  const values = matches.map((match) => Number(match[1])).filter((value) => Number.isFinite(value) && value >= 0 && value <= 50);
  return values.length ? Math.max(...values) : undefined;
}

function detectLearnersCoached(text: string) {
  const matches = Array.from(text.matchAll(/(\d{2,5})\s*(eleves|élèves|apprenants|etudiants|étudiants|personnes|adultes)/gi));
  const values = matches.map((match) => Number(match[1])).filter((value) => Number.isFinite(value) && value > 0 && value < 100000);
  return values.length ? Math.max(...values) : undefined;
}

function detectJobTitle(lines: string[], subjects: string[]) {
  const direct = lines.find((line) => /\b(professeur|enseignant|formateur|r[eé]p[eé]titeur|coach|consultant)\b/i.test(line) && line.length <= 90);
  if (direct) return titleCaseProfessional(direct);
  if (subjects[0]) return `Professeur de ${subjects[0]}`;
  return undefined;
}

function detectProfileType(text: string): TeacherCvAnalysisFields["profileType"] {
  if (/\b(formateur|formation professionnelle|atelier|entreprise)\b/i.test(text)) return "FORMATEUR";
  if (/\b(consultant|expert|professionnel|technicien|artisan)\b/i.test(text)) return "PROFESSIONNEL";
  if (/\b(r[eé]p[eé]titeur|soutien scolaire)\b/i.test(text)) return "REPETITEUR";
  if (/\b(etudiant|étudiant)\b/i.test(text)) return "ETUDIANT";
  return "ENSEIGNANT";
}

function buildFallbackSummary(jobTitle?: string, experienceYears?: number, subjects: string[] = []) {
  const parts = [
    jobTitle,
    experienceYears ? `${experienceYears} ans d'expérience` : undefined,
    subjects.length ? `spécialisé en ${subjects.slice(0, 3).join(", ")}` : undefined,
  ].filter(Boolean);
  return parts.length ? `${parts.join(", ")}. Profil à vérifier et enrichir par l'administration.` : undefined;
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
  const filled = Object.values(fields).filter((value) => value !== undefined && value !== "").length;
  const base = Math.min(95, Math.max(20, filled * 11));
  const textBonus = extractedCharacters > 900 ? 10 : extractedCharacters > 350 ? 5 : 0;
  return Math.min(98, base + textBonus);
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
