import { Mail, MapPin, Phone } from "lucide-react";
import { db } from "@/lib/db";
import { formatDateTime, formatFCFA } from "@/lib/format";
import { parseAvailability, TWO_HOUR_SLOTS, WEEK_DAYS } from "@/lib/scheduling";
import { requireTeacher } from "@/lib/teacher-auth";
import { ProfessorImage } from "@/components/shared/professor-image";
import { TeacherMiniCv } from "@/components/shared/teacher-mini-cv";
import { Badge } from "@/components/ui/badge";
import { InfoLine, PortalCard, ProfessorPageHeader, StatusPill } from "@/components/professor/professor-ui";
import { TeacherProfessionalProfileForm } from "@/components/professor/teacher-professional-profile-form";

export const dynamic = "force-dynamic";

function countSlots(raw?: string | null) {
  const availability = parseAvailability(raw);
  return WEEK_DAYS.reduce((total, day) => (
    total + TWO_HOUR_SLOTS.filter((slot) => availability[day.key]?.[slot.key]).length
  ), 0);
}

export default async function ProfesseurProfilPage() {
  const { teacher } = await requireTeacher();
  const profile = await db.teacher.findUnique({
    where: { id: teacher.id },
    include: {
      subjects: { include: { subject: true }, orderBy: { isPrimary: "desc" } },
      levels: { include: { level: true }, orderBy: { level: { order: "asc" } } },
      zones: { include: { commune: true }, orderBy: { commune: { name: "asc" } } },
    },
  });

  if (!profile) return null;
  const teacherName = profile.professionalName || profile.fullName;
  const availabilitySlots = countSlots(profile.availability);

  return (
    <div className="space-y-6">
      <ProfessorPageHeader
        title="Mon profil"
        description="Informations visibles et opérationnelles de votre fiche. Les modifications sensibles sont validées par l'administration."
      />

      <PortalCard className="grid gap-5 lg:grid-cols-[auto_1fr] lg:items-start">
        <ProfessorImage photoUrl={profile.photoUrl} name={teacherName} size="xl" verified={profile.badgeVerified} />
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-normal text-[#111827]">{teacherName}</h2>
            <StatusPill status={profile.status} />
          </div>
          <p className="mt-1 text-sm font-bold text-[#64748B]">{profile.jobTitle}</p>
          <p className="mt-4 max-w-3xl text-sm font-semibold leading-6 text-[#475569]">{profile.bio}</p>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <ContactTile icon={<Phone className="h-4 w-4" />} label="Téléphone" value={profile.phone} />
            <ContactTile icon={<Mail className="h-4 w-4" />} label="Email" value={profile.email || "Non renseigné"} />
            <ContactTile icon={<MapPin className="h-4 w-4" />} label="Commune" value={[profile.commune, profile.quartier].filter(Boolean).join(" · ") || "Non renseignée"} />
          </div>
        </div>
      </PortalCard>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <PortalCard>
          <h3 className="text-base font-semibold text-[#111827]">Parcours et compétences</h3>
          <p className="mt-1 text-sm font-semibold leading-6 text-[#64748B]">
            Ces informations sont visibles côté client et suivies par l'administration.
          </p>
          <div className="mt-4">
            <TeacherMiniCv
              careerSummary={profile.careerSummary}
              skills={profile.skills}
              workHistory={profile.workHistory}
              certifications={profile.certifications || profile.diploma}
              teachingAchievements={profile.teachingAchievements}
              learnersCoached={profile.learnersCoached}
            />
          </div>
          <div className="mt-5 border-t border-[#E6EAF3] pt-5">
            <h4 className="text-sm font-semibold text-[#111827]">Compléter mon mini-CV</h4>
            <p className="mt-1 text-sm font-semibold leading-6 text-[#64748B]">
              Renseignez votre parcours, vos expériences et vos compétences. L'administration reçoit une notification et garde la traçabilité.
            </p>
            <TeacherProfessionalProfileForm
              careerSummary={profile.careerSummary}
              skills={profile.skills}
              workHistory={profile.workHistory}
              certifications={profile.certifications || profile.diploma}
              teachingAchievements={profile.teachingAchievements}
              learnersCoached={profile.learnersCoached}
            />
          </div>
        </PortalCard>

        <PortalCard>
          <h3 className="text-base font-semibold text-[#111827]">Matières, niveaux et zones</h3>
          <div className="mt-4 space-y-5">
            <TagGroup title="Matières enseignées" items={profile.subjects.map((item) => item.subject.name)} />
            <TagGroup title="Niveaux acceptés" items={profile.levels.map((item) => item.level.name)} />
            <TagGroup title="Zones d'intervention" items={profile.zones.map((item) => item.commune.name)} />
          </div>
        </PortalCard>

        <PortalCard>
          <h3 className="text-base font-semibold text-[#111827]">Cadre opérationnel</h3>
          <div className="mt-4">
            <InfoLine label="Format domicile" value={profile.offersHome ? "Oui" : "Non"} />
            <InfoLine label="Format en ligne" value={profile.offersOnline ? "Oui" : "Non"} />
            <InfoLine label="Cours groupe" value={profile.offersGroup ? "Oui" : "Non"} />
            <InfoLine label="Créneaux ouverts" value={`${availabilitySlots} créneau(x) de 2h`} />
            <InfoLine label="Prix indicatif séance" value={formatFCFA(profile.pricePerSession)} />
            <InfoLine label="Dernière connexion" value={formatDateTime(profile.portalLastLoginAt)} />
          </div>
          <p className="mt-4 rounded-lg border border-[#E6EAF3] bg-white p-3 text-xs font-semibold leading-5 text-[#64748B]">
            Les tarifs finaux et les paiements sont contrôlés par l'administration selon la grille tarifaire et les réservations validées.
          </p>
        </PortalCard>
      </div>
    </div>
  );
}

function ContactTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#E6EAF3] bg-white px-3 py-3">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#64748B]">{icon}{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-[#111827]">{value}</p>
    </div>
  );
}

function TagGroup({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">{title}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.length === 0 ? (
          <span className="text-sm font-semibold text-[#64748B]">Non renseigné</span>
        ) : (
          items.map((item) => (
            <Badge key={item} variant="outline" className="border-[#D7DEE9] bg-white text-[#111B4D]">
              {item}
            </Badge>
          ))
        )}
      </div>
    </div>
  );
}
