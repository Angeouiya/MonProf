import Link from "next/link";
import { MessageSquareText, SendHorizontal } from "lucide-react";
import { db } from "@/lib/db";
import { formatDateTime, timeAgo } from "@/lib/format";
import { requireTeacher } from "@/lib/teacher-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  EmptyProfessorState,
  ProfessorPageHeader,
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
  const priorityMessage =
    messages.find((message) => message.sender === "ADMIN" && !message.readByTeacherAt)
    ?? messages.find((message) => !["RESOLVED", "CLOSED"].includes(message.status))
    ?? messages[0];
  const historyMessages = priorityMessage
    ? messages.filter((message) => message.id !== priorityMessage.id)
    : messages;

  return (
    <div className="space-y-5">
      <MarkServiceClientMessagesRead enabled={unreadServiceClientMessages > 0} />
      <ProfessorPageHeader
        title="Messages"
        description="Une priorité, un bouton pour écrire, le reste en historique."
        rootTab
        action={(
          <Button asChild className="rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78]">
            <a href="#nouveau-message">
              Écrire
              <SendHorizontal className="h-4 w-4" />
            </a>
          </Button>
        )}
      />

      <section
        className="rounded-[1.35rem] border border-[#E3E8F2] bg-white p-4 shadow-[0_18px_45px_rgba(17,24,39,0.06)] min-[640px]:p-5"
        data-professor-message-priority
      >
        <div className="flex flex-col gap-4 min-[720px]:flex-row min-[720px]:items-center min-[720px]:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#111B4D]/60">
              À lire maintenant
            </p>
            {priorityMessage ? (
              <div className="mt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-black text-[#111827]">{priorityMessage.subject}</h2>
                  <Badge variant="outline" className="border-[#D7DEE9] bg-white text-[#111B4D]">
                    {priorityMessage.sender === "TEACHER" ? "Vous" : "Service client"}
                  </Badge>
                  {priorityMessage.sender === "ADMIN" && !priorityMessage.readByTeacherAt && (
                    <Badge variant="outline" className="border-[#111B4D] bg-white text-[#111B4D]">Nouveau</Badge>
                  )}
                </div>
                <p className="mt-1 text-sm font-semibold text-[#64748B]" title={formatDateTime(priorityMessage.createdAt)}>
                  {timeAgo(priorityMessage.createdAt)}
                  {priorityMessage.booking ? ` · ${priorityMessage.booking.reference}` : ""}
                </p>
                <p className="mt-3 max-h-20 overflow-hidden whitespace-pre-line text-sm font-medium leading-6 text-[#111827]">
                  {priorityMessage.message}
                </p>
              </div>
            ) : (
              <div className="mt-3 rounded-[1rem] border border-[#E3E8F2] bg-[#F8FAFD] p-4">
                <h2 className="text-base font-black text-[#111827]">Tout est calme.</h2>
                <p className="mt-1 text-sm font-semibold text-[#64748B]">
                  Aucun échange avec le service client pour le moment.
                </p>
              </div>
            )}
          </div>
          <Button asChild className="min-h-11 rounded-xl bg-[#111B4D] text-white hover:bg-[#1E2A78]">
            <a href="#nouveau-message">
              Écrire
              <SendHorizontal className="h-4 w-4" />
            </a>
          </Button>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2" data-professor-message-metrics>
          <MiniMetric label="Ouverts" value={openMessages} />
          <MiniMetric label="Nouveaux" value={unreadServiceClientMessages} />
          <MiniMetric label="En attente" value={waitingServiceClient} />
        </div>
      </section>

      <details
        id="nouveau-message"
        className="group scroll-mt-24 rounded-[1.35rem] border border-[#E3E8F2] bg-white"
        data-professor-message-compose
        open={messages.length === 0}
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#111B4D] text-white">
              <MessageSquareText className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-black text-[#111827]">Écrire au service client</h2>
              <p className="text-sm font-medium text-[#64748B]">Mission, paiement ou disponibilité.</p>
            </div>
          </div>
          <Badge variant="outline" className="border-[#D7DEE9] bg-white text-[#111B4D]">
            Ouvrir
          </Badge>
        </summary>
        <div className="border-t border-[#E3E8F2] p-4">
          <TeacherServiceClientMessageCompose bookings={bookings} />
        </div>
      </details>

      <details
        className="group rounded-[1.35rem] border border-[#E3E8F2] bg-white"
        data-professor-message-history
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4">
          <div>
            <h2 className="text-base font-black text-[#111827]">Historique</h2>
            <p className="text-sm font-medium text-[#64748B]">Anciens échanges repliés.</p>
          </div>
          <Badge variant="outline" className="w-fit border-[#D7DEE9] bg-white text-[#111B4D]">
            {messages.length}
          </Badge>
        </summary>

        <div className="border-t border-[#E3E8F2] p-4">
        {historyMessages.length === 0 ? (
          <EmptyProfessorState
            title={messages.length === 0 ? "Aucun message pour le moment" : "Rien d'autre à afficher"}
            description={messages.length === 0 ? "Lorsque vous contactez le service client ou qu'il vous répond, l'historique apparaîtra ici." : "Le message important est déjà affiché en haut."}
          />
        ) : (
          <div className="grid gap-3">
            {historyMessages.map((message) => (
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
        </div>
      </details>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 rounded-xl border border-[#E3E8F2] bg-[#F8FAFD] px-3 py-2 text-center">
      <p className="text-lg font-black leading-none text-[#111B4D]">{value}</p>
      <p className="mt-1 truncate text-[11px] font-bold text-[#64748B]">{label}</p>
    </div>
  );
}
