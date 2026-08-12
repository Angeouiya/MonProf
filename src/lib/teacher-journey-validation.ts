import { filterLevelsForJourney, filterSubjectsForJourney } from "@/lib/catalog-journey";
import {
  TEACHER_JOURNEY_CONFIG,
  teacherEligibleJourneys,
  type TeacherJourney,
  type TeacherJourneyEligibility,
} from "@/lib/teacher-journeys";

export type TeacherJourneyCatalogSubject = {
  name: string;
  icon?: string | null;
};

export type TeacherJourneyCatalogLevel = {
  name: string;
  order?: number | null;
};

export type TeacherJourneyCatalogIssue = {
  journey: TeacherJourney;
  label: string;
  hasSubject: boolean;
  hasLevel: boolean;
};

export function teacherJourneyCatalogIssues({
  eligibility,
  subjects,
  levels,
}: {
  eligibility: TeacherJourneyEligibility;
  subjects: TeacherJourneyCatalogSubject[];
  levels: TeacherJourneyCatalogLevel[];
}) {
  return teacherEligibleJourneys(eligibility).flatMap<TeacherJourneyCatalogIssue>((journey) => {
    const hasSubject = filterSubjectsForJourney(subjects, journey).length > 0;
    const hasLevel = filterLevelsForJourney(
      levels.map((level) => ({ name: level.name, order: level.order ?? 0 })),
      journey,
    ).length > 0;
    if (hasSubject && hasLevel) return [];
    return [{
      journey,
      label: TEACHER_JOURNEY_CONFIG[journey].label,
      hasSubject,
      hasLevel,
    }];
  });
}

export function teacherCatalogEligibleJourneys({
  eligibility,
  subjects,
  levels,
}: {
  eligibility: TeacherJourneyEligibility;
  subjects: TeacherJourneyCatalogSubject[];
  levels: TeacherJourneyCatalogLevel[];
}) {
  return teacherEligibleJourneys(eligibility).filter((journey) => (
    filterSubjectsForJourney(subjects, journey).length > 0
    && filterLevelsForJourney(
      levels.map((level) => ({ name: level.name, order: level.order ?? 0 })),
      journey,
    ).length > 0
  ));
}

export function teacherJourneyCatalogIssueMessage(issues: TeacherJourneyCatalogIssue[]) {
  if (issues.length === 0) return null;
  const details = issues.map((issue) => {
    const missing = [
      issue.hasSubject ? null : "une matière/compétence compatible",
      issue.hasLevel ? null : "un niveau/profil compatible",
    ].filter(Boolean).join(" et ");
    return `${issue.label} : ajoutez ${missing}`;
  });
  return `Impossible d'activer ce professeur dans un système sans catalogue cohérent. ${details.join(" ; ")}.`;
}
