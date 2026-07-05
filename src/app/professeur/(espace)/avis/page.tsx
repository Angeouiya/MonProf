import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { requireTeacher } from "@/lib/teacher-auth";
import { EmptyProfessorState, PortalCard, ProfessorPageHeader, ProfessorStatCard, StatusPill } from "@/components/professor/professor-ui";

export const dynamic = "force-dynamic";

const warningLabels: Record<string, string> = {
  SIMPLE_REMINDER: "Rappel simple",
  OFFICIAL_WARNING: "Avertissement officiel",
  FINAL_WARNING: "Dernier avertissement",
  SUSPENSION_WARNING: "Suspension",
};

const sanctionLabels: Record<string, string> = {
  LIGHT: "Légère",
  MEDIUM: "Moyenne",
  FINANCIAL: "Financière",
  STRONG: "Forte",
};

export default async function ProfesseurAvisPage() {
  const { teacher } = await requireTeacher();
  const [profile, reviews, warnings, sanctions] = await db.$transaction([
    db.teacher.findUnique({
      where: { id: teacher.id },
      select: {
        rating: true,
        ratingCount: true,
        qualityScore: true,
        adminRating: true,
        adminRatingNote: true,
        adminRatingPublic: true,
      },
    }),
    db.review.findMany({
      where: { teacherId: teacher.id, published: true },
      include: {
        client: { select: { name: true } },
        booking: { select: { reference: true, subjectName: true, levelName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 80,
    }),
    db.teacherWarning.findMany({
      where: { teacherId: teacher.id, adminOnly: false },
      include: { booking: { select: { reference: true, subjectName: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    db.teacherSanction.findMany({
      where: { teacherId: teacher.id, status: { in: ["PENDING_VALIDATION", "APPLIED"] } },
      include: { booking: { select: { reference: true, subjectName: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div className="space-y-6">
      <ProfessorPageHeader
        title="Avis & qualité"
        description="Suivi qualité visible sur votre fiche professeur : avis clients publiés, score qualité et décisions administratives."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ProfessorStatCard label="Note moyenne" value={`${Number(profile?.rating ?? 0).toFixed(1)}/5`} detail={`${profile?.ratingCount ?? 0} avis publié(s)`} icon="check" />
        <ProfessorStatCard
          label="Note plateforme"
          value={Number(profile?.adminRating ?? 0) > 0 ? `${Number(profile?.adminRating ?? 0).toFixed(1)}/5` : "Non noté"}
          detail={profile?.adminRatingPublic ? "Peut servir de note visible au démarrage" : "Note interne de suivi"}
          icon="check"
        />
        <ProfessorStatCard label="Score qualité" value={`${profile?.qualityScore ?? 0}/100`} detail="Calculé par l'administration" icon="calendar" />
        <ProfessorStatCard label="Suivis actifs" value={warnings.length + sanctions.length} detail="Avertissements et sanctions visibles" icon="alert" />
      </div>

      {Number(profile?.adminRating ?? 0) > 0 && (
        <PortalCard>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              <p className="text-base font-semibold text-[#111827]">Évaluation plateforme</p>
              <p className="mt-1 text-sm font-semibold leading-6 text-[#64748B]">
                Cette note est attribuée par l'administration Compétence pour suivre la qualité, surtout avant que les avis clients soient nombreux.
              </p>
              {profile?.adminRatingNote && (
                <p className="mt-3 rounded-[1.15rem] border border-[#E6EAF3] bg-white p-3 text-sm font-semibold leading-6 text-[#475569]">
                  {profile.adminRatingNote}
                </p>
              )}
            </div>
            <div className="rounded-[1.15rem] border border-[#111B4D] bg-white px-5 py-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Note admin</p>
              <p className="mt-1 text-3xl font-semibold tracking-normal text-[#111B4D]">
                {Number(profile?.adminRating ?? 0).toFixed(1)}/5
              </p>
            </div>
          </div>
        </PortalCard>
      )}

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.9fr]">
        <PortalCard>
          <h2 className="text-base font-semibold text-[#111827]">Avis clients publiés</h2>
          {reviews.length === 0 ? (
            <div className="mt-4">
              <EmptyProfessorState title="Aucun avis publié" description="Les avis validés par l'administration apparaîtront ici." />
            </div>
          ) : (
            <div className="mt-4 grid gap-3">
              {reviews.map((review) => (
                <article key={review.id} className="rounded-[1.15rem] border border-[#E6EAF3] bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#111827]">{review.booking.subjectName} - {review.booking.levelName}</p>
                      <p className="mt-1 text-xs font-bold text-[#64748B]">{review.client.name} · {review.booking.reference} · {formatDate(review.createdAt)}</p>
                    </div>
                    <span className="rounded-full border border-[#D7DEE9] bg-white px-3 py-1 text-sm font-semibold text-[#111B4D]">{review.rating}/5</span>
                  </div>
                  {review.comment && <p className="mt-3 text-sm font-semibold leading-6 text-[#475569]">{review.comment}</p>}
                </article>
              ))}
            </div>
          )}
        </PortalCard>

        <div className="space-y-5">
          <PortalCard>
            <h2 className="text-base font-semibold text-[#111827]">Avertissements visibles</h2>
            {warnings.length === 0 ? (
              <p className="mt-4 text-sm font-semibold text-[#64748B]">Aucun avertissement visible.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {warnings.map((warning) => (
                  <div key={warning.id} className="rounded-[1.15rem] border border-[#E6EAF3] bg-white p-4">
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-800">{warningLabels[warning.level] ?? warning.level}</span>
                      {warning.booking && <span className="rounded-full border border-[#D7DEE9] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#111B4D]">{warning.booking.reference}</span>}
                    </div>
                    <p className="mt-2 text-sm font-semibold text-[#111827]">{warning.reason}</p>
                    <p className="mt-1 text-sm font-semibold leading-6 text-[#64748B]">{warning.description}</p>
                  </div>
                ))}
              </div>
            )}
          </PortalCard>

          <PortalCard>
            <h2 className="text-base font-semibold text-[#111827]">Sanctions suivies</h2>
            {sanctions.length === 0 ? (
              <p className="mt-4 text-sm font-semibold text-[#64748B]">Aucune sanction active visible.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {sanctions.map((sanction) => (
                  <div key={sanction.id} className="rounded-[1.15rem] border border-[#E6EAF3] bg-white p-4">
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-red-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-red-700">{sanctionLabels[sanction.type] ?? sanction.type}</span>
                      <StatusPill status={sanction.status} />
                    </div>
                    <p className="mt-2 text-sm font-semibold text-[#111827]">{sanction.reason}</p>
                    {sanction.description && <p className="mt-1 text-sm font-semibold leading-6 text-[#64748B]">{sanction.description}</p>}
                  </div>
                ))}
              </div>
            )}
          </PortalCard>
        </div>
      </div>
    </div>
  );
}
