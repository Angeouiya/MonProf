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
import { TeacherServiceClientMessageCompose } from "@/components/professor/teacher-admin-message-compose";
import { MarkServiceClientMessagesRead } from "@/components/professor/mark-admin-messages-read";

export const dynamic = "force-dynamic";

const priorityLabel: Record<string, string> = {
  NORMAL: "Normale",
  IMPORTANT: "Importante",
  URGENT: "Urgente",
  CRITICAL: "Critique",
};

const statusLabel: Record<string, string> = {
  OPEN: "Ouvert",
  WAITING_ADMIN: "Réponse service client attendue",
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

  const unreadServiceClientMessages = messages.filter((message) => message.sender === "ADMIN" && !message.readByTeacherAt).length;
  const waitingServiceClient = messages.filter((message) => message.status === "WAITING_ADMIN").length;
  const openMessages = messages.filter((message) => !["RESOLVED", "CLOSED"].includes(message.status)).length;

  return (
    <div className="space-y-6">
      <MarkServiceClientMessagesRead enabled={unreadServiceClientMessages > 0} />
      <ProfessorPageHeader
        title="Messages avec le service client"
        description="Contactez le service client Compétence pour une mission, un paiement, une disponibilité ou une situation urgente. Chaque échange est enregistré dans votre fiche."
        action={(
          <Button asChild className="rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78]">
            <a href="#nouveau-message">
              Écrire
              <SendHorizontal className="h-4 w-4" />
            </a>
          </Button>
        )}
      />

      <div className="grid gap-3 min-[760px]:grid-cols-3">
        <ProfessorStatCard label="Messages ouverts" value={openMessages} detail="Échanges non clôturés" icon="clock" />
        <ProfessorStatCard label="Réponses service client non lues" value={unreadServiceClientMessages} detail="À consulter rapidement" icon="alert" />
        <ProfessorStatCard label="Réponses attendues" value={waitingServiceClient} detail="Le service client doit répondre" icon="calendar" />
      </div>

      <PortalCard id="nouveau-message" className="scroll-mt-24">
        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-white">
            <MessageSquareText className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-[#111827]">Contacter le service client</h2>
            <p className="mt-1 text-sm font-medium leading-6 text-[#64748B]">
              Pour une urgence, choisissez la priorité adaptée et liez le message à une mission quand c'est possible.
            </p>
          </div>
        </div>
        <TeacherServiceClientMessageCompose bookings={bookings} />
      </PortalCard>

      <PortalCard>
        <div className="mb-4 flex flex-col gap-2 min-[640px]:flex-row min-[640px]:items-center min-[640px]:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#111827]">Historique des échanges</h2>
            <p className="text-sm font-medium text-[#64748B]">Messages envoyés et réponses du service client.</p>
          </div>
          <Badge variant="outline" className="w-fit border-[#D7DEE9] bg-white text-[#111B4D]">
            {messages.length} message{messages.length > 1 ? "s" : ""}
          </Badge>
        </div>

        {messages.length === 0 ? (
          <EmptyProfessorState
            title="Aucun message pour le moment"
            description="Lorsque vous contactez le service client ou qu'il vous répond, l'historique apparaîtra ici."
          />
        ) : (
          <div className="grid gap-3">
            {messages.map((message) => (
              <article
                key={message.id}
                className="rounded-lg border border-[#E6EAF3] bg-white p-4"
              >
                <div className="flex flex-col gap-3 min-[640px]:flex-row min-[640px]:items-start min-[640px]:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="border-[#D7DEE9] bg-white text-[#111B4D]">
                        {message.sender === "TEACHER" ? "Vous" : "Service client"}
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
