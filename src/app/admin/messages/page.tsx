import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import Link from "next/link";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProfessorImage } from "@/components/shared/professor-image";
import { MessageSquare, Mail, Phone, Bell, ExternalLink } from "lucide-react";
import { formatDateTime, timeAgo } from "@/lib/format";
import {
  clientCommunicationTypeLabel,
  notificationChannelLabel,
  priorityLabel,
} from "@/lib/platform-labels";
import { MessagesClient } from "./client";

export const dynamic = "force-dynamic";

const TEACHER_MESSAGE_STATUS_LABELS: Record<string, string> = {
  OPEN: "Ouvert",
  WAITING_ADMIN: "Réponse admin attendue",
  WAITING_TEACHER: "Réponse professeur attendue",
  RESOLVED: "Résolu",
  CLOSED: "Clôturé",
};

export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const filter = sp.filter;
  const where: any = {};
  if (filter === "unhandled") where.handled = false;

  const [messages, clientCommunications, teacherAdminMessages] = await Promise.all([
    db.contactMessage.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    db.clientCommunication.findMany({
      include: {
        client: { select: { id: true, name: true, email: true, phone: true } },
        sentBy: { select: { name: true } },
        booking: {
          select: {
            id: true,
            reference: true,
            subjectName: true,
            levelName: true,
            teacher: {
              select: {
                id: true,
                fullName: true,
                professionalName: true,
                photoUrl: true,
                phone: true,
                badgeVerified: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 80,
    }),
    db.teacherAdminMessage.findMany({
      include: {
        teacher: {
          select: {
            id: true,
            fullName: true,
            professionalName: true,
            photoUrl: true,
            phone: true,
            badgeVerified: true,
          },
        },
        admin: { select: { name: true } },
        booking: {
          select: {
            id: true,
            reference: true,
            subjectName: true,
            levelName: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);
  const unreadTeacherMessages = teacherAdminMessages.filter((message) => message.sender === "TEACHER" && !message.readByAdminAt).length;

  return (
    <div className="space-y-5">
      <PageHeader title="Messages & communications" description={`${messages.length} contact(s), ${clientCommunications.length} message(s) client, ${teacherAdminMessages.length} échange(s) professeur`}>
        <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
          <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
          Support client
        </Badge>
        {unreadTeacherMessages > 0 && (
          <Badge variant="outline" className="border-[#111B4D] bg-white text-[#111B4D]">
            {unreadTeacherMessages} prof à traiter
          </Badge>
        )}
      </PageHeader>
      <MessagesClient filter={filter ?? ""} />
      {messages.length === 0 ? (
        <EmptyState icon={MessageSquare} title="Aucun message" description="Aucun message de contact." />
      ) : (
        <div className="space-y-3">
          {messages.map((m) => (
            <Card key={m.id} className={m.handled ? "opacity-75" : "border-[#E3E8F2] bg-white"}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-700 ring-1 ring-violet-100">
                      <MessageSquare className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{m.name}</p>
                      {!m.handled && <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">Nouveau</Badge>}
                      {m.handled && <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">Traité</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      <Mail className="mr-1 inline h-3.5 w-3.5" /> {m.email}
                      {m.phone && <><Phone className="ml-3 mr-1 inline h-3.5 w-3.5" /> {m.phone}</>}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground" title={formatDateTime(m.createdAt)}>{formatDateTime(m.createdAt)} • {timeAgo(m.createdAt)}</p>
                    </div>
                  </div>
                  <MessagesClient message={{ id: m.id, handled: m.handled }} />
                </div>
                <div className="mt-3 rounded-2xl border border-violet-100 bg-white p-3">
                  <p className="text-xs font-medium text-muted-foreground">Sujet: {m.subject}</p>
                  <p className="mt-1 text-sm">{m.message}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-foreground">Messages professeurs</h2>
            <p className="text-sm text-muted-foreground">
              Tous les échanges issus de l'espace professeur sont centralisés ici, puis traités dans la fiche interne du professeur.
            </p>
          </div>
          <Badge variant="outline" className="border-[#D7DEE9] bg-white text-[#111B4D]">
            {unreadTeacherMessages} non lu(s) admin
          </Badge>
        </div>

        {teacherAdminMessages.length === 0 ? (
          <EmptyState icon={MessageSquare} title="Aucun message professeur" description="Les messages envoyés depuis l'espace professeur apparaîtront ici." />
        ) : (
          <div className="grid gap-3">
            {teacherAdminMessages.map((message) => {
              const teacherName = message.teacher.professionalName || message.teacher.fullName;
              const unread = message.sender === "TEACHER" && !message.readByAdminAt;
              return (
                <Card key={message.id} className={unread ? "border-[#111B4D] bg-white" : "border-[#E3E8F2] bg-white"}>
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <ProfessorImage
                          photoUrl={message.teacher.photoUrl}
                          name={teacherName}
                          size="sm"
                          shape="circle"
                          verified={message.teacher.badgeVerified}
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-bold text-foreground">{message.subject}</p>
                            <Badge variant="outline" className="border-[#D7DEE9] bg-white text-[#111B4D]">
                              {message.sender === "TEACHER" ? "Professeur" : message.admin?.name || "Administration"}
                            </Badge>
                            <Badge variant="outline" className="border-[#D7DEE9] bg-white text-[#111B4D]">
                              {TEACHER_MESSAGE_STATUS_LABELS[message.status] ?? message.status}
                            </Badge>
                            <Badge variant="outline" className={unread ? "border-[#111B4D] bg-white text-[#111B4D]" : "border-[#D7DEE9] bg-white text-[#111B4D]"}>
                              {priorityLabel(message.priority)}
                            </Badge>
                            {unread && (
                              <Badge variant="outline" className="border-red-200 bg-white text-red-700">
                                À traiter
                              </Badge>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Professeur : {teacherName}
                            {message.teacher.phone ? ` · ${message.teacher.phone}` : ""}
                            {message.booking ? ` · ${message.booking.reference}` : ""}
                          </p>
                          {message.booking && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {message.booking.subjectName} · {message.booking.levelName}
                            </p>
                          )}
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatDateTime(message.createdAt)} • {timeAgo(message.createdAt)}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        <Button asChild size="sm" variant={unread ? "default" : "outline"} className={unread ? "bg-[#111B4D] text-white hover:bg-[#1E2A78]" : ""}>
                          <Link href={`/admin/professeurs/${message.teacher.id}?tab=messages&messageId=${message.id}`}>
                            Répondre <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                          </Link>
                        </Button>
                        {message.booking && (
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/admin/reservations/${message.booking.id}`}>
                              Réservation <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 rounded-2xl border border-[#E3E8F2] bg-white p-3">
                      <p className="whitespace-pre-line text-sm text-foreground">{message.message}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-foreground">Messages envoyés aux clients</h2>
            <p className="text-sm text-muted-foreground">
              Historique opérationnel des communications reliées aux réservations, professeurs et dossiers client.
            </p>
          </div>
          <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
            <Bell className="mr-1.5 h-3.5 w-3.5" />
            {clientCommunications.length} communication(s)
          </Badge>
        </div>

        {clientCommunications.length === 0 ? (
          <EmptyState icon={Bell} title="Aucune communication client" description="Les messages envoyés depuis les réservations apparaîtront ici." />
        ) : (
          <div className="grid gap-3">
            {clientCommunications.map((communication) => {
              const teacher = communication.booking?.teacher;
              const teacherName = teacher?.professionalName || teacher?.fullName || "Professeur à confirmer";
              return (
                <Card key={communication.id} className="border-violet-100 bg-white">
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <ProfessorImage
                          photoUrl={teacher?.photoUrl ?? null}
                          name={teacherName}
                          size="sm"
                          shape="circle"
                          verified={Boolean(teacher?.badgeVerified)}
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-bold text-foreground">{communication.subject}</p>
                            <Badge variant="outline" className="border-violet-100 bg-violet-50 text-violet-800">{clientCommunicationTypeLabel(communication.type)}</Badge>
                            <Badge variant="outline" className="border-blue-100 bg-blue-50 text-blue-800">{notificationChannelLabel(communication.channel)}</Badge>
                            <Badge variant="outline" className="border-amber-100 bg-amber-50 text-amber-800">{priorityLabel(communication.priority)}</Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Client: {communication.client.name}
                            {communication.client.phone ? ` · ${communication.client.phone}` : ""}
                            {communication.booking ? ` · ${communication.booking.reference}` : ""}
                          </p>
                          {communication.booking && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {communication.booking.subjectName} · {communication.booking.levelName} · Professeur: {teacherName}
                              {teacher?.phone ? ` · ${teacher.phone}` : ""}
                            </p>
                          )}
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatDateTime(communication.createdAt)} • {timeAgo(communication.createdAt)}
                            {communication.sentBy?.name ? ` • envoyé par ${communication.sentBy.name}` : ""}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        {communication.booking && (
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/admin/reservations/${communication.booking.id}`}>
                              Réservation <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        )}
                        {teacher && (
                          <Button asChild size="sm" variant="outline">
                            <Link href={communication.booking ? `/admin/professeurs/${teacher.id}?tab=cours&bookingId=${communication.booking.id}` : `/admin/professeurs/${teacher.id}?tab=historique`}>
                              Professeur <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        )}
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/admin/clients/${communication.client.id}`}>
                            Client <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3 rounded-2xl border border-violet-100 bg-violet-50/35 p-3">
                      <p className="whitespace-pre-line text-sm text-foreground">{communication.content}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
