import { Award, BriefcaseBusiness, CheckCircle2, GraduationCap, UsersRound } from "lucide-react";

import { buildTeacherCvPresentation } from "@/lib/teacher-profile";
import { cn } from "@/lib/utils";

type TeacherMiniCvProps = {
  careerSummary?: string | null;
  skills?: string | null;
  workHistory?: string | null;
  certifications?: string | null;
  teachingAchievements?: string | null;
  learnersCoached?: number | null;
  experienceYears?: number | null;
  diploma?: string | null;
  compact?: boolean;
  className?: string;
};

export function TeacherMiniCv({
  careerSummary,
  skills,
  workHistory,
  certifications,
  teachingAchievements,
  learnersCoached,
  experienceYears,
  diploma,
  compact = false,
  className,
}: TeacherMiniCvProps) {
  const presentation = buildTeacherCvPresentation({
    careerSummary,
    skills,
    workHistory,
    certifications,
    teachingAchievements,
    diploma,
  });
  const {
    summary,
    skills: skillItems,
    workHistory: workItems,
    certifications: certificationItems,
    achievements: achievementItems,
  } = presentation;
  const hasContent = Boolean(
    summary
    || skillItems.length
    || workItems.length
    || certificationItems.length
    || achievementItems.length
    || learnersCoached
    || experienceYears
    || diploma,
  );

  if (!hasContent) return null;

  if (compact) {
    const visibleSkills = skillItems.slice(0, 2);
    const compactFacts = [
      ...visibleSkills,
      experienceYears && experienceYears > 0 ? `${experienceYears} ans d'expérience` : "",
      learnersCoached && learnersCoached > 0 ? `${learnersCoached}+ encadrés` : "",
    ].filter(Boolean);

    return (
      <div className={cn("space-y-1.5", className)}>
        {summary && (
          <p className="line-clamp-2 text-[13px] font-medium leading-5 text-[#475569]">{summary}</p>
        )}
        {compactFacts.length > 0 && (
          <p className="line-clamp-1 text-[12px] font-semibold leading-5 text-[#111B4D]">
            {compactFacts.join(" · ")}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={cn("grid gap-4", className)} data-teacher-mini-cv>
      {summary && (
        <div className="rounded-2xl border border-[#DDE3EE] bg-white p-5 sm:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748B]">Présentation professionnelle</p>
          <p className="mt-2 whitespace-pre-line text-sm font-medium leading-7 text-[#111827] sm:text-[15px]">{summary}</p>
        </div>
      )}
      {(Boolean(experienceYears) || Boolean(diploma) || Boolean(learnersCoached)) && (
        <div className="grid gap-2 min-[620px]:grid-cols-3">
          {Boolean(experienceYears) && (
            <CvFact icon={<BriefcaseBusiness className="h-4 w-4" />} label="Expérience" value={`${experienceYears} ans`} />
          )}
          {diploma && (
            <CvFact icon={<GraduationCap className="h-4 w-4" />} label="Diplôme principal" value={diploma} />
          )}
          {Boolean(learnersCoached) && (
            <CvFact icon={<UsersRound className="h-4 w-4" />} label="Apprenants encadrés" value={`${learnersCoached}+`} />
          )}
        </div>
      )}
      <div className="grid gap-3 min-[760px]:grid-cols-2">
        <MiniCvSection icon={<CheckCircle2 className="h-4 w-4" />} title="Compétences clés" items={skillItems} />
        <MiniCvSection icon={<BriefcaseBusiness className="h-4 w-4" />} title="Parcours et expériences" items={workItems} />
        <MiniCvSection icon={<Award className="h-4 w-4" />} title="Certifications vérifiées" items={certificationItems} />
        <MiniCvSection icon={<GraduationCap className="h-4 w-4" />} title="Résultats et encadrements" items={achievementItems} />
      </div>
    </div>
  );
}

function MiniCvSection({ icon, title, items }: { icon: React.ReactNode; title: string; items: string[] }) {
  if (items.length === 0) return null;

  return (
    <section className="rounded-2xl border border-[#E3E8F2] bg-white p-4 sm:p-5">
      <p className="flex items-center gap-2 text-sm font-semibold text-[#111827]">
        <span className="text-[#111B4D]">{icon}</span>
        {title}
      </p>
      <ul className="mt-3 grid gap-2.5 text-sm font-medium leading-6 text-[#475569]">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#111B4D]" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CvFact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-[#DDE3EE] bg-white p-4">
      <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#64748B]">
        <span className="text-[#111B4D]">{icon}</span>
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-semibold leading-5 text-[#111827]">{value}</p>
    </div>
  );
}
