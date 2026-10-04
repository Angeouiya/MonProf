import Link from "next/link";
import { ArrowRight, CalendarDays, CheckCircle2, Clock3 } from "lucide-react";
import { ClientEmptyState, ClientRecordCard } from "@/components/shared/client-page-primitives";
import { ProfessorImage } from "@/components/shared/professor-image";
import { Button } from "@/components/ui/button";

export type ClientReservationListItem = {
  id: string;
  reference: string;
  subjectName: string;
  levelName: string;
  teacher: {
    fullName: string;
    professionalName: string | null;
    photoUrl: string | null;
    badgeVerified: boolean;
  };
  amountLabel: string;
  dateLabel: string;
  timeLabel: string;
  stepLabel: string;
  actionKind: "all" | "action" | "secured" | "closed" | "issue";
};

export function ReservationListClient({
  reservations,
  hasSearch = false,
}: {
  reservations: ClientReservationListItem[];
  hasSearch?: boolean;
}) {
  if (reservations.length === 0) {
    return (
      <ClientEmptyState
        icon={CalendarDays}
        title={hasSearch ? "Aucun dossier trouvé" : "Aucune réservation dans cette vue"}
        description={hasSearch ? "Essayez une autre référence, matière ou nom de professeur." : "Vos prochains cours apparaîtront ici."}
        action={
          <Button asChild className="min-h-11 rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78]">
            <Link href="/client/rechercher">Réserver un cours</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid gap-3" data-client-reservation-results>
      {reservations.map((reservation) => {
        const teacherName = reservation.teacher.professionalName || reservation.teacher.fullName;
        const action = reservation.actionKind === "action";
        const closed = reservation.actionKind === "closed";
        return (
          <ClientRecordCard key={reservation.id} data-client-reservation-card data-action-kind={reservation.actionKind}>
            <div className="flex flex-wrap items-start gap-3 p-4 sm:flex-nowrap">
              <ProfessorImage
                photoUrl={reservation.teacher.photoUrl}
                name={teacherName}
                size={52}
                shape="circle"
                verified={reservation.teacher.badgeVerified}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">{reservation.reference}</p>
                  <span className={action ? "text-xs font-bold text-[#111B4D]" : "text-xs font-semibold text-[#52627A]"}>
                    {action ? <Clock3 className="mr-1 inline h-3.5 w-3.5" aria-hidden /> : closed ? <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" aria-hidden /> : null}
                    {reservation.stepLabel}
                  </span>
                </div>
                <h2 className="mt-1 text-base font-semibold leading-6 text-[#111827]">{reservation.subjectName} · {reservation.levelName}</h2>
                <p className="mt-0.5 text-sm font-medium text-[#52627A]">{teacherName}</p>
                <p className="mt-2 text-xs font-medium text-[#52627A]">
                  {reservation.dateLabel} · {reservation.timeLabel}
                </p>
              </div>
              <div className="ml-auto flex w-full items-center justify-between gap-3 border-t border-[#E6EAF3] pt-3 sm:ml-0 sm:w-auto sm:min-w-36 sm:flex-col sm:items-end sm:border-0 sm:pt-0">
                <p className="whitespace-nowrap text-sm font-bold text-[#111B4D]">{reservation.amountLabel}</p>
                <Button asChild size="sm" className="min-h-10 rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78]">
                  <Link href={`/client/reservations/${reservation.id}`}>
                    {action ? "Agir" : "Voir"} <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
                  </Link>
                </Button>
              </div>
            </div>
          </ClientRecordCard>
        );
      })}
    </div>
  );
}
