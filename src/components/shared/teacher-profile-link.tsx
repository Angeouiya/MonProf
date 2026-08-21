"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, ExternalLink, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { publicClientUrl } from "@/lib/client-public-url";
import { teacherPublicSharePath } from "@/lib/teacher-public-link";

type TeacherProfileLinkProps = {
  teacherId: string;
  teacherName: string;
  mode?: "button" | "panel";
  published?: boolean;
};

export function TeacherProfileLink({
  teacherId,
  teacherName,
  mode = "button",
  published = true,
}: TeacherProfileLinkProps) {
  const [feedback, setFeedback] = useState("");
  const sharePath = teacherPublicSharePath(teacherId);
  const displayUrl = `competence.ci${sharePath}`;

  async function copyLink() {
    const shareUrl = publicClientUrl(sharePath);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const field = document.createElement("textarea");
        field.value = shareUrl;
        field.style.position = "fixed";
        field.style.opacity = "0";
        document.body.appendChild(field);
        field.select();
        const copied = document.execCommand("copy");
        field.remove();
        if (!copied) throw new Error("copy_failed");
      }
      setFeedback("Lien copié");
    } catch {
      setFeedback("Copie impossible");
    }
  }

  async function shareProfile() {
    const shareUrl = publicClientUrl(sharePath);
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: `${teacherName} sur Compétence.CI`,
          text: `Découvrez le profil de ${teacherName} et réservez votre cours sur Compétence.CI.`,
          url: shareUrl,
        });
        setFeedback("Profil partagé");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    await copyLink();
  }

  if (mode === "button") {
    return (
      <div className="inline-flex flex-col items-start gap-1" data-teacher-public-share-link>
        <Button type="button" variant="outline" onClick={() => void shareProfile()} className="min-h-11 rounded-lg bg-white">
          <Share2 className="mr-2 h-4 w-4" /> Partager le profil
        </Button>
        <span className="min-h-4 px-1 text-[11px] font-semibold text-[#64748B]" role="status" aria-live="polite">
          {feedback}
        </span>
      </div>
    );
  }

  return (
    <section className="mt-5 rounded-xl border border-[#DDE3EE] bg-white p-3 sm:p-4" data-teacher-public-link-panel>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-[#64748B]">Votre lien professeur</p>
          <p className="mt-1 truncate text-sm font-semibold text-[#111827]">{displayUrl}</p>
          <p className="mt-1 text-xs font-medium leading-5 text-[#64748B]">
            {published
              ? "Partagez-le sur vos réseaux pour envoyer directement les clients vers votre profil Compétence.CI."
              : "Ce lien est déjà réservé et deviendra public dès l’activation complète de votre profil."}
          </p>
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex">
          <Button type="button" variant="outline" onClick={() => void copyLink()} className="min-h-11 rounded-lg bg-white">
            {feedback === "Lien copié" ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
            Copier
          </Button>
          <Button type="button" onClick={() => void shareProfile()} className="min-h-11 rounded-lg bg-[#111B4D] text-white hover:bg-[#182260]">
            <Share2 className="mr-2 h-4 w-4" /> Partager
          </Button>
          {published ? (
            <Button asChild variant="outline" className="col-span-2 min-h-11 rounded-lg bg-white sm:col-span-1">
              <Link href={sharePath} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" /> Ouvrir
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
      <p className="mt-2 min-h-4 text-xs font-semibold text-[#111B4D]" role="status" aria-live="polite">{feedback}</p>
    </section>
  );
}
