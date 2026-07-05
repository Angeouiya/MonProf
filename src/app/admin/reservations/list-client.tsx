"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Search, X } from "lucide-react";
import { CLIENT_TYPES, COURSE_CATEGORIES, SCHOOL_SYSTEMS } from "@/lib/course-catalog";

const STATUSES = [
  { v: "PENDING_PAYMENT", l: "Brouillon PayDunya" },
  { v: "PAID", l: "Payée" },
  { v: "PENDING_ADMIN_VALIDATION", l: "Validation admin" },
  { v: "CONFIRMED", l: "Confirmée" },
  { v: "ASSIGNED", l: "Affectée" },
  { v: "IN_PROGRESS", l: "En cours" },
  { v: "COURSE_DONE", l: "Cours effectué" },
  { v: "PENDING_CLIENT_VALIDATION", l: "Validation client" },
  { v: "VALIDATED_BY_CLIENT", l: "Validée par client" },
  { v: "PAYMENT_TO_RELEASE", l: "Paiement à libérer" },
  { v: "TEACHER_PAID", l: "Professeur payé" },
  { v: "DISPUTED", l: "Litige" },
  { v: "CANCELLED", l: "Annulée" },
  { v: "REFUNDED", l: "Remboursée" },
];
const PAYMENTS = [
  { v: "FAILED", l: "Échec" },
  { v: "RECEIVED", l: "Reçu" },
  { v: "BLOCKED", l: "Bloqué" },
  { v: "VALIDATED", l: "Validé" },
  { v: "TO_PAY_TEACHER", l: "À payer prof" },
  { v: "TEACHER_PAID", l: "Prof payé" },
  { v: "DISPUTED", l: "Litige" },
  { v: "REFUND_PENDING", l: "Remb. à traiter" },
  { v: "PARTIAL_REFUND_PENDING", l: "Remb. partiel à traiter" },
  { v: "REFUNDED", l: "Remboursé" },
  { v: "PARTIALLY_REFUNDED", l: "Remboursé partiel" },
  { v: "RETAINED", l: "Frais retenus" },
];

export function ReservationsListClient({
  filters,
  teachers,
}: {
  filters: {
    q: string;
    status: string;
    payment: string;
    teacherId: string;
    clientId: string;
    clientType: string;
    courseCategory: string;
    schoolSystem: string;
  };
  teachers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(filters.q);

  const build = (next: Record<string, string>) => {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(next)) {
      if (!v) params.delete(k);
      else params.set(k, v);
    }
    return `/admin/reservations?${params.toString()}`;
  };
  const apply = (next: Record<string, string>) => router.push(build(next));
  const applyQ = (e: React.FormEvent) => { e.preventDefault(); apply({ q }); };
  const reset = () => router.push("/admin/reservations");

  return (
    <Card className="overflow-hidden border-violet-100 bg-white">
      <CardContent className="p-4">
        <form onSubmit={applyQ} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <div className="sm:col-span-2 lg:col-span-2 xl:col-span-2">
            <Label className="sr-only" htmlFor="q">Recherche</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Réf, matière, client..." className="pl-9" />
            </div>
          </div>
          <Select value={filters.status || "all"} onValueChange={(v) => apply({ status: v === "all" ? "" : v })}>
            <SelectTrigger><SelectValue placeholder="Statut réservation" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous statuts</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.payment || "all"} onValueChange={(v) => apply({ payment: v === "all" ? "" : v })}>
            <SelectTrigger><SelectValue placeholder="Statut paiement" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous paiements</SelectItem>
              {PAYMENTS.map((p) => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.teacherId || "all"} onValueChange={(v) => apply({ teacherId: v === "all" ? "" : v })}>
            <SelectTrigger><SelectValue placeholder="Professeur" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous professeurs</SelectItem>
              {teachers.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.clientType || "all"} onValueChange={(v) => apply({ clientType: v === "all" ? "" : v })}>
            <SelectTrigger><SelectValue placeholder="Type client" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous clients</SelectItem>
              {CLIENT_TYPES.map((clientType) => <SelectItem key={clientType} value={clientType}>{clientType}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.courseCategory || "all"} onValueChange={(v) => apply({ courseCategory: v === "all" ? "" : v })}>
            <SelectTrigger><SelectValue placeholder="Catégorie" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes catégories</SelectItem>
              {COURSE_CATEGORIES.map((category) => <SelectItem key={category.code} value={category.code}>{category.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.schoolSystem || "all"} onValueChange={(v) => apply({ schoolSystem: v === "all" ? "" : v })}>
            <SelectTrigger><SelectValue placeholder="Système" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous systèmes</SelectItem>
              {SCHOOL_SYSTEMS.map((system) => <SelectItem key={system.value} value={system.value}>{system.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1">Filtrer</Button>
            <Button type="button" variant="outline" size="icon" onClick={reset} title="Réinitialiser"><X className="h-4 w-4" /></Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
