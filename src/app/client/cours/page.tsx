import Link from "next/link";
import Image from "next/image";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { BookingStatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, formatDateTime, avatarFromName } from "@/lib/format";
import { BookOpen, Home, Video, ArrowRight, Clock, Calendar } from "lucide-react";

export const dynamic = "force-dynamic";

const TABS = [
  { id: "avenir", label: "À venir", statuses: ["CONFIRMED", "ASSIGNED", "IN_PROGRESS", "PENDING_ADMIN_VALIDATION", "PAYMENT_TO_RELEASE"] },
  { id: "encours", label: "En cours", statuses: ["IN_PROGRESS"] },
  { id: "termines", label: "Terminés", statuses: ["COURSE_DONE", "PENDING_CLIENT_VALIDATION", "VALIDATED_BY_CLIENT", "TEACHER_PAID"] },
];

export default async function CoursPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) return null;
  const sp = await searchParams;
  const tabId = sp.tab ?? "avenir";
  const tab = TABS.find((t) => t.id === tabId) ?? TABS[0];

  const bookings = await db.booking.findMany({
    where: { clientId: user.id, status: { in: tab.statuses as any } },
    orderBy: { scheduledDate: "asc" },
    include: {
      teacher: {
        select: { id: true, fullName: true, professionalName: true, photoUrl: true, jobTitle: true, commune: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mes cours"
        description="Retrouvez les cours à venir, en cours et terminés."
      />

      <div className="flex gap-1 overflow-x-auto scrollbar-thin">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/client/cours?tab=${t.id}`}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              tabId === t.id ? "bg-primary text-primary-foreground" : "bg-white text-foreground/70 hover:bg-muted"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {bookings.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Aucun cours dans cette catégorie"
          description="Réservez un cours pour le voir apparaître ici."
          action={
            <Button asChild size="sm">
              <Link href="/client/rechercher">Réserver un cours</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {bookings.map((b) => {
            const name = b.teacher.professionalName || b.teacher.fullName;
            return (
              <Card key={b.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-muted">
                      {b.teacher.photoUrl ? (
                        <Image src={b.teacher.photoUrl} alt={name} fill className="object-cover" />
                      ) : (
                        <img src={avatarFromName(name)} alt={name} className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-foreground">{b.subjectName}</p>
                        <BookingStatusBadge status={b.status} />
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{name} • {b.levelName}</p>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{b.scheduledDate ? formatDate(b.scheduledDate) : "À planifier"}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{b.scheduledTime || b.preferredTime || "—"}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      {b.courseFormat === "HOME" ? <Home className="h-3.5 w-3.5" /> : <Video className="h-3.5 w-3.5" />}
                      <span>{b.courseFormat === "HOME" ? "À domicile" : "En ligne"}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <BookOpen className="h-3.5 w-3.5" />
                      <span>{b.packType === "SINGLE" ? "1 séance" : b.packType.replace("_", " ")}</span>
                    </div>
                  </div>

                  {b.courseFormat === "ONLINE" && b.onlineLink && tabId === "avenir" && (
                    <a
                      href={b.onlineLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary/10 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/20"
                    >
                      <Video className="h-3.5 w-3.5" />
                      Rejoindre le cours en ligne
                    </a>
                  )}

                  <Button asChild variant="outline" size="sm" className="mt-3 w-full">
                    <Link href={`/client/reservations/${b.id}`}>
                      Voir détails <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
