"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BellRing, Loader2, Search, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Recipient = { id: string; name: string; detail: string };

const AUDIENCES = [
  { value: "ONE_CLIENT", label: "Un client" },
  { value: "ONE_TEACHER", label: "Un professeur" },
  { value: "ALL_CLIENTS", label: "Tous les clients" },
  { value: "ALL_TEACHERS", label: "Tous les professeurs" },
  { value: "ALL_USERS", label: "Toute la plateforme" },
] as const;

export function CommunicationCampaignComposer({
  clients,
  teachers,
}: {
  clients: Recipient[];
  teachers: Recipient[];
}) {
  const router = useRouter();
  const [audience, setAudience] = useState("ALL_USERS");
  const [priority, setPriority] = useState("NORMAL");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [targetId, setTargetId] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const targeted = audience === "ONE_CLIENT" || audience === "ONE_TEACHER";
  const source = audience === "ONE_TEACHER" ? teachers : clients;
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("fr");
    if (!normalized) return source.slice(0, 80);
    return source.filter((item) => `${item.name} ${item.detail}`.toLocaleLowerCase("fr").includes(normalized)).slice(0, 80);
  }, [query, source]);

  const changeAudience = (value: string) => {
    setAudience(value);
    setTargetId("");
    setQuery("");
  };

  const submit = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error("Ajoutez un titre et un message.");
      return;
    }
    if (targeted && !targetId) {
      toast.error("Sélectionnez le destinataire.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/communication-campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audience,
          priority,
          title: title.trim(),
          message: message.trim(),
          targetUserId: audience === "ONE_CLIENT" ? targetId : null,
          targetTeacherId: audience === "ONE_TEACHER" ? targetId : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Diffusion impossible.");
      toast.success(`Communication envoyée à ${data.campaign.recipientCount} destinataire(s).`);
      setTitle("");
      setMessage("");
      setTargetId("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Diffusion impossible.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="overflow-hidden border-[#CBD5E1] bg-white">
      <CardHeader className="border-b border-[#E2E8F0] bg-white">
        <CardTitle className="flex items-center gap-2 text-base text-[#111827]">
          <BellRing className="h-4 w-4 text-[#111B4D]" />
          Nouvelle communication plateforme
        </CardTitle>
        <p className="text-sm leading-6 text-[#64748B]">
          Informez un destinataire précis ou toute une audience. Chaque envoi est visible dans son espace et conservé dans le journal admin.
        </p>
      </CardHeader>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Audience</Label>
            <Select value={audience} onValueChange={changeAudience}>
              <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                {AUDIENCES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Priorité</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NORMAL">Normale</SelectItem>
                <SelectItem value="IMPORTANT">Importante</SelectItem>
                <SelectItem value="URGENT">Urgente</SelectItem>
                <SelectItem value="CRITICAL">Critique</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {targeted && (
          <div className="space-y-2 rounded-lg border border-[#E2E8F0] p-3">
            <Label htmlFor="campaign-recipient-search">Rechercher le destinataire</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
              <Input
                id="campaign-recipient-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={audience === "ONE_TEACHER" ? "Nom, téléphone ou matière" : "Nom, email ou téléphone"}
                className="min-h-11 pl-9"
              />
            </div>
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger className="min-h-11"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
              <SelectContent>
                {filtered.map((item) => (
                  <SelectItem key={item.id} value={item.id}>{item.name} · {item.detail}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="campaign-title">Titre</Label>
          <Input id="campaign-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={180} placeholder="Maintenance programmée, information importante..." className="min-h-11" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="campaign-message">Message</Label>
          <Textarea id="campaign-message" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={4000} rows={5} placeholder="Rédigez une information claire, avec les dates et l'action attendue si nécessaire." />
          <p className="text-right text-xs text-[#64748B]">{message.length}/4000</p>
        </div>
        <div className="flex justify-end">
          <Button type="button" onClick={submit} disabled={loading} className="min-h-11 bg-[#111B4D] text-white hover:bg-[#1E2A78]">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Envoyer maintenant
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
