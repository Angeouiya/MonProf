import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { MessageSquare, Mail, Phone } from "lucide-react";
import { formatDateTime, timeAgo } from "@/lib/format";
import { MessagesClient } from "./client";

export const dynamic = "force-dynamic";

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

  const messages = await db.contactMessage.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Messages de contact" description={`${messages.length} message(s)`} />
      <MessagesClient filter={filter ?? ""} />
      {messages.length === 0 ? (
        <EmptyState icon={MessageSquare} title="Aucun message" description="Aucun message de contact." />
      ) : (
        <div className="space-y-3">
          {messages.map((m) => (
            <Card key={m.id} className={m.handled ? "opacity-70" : ""}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{m.name}</p>
                      {!m.handled && <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">Nouveau</Badge>}
                      {m.handled && <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">Traité</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      <Mail className="mr-1 inline h-3.5 w-3.5" /> {m.email}
                      {m.phone && <><Phone className="ml-3 mr-1 inline h-3.5 w-3.5" /> {m.phone}</>}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground" title={formatDateTime(m.createdAt)}>{formatDateTime(m.createdAt)} • {timeAgo(m.createdAt)}</p>
                  </div>
                  <MessagesClient message={{ id: m.id, handled: m.handled }} />
                </div>
                <div className="mt-3 rounded-md bg-muted/40 p-3">
                  <p className="text-xs font-medium text-muted-foreground">Sujet: {m.subject}</p>
                  <p className="mt-1 text-sm">{m.message}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
