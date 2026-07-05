import Link from "next/link";
import { MessageSquareText, SendHorizontal } from "lucide-react";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { requireTeacher } from "@/lib/teacher-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  EmptyProfessorState,
  PortalCard,
  ProfessorPageHeader,
  ProfessorStatCard,
} from "@/components/professor/professor-ui";
import { TeacherAdminMessageCompose } from "@/components/professor/teacher-admin-message-compose";
import { MarkAdminMessagesRead } from "@/components/professor/mark-admin-messages-read";

export const dynamic = "force-dynamic";

const priorityLabel: Record<string, string> = {
  NORMAL: "Normale",
  IMPORTANT: "Importante",
  URGENT: "Urgente",
  CRITICAL: "Critique",
};

const statusLabel: Record<string, string> = {
  OPEN: "Ouvert",
  WAITING_ADMIN: "Réponse admin attendue",
  WAITING_TEACHER: "Réponse professeur attendue",
  RESOLVED: "Résolu",
  CLOSED: "Clôturé",
};

export default async function ProfesseurMessagesPage() {
  const { teacher } = await requireTeacher();

  const [messages, bookings] = await db.$transaction([
    db.teacherAdminMessage.findMany({
      where: { teacherId: teacher.id },
      include: {
        booking: { select: { id: true, reference: true, subjectName: true, levelName: true } },
        admin: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.booking.findMany({
      where: {
        teacherId: teacher.id,
        status: { notIn: ["CANCELLED", "REFUNDED"] },
      },
      select: { id: true, reference: true, subjectName: true, levelName: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const unreadAdminMessages = messages.filter((message) => message.sender === "ADMIN" && !message.readByTeacherAt).length;
  const waitingAdmin = messages.filter((message) => message.status === "WAITING_ADMIN").length;
  const openMessages = messages.filter((message) => !["RESOLVED", "CLOSED"].includes(message.status)).length;

  return (
    <div className="space-y-6">
      <MarkAdminMessagesRead enabled={unreadAdminMessages > 0} />
      <ProfessorPageHeader
        title="Messages avec l'administration"
        description="Contactez l'administration Compétence pour une mission, un paiement, une disponibilité ou une situation urgente. Chaque échange est enregistré dans votre fiche."
        action={(
          <Button asChild className="rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78]">
            <a href="#nouveau-message">
              Écrire
              <SendHorizontal className="h-4 w-4" />
            </a>
          </Button>
        )}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <ProfessorStatCard label="Messages ouverts" value={openMessages} detail="Échanges non clôturés" icon="clock" />
        <ProfessorStatCard label="Réponses admin non lues" value={unreadAdminMessages} detail="À consulter rapidement" icon="alert" />
        <ProfessorStatCard label="Réponses attendues" value={waitingAdmin} detail="L'administration doit répondre" icon="calendar" />
      </div>

      <PortalCard id="nouveau-message" className="scroll-mt-24">
        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-white">
            <MessageSquareText className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-[#111827]">Contacter l'administration</h2>
            <p className="mt-1 text-sm font-medium leading-6 text-[#64748B]">
              Pour une urgence, choisissez la priorité adaptée et liez le message à une mission quand c'est possible.
            </p>
          </div>
        </div>
        <TeacherAdminMessageCompose bookings={bookings} />
      </PortalCard>

      <PortalCard>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#111827]">Historique des échanges</h2>
            <p className="text-sm font-medium text-[#64748B]">Messages envoyés et réponses de l'administration.</p>
          </div>
          <Badge variant="outline" className="w-fit border-[#D7DEE9] bg-white text-[#111B4D]">
            {messages.length} message{messages.length > 1 ? "s" : ""}
          </Badge>
        </div>

        {messages.length === 0 ? (
          <EmptyProfessorState
            title="Aucun message pour le moment"
            description="Lorsque vous contactez l'administration ou qu'elle vous répond, l'historique apparaîtra ici."
          />
        ) : (
          <div className="grid gap-3">
            {messages.map((message) => (
              <article
                key={message.id}
                className="rounded-[1.15rem] border border-[#E6EAF3] bg-white p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="border-[#D7DEE9] bg-white text-[#111B4D]">
                        {message.sender === "TEACHER" ? "Vous" : message.admin?.name || "Administration"}
                      </Badge>
                      <Badge variant="outline" className="border-[#D7DEE9] bg-white text-[#111B4D]">
                        {statusLabel[message.status] ?? message.status}
                      </Badge>
                      <Badge variant="outline" className="border-[#D7DEE9] bg-white text-[#111B4D]">
                        {priorityLabel[message.priority] ?? message.priority}
                      </Badge>
                      {message.sender === "ADMIN" && !message.readByTeacherAt && (
                        <Badge variant="outline" className="border-[#111B4D] bg-white text-[#111B4D]">Nouveau</Badge>
                      )}
                    </div>
                    <h3 className="mt-3 text-base font-semibold text-[#111827]">{message.subject}</h3>
                    {message.booking && (
                      <Link
                        href={`/professeur/missions/${message.booking.id}`}
                        className="mt-1 inline-flex text-xs font-bold text-[#111B4D] hover:underline"
                      >
                        {message.booking.reference} - {message.booking.subjectName} - {message.booking.levelName}
                      </Link>
                    )}
                    <p className="mt-3 whitespace-pre-line text-sm font-medium leading-6 text-[#475569]">{message.message}</p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-[#64748B]">
                    {formatDateTime(message.createdAt)}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </PortalCard>
    </div>
  );
}
