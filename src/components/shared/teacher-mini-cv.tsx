import { Award, BriefcaseBusiness, CheckCircle2, GraduationCap, UsersRound } from "lucide-react";

import { parseTeacherProfileList } from "@/lib/teacher-profile";
import { cn } from "@/lib/utils";

type TeacherMiniCvProps = {
  careerSummary?: string | null;
  skills?: string | null;
  workHistory?: string | null;
  certifications?: string | null;
  teachingAchievements?: string | null;
  learnersCoached?: number | null;
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
  compact = false,
  className,
}: TeacherMiniCvProps) {
  const skillItems = parseTeacherProfileList(skills);
  const workItems = parseTeacherProfileList(workHistory);
  const certificationItems = parseTeacherProfileList(certifications);
  const achievementItems = parseTeacherProfileList(teachingAchievements);
  const hasContent = Boolean(
    careerSummary || skillItems.length || workItems.length || certificationItems.length || achievementItems.length || learnersCoached,
  );

  if (!hasContent) return null;

  if (compact) {
    const visibleSkills = skillItems.slice(0, 2);
    const compactFacts = [
      ...visibleSkills,
      learnersCoached && learnersCoached > 0 ? `${learnersCoached}+ encadrés` : "",
    ].filter(Boolean);

    return (
      <div className={cn("space-y-1.5", className)}>
        {careerSummary && (
          <p className="line-clamp-1 text-[13px] font-medium leading-5 text-[#475569]">{careerSummary}</p>
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
    <div className={cn("grid gap-4", className)}>
      {careerSummary && (
        <div className="rounded-lg border border-[#E3E8F2] bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Résumé professionnel</p>
          <p className="mt-2 whitespace-pre-line text-sm font-medium leading-6 text-[#111827]">{careerSummary}</p>
        </div>
      )}
      {!!learnersCoached && learnersCoached > 0 && (
        <div className="rounded-lg border border-[#E3E8F2] bg-white p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-[#111827]">
            <UsersRound className="h-4 w-4 text-[#111B4D]" />
            {learnersCoached}+ apprenants encadrés
          </p>
          <p className="mt-1 text-xs font-medium leading-5 text-[#64748B]">Indicateur renseigné et contrôlé dans la fiche interne professeur.</p>
        </div>
      )}
      <MiniCvSection icon={<CheckCircle2 className="h-4 w-4" />} title="Compétences clés" items={skillItems} />
      <MiniCvSection icon={<BriefcaseBusiness className="h-4 w-4" />} title="Parcours et expériences" items={workItems} />
      <MiniCvSection icon={<Award className="h-4 w-4" />} title="Certifications et diplômes vérifiés" items={certificationItems} />
      <MiniCvSection icon={<GraduationCap className="h-4 w-4" />} title="Résultats et encadrements" items={achievementItems} />
    </div>
  );
}

function MiniCvSection({ icon, title, items }: { icon: React.ReactNode; title: string; items: string[] }) {
  if (items.length === 0) return null;

  return (
    <div className="rounded-lg border border-[#E3E8F2] bg-white p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-[#111827]">
        <span className="text-[#111B4D]">{icon}</span>
        {title}
      </p>
      <ul className="mt-3 grid gap-2 text-sm font-medium leading-6 text-[#475569]">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#111B4D]" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
