import { COURSE_CATALOG } from "./course-catalog";
import { MANAGED_CLASSES } from "./managed-courses-core";
export type ManagedSchoolSubject = { id: string; name: string; programmes: string[] };
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
function matchesClass(level: string, className: string) {
  const name = normalize(level);
  if (className === "Seconde") return /^(2nde|seconde)( |$)/.test(name);
  if (className === "Première") return /^(1ere|premiere)( |$)/.test(name);
  if (className === "Terminale") return /^terminale( |$)/.test(name);
  return name === normalize(className);
}
const school = COURSE_CATALOG.filter((course) => course.actif && course.categorie === "soutien_scolaire"
  && ["ivoirien", "francais"].includes(course.systeme_scolaire ?? "")
  && MANAGED_CLASSES.some((className) => matchesClass(course.niveau ?? "", className)));
export const managedSchoolSubjectNames = [...new Set(school.map((course) => course.matiere_ou_competence))];
const programmesByName = new Map<string, Set<string>>();
for (const course of school) {
  const name = normalize(course.matiere_ou_competence);
  const programmes = programmesByName.get(name) ?? new Set<string>();
  for (const className of MANAGED_CLASSES) {
    if (matchesClass(course.niveau ?? "", className)) programmes.add(`${course.systeme_scolaire}:${className}`);
  }
  programmesByName.set(name, programmes);
}
export function isManagedSchoolSubject(name: string, journey: string, className: string) {
  return programmesByName.get(normalize(name))?.has(`${journey}:${className}`) ?? false;
}
export function managedSchoolSubjectOptions(rows: { id: string; name: string }[]): ManagedSchoolSubject[] {
  return rows.map((subject) => ({ ...subject, programmes: [...(programmesByName.get(normalize(subject.name)) ?? [])] }))
    .filter((subject) => subject.programmes.length > 0);
}
