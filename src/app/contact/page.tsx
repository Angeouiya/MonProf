"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Send,
  Clock,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { PublicLayout } from "@/components/layouts/public-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SUBJECTS = [
  "Question générale",
  "Aide pour réserver un cours",
  "Problème avec une réservation",
  "Proposer un professeur à l'administration",
  "Partenariat école / entreprise",
  "Facturation",
  "Autre",
];

const CONTACT_PATHS = [
  {
    icon: CalendarCheck,
    title: "Réserver plus vite",
    text: "Trouvez un professeur vérifié et lancez directement une réservation guidée.",
    href: "/professeurs",
    action: "Voir les professeurs",
  },
  {
    icon: Phone,
    title: "Besoin urgent",
    text: "Appelez le support si une réservation du jour, une adresse ou un paiement bloque.",
    href: "tel:+2252722000000",
    action: "Appeler le support",
  },
  {
    icon: Mail,
    title: "Dossier détaillé",
    text: "Envoyez une demande structurée pour partenariat, facturation ou situation spécifique.",
    href: "mailto:support@competence.ci",
    action: "Écrire un email",
  },
];

export default function ContactPage() {
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });
  const [subjectSelect, setSubjectSelect] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    if (form.message.trim().length < 10) {
      toast.error("Le message doit comporter au moins 10 caractères.");
      return;
    }
    if (!subjectSelect) {
      toast.error("Veuillez choisir un sujet.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, subject: subjectSelect }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Erreur lors de l'envoi du message");
      }
      toast.success("Votre message a bien été envoyé. Notre équipe vous répondra sous 48h.");
      setSuccess(true);
      setForm({ name: "", email: "", phone: "", subject: "", message: "" });
      setSubjectSelect("");
    } catch (err: any) {
      toast.error(err.message || "Une erreur est survenue. Réessayez.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PublicLayout>
      <section className="border-b border-[#E3E8F2] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <nav className="mb-5 inline-flex min-h-11 items-center rounded-lg border border-[#E3E8F2] bg-white px-3 py-1 text-xs text-[#64748B]">
            <Link href="/" className="inline-flex min-h-11 items-center rounded-lg px-1 hover:text-[#111B4D]">Accueil</Link>
            <span className="mx-1.5">/</span>
            <span className="text-[#111827]">Contact</span>
          </nav>
          <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-end">
          <div className="max-w-3xl">
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#111B4D]">
              <MessageSquare className="h-3.5 w-3.5" />
              Support humain et suivi administratif
            </span>
            <h1 className="mt-5 text-3xl font-semibold text-[#111827] sm:text-4xl text-balance">
              Contactez-nous
            </h1>
            <p className="mt-4 text-base text-[#64748B] sm:text-lg">
              Une question, un problème, une demande de partenariat ? Notre
              équipe vous répond sous 48h ouvrées.
            </p>
            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              <HeroMetric label="Réponse" value="24-48h" />
              <HeroMetric label="Support" value="Lun-Sam" />
              <HeroMetric label="Zone" value="Abidjan" />
            </div>
          </div>
          <div className="rounded-lg border border-[#E3E8F2] bg-white p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#111B4D] text-white ring-1 ring-[#111B4D]">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#111827]">Paiement et litiges protégés</p>
                <p className="text-xs text-[#64748B]">Notre équipe garde une trace de chaque demande.</p>
              </div>
            </div>
          </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[#E3E8F2] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid gap-3 md:grid-cols-3">
            {CONTACT_PATHS.map((item) => (
              <ContactPathCard key={item.title} {...item} />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
            {/* FORMULAIRE */}
            <div className="rounded-lg border border-[#E3E8F2] bg-white p-5 sm:p-6">
              {success ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-[#111B4D] text-white ring-1 ring-[#111B4D]">
                    <CheckCircle2 className="h-7 w-7" />
                  </div>
                  <h2 className="mt-4 text-lg font-semibold text-[#111827]">
                    Message envoyé
                  </h2>
                  <p className="mt-2 max-w-md text-sm text-[#64748B]">
                    Merci pour votre message. Notre équipe vous répondra par
                    e-mail sous 48h ouvrées.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-6"
                    onClick={() => setSuccess(false)}
                  >
                    Envoyer un autre message
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="rounded-lg border border-[#DDE6F7] bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Message structuré</p>
                    <h2 className="mt-1 text-lg font-semibold text-[#111827]">Décrivez votre besoin, nous orientons le dossier.</h2>
                    <p className="mt-1 text-sm leading-6 text-[#394568]">
                      Plus votre demande est précise, plus notre équipe peut vous répondre vite : réservation concernée, professeur, matière, date ou moyen de paiement.
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="name">
                        Nom complet <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="name"
                        required
                        value={form.name}
                        onChange={(e) =>
                          setForm({ ...form, name: e.target.value })
                        }
                        placeholder="Ex. Kouassi Aya"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="email">
                        Email <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        required
                        value={form.email}
                        onChange={(e) =>
                          setForm({ ...form, email: e.target.value })
                        }
                        placeholder="vous@exemple.ci"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="phone">Téléphone</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={form.phone}
                        onChange={(e) =>
                          setForm({ ...form, phone: e.target.value })
                        }
                        placeholder="+225 07 00 00 00 00"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="subject">
                        Sujet <span className="text-destructive">*</span>
                      </Label>
                      <Select value={subjectSelect} onValueChange={setSubjectSelect}>
                        <SelectTrigger id="subject" className="w-full">
                          <SelectValue placeholder="Choisir un sujet" />
                        </SelectTrigger>
                        <SelectContent>
                          {SUBJECTS.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="message">
                      Message <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      id="message"
                      required
                      rows={6}
                      value={form.message}
                      onChange={(e) =>
                        setForm({ ...form, message: e.target.value })
                      }
                      placeholder="Décrivez votre demande en quelques lignes..."
                      className="resize-y"
                    />
                    <p className="text-xs text-[#64748B]">
                      {form.message.length} caractères (minimum 10)
                    </p>
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full sm:w-auto"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-lg border-2 border-[#CAD7F2] border-t-white" />
                        Envoi en cours...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Envoyer le message
                      </>
                    )}
                  </Button>
                </form>
              )}
            </div>

            {/* INFOS CONTACT */}
            <aside className="space-y-4">
              <div className="rounded-lg border border-[#E3E8F2] bg-white p-5">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-[#111827]">
                  <MessageSquare className="h-4 w-4 text-[#111B4D]" />
                  Coordonnées
                </h2>
                <ul className="mt-4 space-y-4 text-sm">
                  <li className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-white ring-1 ring-[#111B4D]">
                      <Phone className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs text-[#64748B]">Téléphone</p>
                      <p className="font-medium text-[#111827]">
                        +225 27 22 00 00 00
                      </p>
                      <p className="text-xs text-[#64748B]">
                        Lun. – Sam. · 8h – 18h
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-white ring-1 ring-[#111B4D]">
                      <Mail className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs text-[#64748B]">Email</p>
                      <p className="font-medium text-[#111827]">
                        support@competence.ci
                      </p>
                      <p className="text-xs text-[#64748B]">
                        Réponse sous 48h
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-white ring-1 ring-[#111B4D]">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs text-[#64748B]">Adresse</p>
                      <p className="font-medium text-[#111827]">
                        Cocody, Abidjan
                      </p>
                      <p className="text-xs text-[#64748B]">
                        Côte d'Ivoire
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-white ring-1 ring-[#111B4D]">
                      <Clock className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs text-[#64748B]">Horaires</p>
                      <p className="font-medium text-[#111827]">
                        Lun. – Sam. · 8h – 18h
                      </p>
                      <p className="text-xs text-[#64748B]">
                        Fermé le dimanche
                      </p>
                    </div>
                  </li>
                </ul>
              </div>

              <div className="rounded-lg border border-[#E3E8F2] bg-white p-5">
                <h3 className="text-sm font-semibold text-[#111827]">
                  Besoin d'aide rapide ?
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-[#64748B]">
                  Consultez la page « Comment ça marche » pour trouver une
                  réponse immédiate à la plupart de vos questions.
                </p>
                <Link
                  href="/comment-ca-marche"
                  className="mt-3 inline-flex min-h-11 items-center gap-1 rounded-lg border border-[#E3E8F2] bg-white px-3 text-xs font-semibold text-[#111B4D] hover:border-[#111B4D]"
                >
                  Voir comment ça marche
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#E3E8F2] bg-white px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">{label}</p>
      <p className="mt-1 text-base font-semibold text-[#111827]">{value}</p>
    </div>
  );
}

function ContactPathCard({
  icon: Icon,
  title,
  text,
  href,
  action,
}: {
  icon: typeof Phone;
  title: string;
  text: string;
  href: string;
  action: string;
}) {
  const external = href.startsWith("tel:") || href.startsWith("mailto:");

  const content = (
    <article className="group h-full rounded-lg border border-[#E3E8F2] bg-white p-5 transition hover:border-[#111B4D]">
      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#111B4D] text-white ring-1 ring-[#111B4D]">
        <Icon className="h-5 w-5" />
      </div>
      <h2 className="mt-4 text-base font-semibold text-[#111827]">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#64748B]">{text}</p>
      <p className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#111B4D]">
        {action}
        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
      </p>
    </article>
  );

  if (external) {
    return <a href={href}>{content}</a>;
  }

  return <Link href={href}>{content}</Link>;
}
