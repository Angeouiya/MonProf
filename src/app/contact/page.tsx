"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Send,
  Clock,
  CheckCircle2,
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
  "Devenir professeur partenaire",
  "Partenariat école / entreprise",
  "Facturation",
  "Autre",
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
      <section className="border-b border-border bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <nav className="mb-3 text-xs text-muted-foreground">
            <Link href="/" className="hover:text-foreground">Accueil</Link>
            <span className="mx-1.5">/</span>
            <span className="text-foreground">Contact</span>
          </nav>
          <div className="max-w-3xl">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl text-balance">
              Contactez-nous
            </h1>
            <p className="mt-4 text-base text-muted-foreground sm:text-lg">
              Une question, un problème, une demande de partenariat ? Notre
              équipe vous répond sous 48h ouvrées.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-background">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
            {/* FORMULAIRE */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
              {success ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <CheckCircle2 className="h-7 w-7" />
                  </div>
                  <h2 className="mt-4 text-lg font-semibold text-foreground">
                    Message envoyé
                  </h2>
                  <p className="mt-2 max-w-md text-sm text-muted-foreground">
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
                    <p className="text-xs text-muted-foreground">
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
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
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
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  Coordonnées
                </h2>
                <ul className="mt-4 space-y-4 text-sm">
                  <li className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Phone className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Téléphone</p>
                      <p className="font-medium text-foreground">
                        +225 27 22 00 00 00
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Lun. – Sam. · 8h – 18h
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Mail className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="font-medium text-foreground">
                        support@monprof.ci
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Réponse sous 48h
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Adresse</p>
                      <p className="font-medium text-foreground">
                        Cocody, Abidjan
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Côte d'Ivoire
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Clock className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Horaires</p>
                      <p className="font-medium text-foreground">
                        Lun. – Sam. · 8h – 18h
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Fermé le dimanche
                      </p>
                    </div>
                  </li>
                </ul>
              </div>

              <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
                <h3 className="text-sm font-semibold text-foreground">
                  Besoin d'aide rapide ?
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  Consultez la page « Comment ça marche » pour trouver une
                  réponse immédiate à la plupart de vos questions.
                </p>
                <Link
                  href="/comment-ca-marche"
                  className="mt-3 inline-flex text-xs font-medium text-primary hover:underline"
                >
                  Voir comment ça marche →
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
