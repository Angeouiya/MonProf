"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, CheckCircle2, Loader2, Search, Send, X } from "lucide-react";
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

export function CommunicationCampaignComposer() {
  const router = useRouter();
  const [audience, setAudience] = useState("ALL_USERS");
  const [priority, setPriority] = useState("NORMAL");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");
  const [actionLabel, setActionLabel] = useState("");
  const [targetId, setTargetId] = useState("");
  const [targetLabel, setTargetLabel] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Recipient[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "warning"; message: string } | null>(null);

  const targeted = audience === "ONE_CLIENT" || audience === "ONE_TEACHER";

  useEffect(() => {
    if (!targeted) {
      return;
    }
    const normalized = query.trim();
    if (normalized.length < 2) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const type = audience === "ONE_TEACHER" ? "TEACHER" : "CLIENT";
        const response = await fetch(`/api/admin/communication-recipients?type=${type}&q=${encodeURIComponent(normalized)}&limit=20`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({ items: [] }));
        if (response.ok) setResults(Array.isArray(data.items) ? data.items : []);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [audience, query, targeted]);

  const changeAudience = (value: string) => {
    setAudience(value);
    setTargetId("");
    setTargetLabel("");
    setQuery("");
    setResults([]);
    setNotice(null);
  };

  const submit = async () => {
    setNotice(null);
    if (!title.trim() || !message.trim()) {
      setNotice({ tone: "warning", message: "Ajoutez un titre et un message avant d'envoyer." });
      return;
    }
    if (targeted && !targetId) {
      setNotice({ tone: "warning", message: "Sélectionnez le destinataire exact dans la recherche." });
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
          link: link.trim() || null,
          actionLabel: actionLabel.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Diffusion impossible.");
      setNotice({
        tone: "success",
        message: `Campagne ${data.campaign?.reference || ""} lancée vers ${data.campaign?.recipientCount ?? 0} destinataire(s). Le suivi se met à jour par lots.`,
      });
      setTitle("");
      setMessage("");
      setLink("");
      setActionLabel("");
      setTargetId("");
      setTargetLabel("");
      setQuery("");
      setResults([]);
      router.refresh();
    } catch (error) {
      setNotice({ tone: "warning", message: error instanceof Error ? error.message : "Diffusion impossible." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="overflow-hidden border-[#CBD5E1] bg-white" data-admin-communication-composer>
      <CardHeader className="border-b border-[#E2E8F0] bg-white">
        <CardTitle className="flex items-center gap-2 text-base text-[#111827]">
          <BellRing className="h-4 w-4 text-[#111B4D]" />
          Centre de communication
        </CardTitle>
        <p className="text-sm leading-6 text-[#64748B]">
          Envoyez un message à une personne précise ou à une audience complète. Les diffusions massives partent par lots sécurisés, puis le push prend le relais appareil par appareil.
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
          <div className="space-y-2 rounded-lg border border-[#E2E8F0] bg-white p-3" data-admin-communication-recipient-search>
            <Label htmlFor="campaign-recipient-search">Rechercher le destinataire</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
              <Input
                id="campaign-recipient-search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setTargetId("");
                  setTargetLabel("");
                  if (event.target.value.trim().length < 2) setResults([]);
                }}
                placeholder={audience === "ONE_TEACHER" ? "Nom, téléphone ou matière" : "Nom, email ou téléphone"}
                className="min-h-11 pl-9"
              />
              {searching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[#111B4D]" />}
            </div>
            {targetLabel && (
              <p className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">
                <CheckCircle2 className="h-4 w-4" />
                Destinataire sélectionné : {targetLabel}
              </p>
            )}
            {results.length > 0 && (
              <div className="grid gap-2">
                {results.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setTargetId(item.id);
                      setTargetLabel(`${item.name}${item.detail ? ` · ${item.detail}` : ""}`);
                    }}
                    className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-left text-sm font-semibold text-[#111827] transition hover:border-[#111B4D]"
                  >
                    <span className="block">{item.name}</span>
                    {item.detail && <span className="mt-0.5 block text-xs font-medium text-[#64748B]">{item.detail}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="campaign-title">Titre</Label>
          <Input id="campaign-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={180} placeholder="Information importante Compétence..." className="min-h-11" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="campaign-message">Message</Label>
          <Textarea id="campaign-message" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={4000} rows={5} placeholder="Rédigez une information claire, avec les dates et l'action attendue si nécessaire." />
          <p className="text-right text-xs text-[#64748B]">{message.length}/4000</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="campaign-link">Lien d’action optionnel</Label>
            <Input id="campaign-link" value={link} onChange={(event) => setLink(event.target.value)} placeholder="/client/notifications ou /professeur/missions" className="min-h-11" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="campaign-action-label">Libellé du bouton optionnel</Label>
            <Input id="campaign-action-label" value={actionLabel} onChange={(event) => setActionLabel(event.target.value)} maxLength={80} placeholder="Voir le détail" className="min-h-11" />
          </div>
        </div>

        <div className="rounded-lg border border-[#E6EAF3] bg-[#F8FAFC] p-3 text-sm font-semibold leading-6 text-[#475569]">
          Conservation automatique : les messages standards restent visibles 90 jours, puis sortent des interfaces tout en conservant les journaux d’audit nécessaires.
        </div>

        {notice && (
          <p
            role="status"
            className={notice.tone === "success"
              ? "rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800"
              : "rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900"}
          >
            {notice.message}
          </p>
        )}

        <div className="flex justify-end">
          <Button type="button" onClick={submit} disabled={loading} className="min-h-11 bg-[#111B4D] text-white hover:bg-[#1E2A78]">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Lancer la communication
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
