"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, ImagePlus, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ProfessorImage } from "@/components/shared/professor-image";
import { TEACHER_COVER_CATALOG } from "@/lib/teacher-cover";

type TeacherProfileMediaFormProps = {
  teacherName: string;
  photoUrl?: string | null;
  coverUrl: string;
  selectedCoverUrl?: string | null;
  pendingCoverUrl?: string | null;
  verified: boolean;
};

export function TeacherProfileMediaForm({
  teacherName,
  photoUrl,
  coverUrl,
  selectedCoverUrl,
  pendingCoverUrl,
  verified,
}: TeacherProfileMediaFormProps) {
  const router = useRouter();
  const photoInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function send(formData: FormData, key: string, success: string) {
    setPending(key);
    setNotice(null);
    try {
      const response = await fetch("/api/professor/profile-media", { method: "POST", body: formData });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Mise à jour impossible.");
      setNotice(success);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Mise à jour impossible.");
    } finally {
      setPending(null);
    }
  }

  function upload(action: "profile-photo" | "custom-cover", file?: File) {
    if (!file) return;
    const formData = new FormData();
    formData.set("action", action);
    formData.set("file", file);
    void send(
      formData,
      action,
      action === "profile-photo" ? "Photo de profil mise à jour." : "Couverture envoyée pour validation. Elle restera privée jusqu'au contrôle Compétence.CI.",
    );
  }

  function selectCover(action: "catalog-cover" | "automatic-cover", nextCoverUrl?: string) {
    const formData = new FormData();
    formData.set("action", action);
    if (nextCoverUrl) formData.set("coverUrl", nextCoverUrl);
    void send(formData, nextCoverUrl ?? action, action === "automatic-cover"
      ? "La couverture automatique a été activée."
      : "Couverture du catalogue sélectionnée.");
  }

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-xl border border-[#DDE6F7] bg-white">
        <div className="relative aspect-[3/1] min-h-40 w-full overflow-hidden bg-[#111B4D]">
          <Image src={coverUrl} alt="Couverture pédagogique du profil" fill sizes="(max-width: 1280px) 100vw, 1100px" className="object-cover" priority />
          <div className="absolute inset-0 bg-gradient-to-t from-[#08103B]/55 via-transparent to-transparent" />
        </div>
        <div className="relative px-4 pb-4 pt-14 sm:px-6 sm:pt-4">
          <div className="absolute -top-14 left-1/2 -translate-x-1/2 rounded-full bg-white p-1.5 shadow-lg sm:left-6 sm:-translate-x-0">
            <ProfessorImage photoUrl={photoUrl} name={teacherName} size={112} verified={verified} />
          </div>
          <div className="sm:ml-36">
            <p className="text-lg font-semibold text-[#111827]">{teacherName}</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-[#64748B]">Votre présentation publique, optimisée sur mobile et ordinateur.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => {
          upload("profile-photo", event.target.files?.[0]);
          event.currentTarget.value = "";
        }} />
        <input ref={coverInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => {
          upload("custom-cover", event.target.files?.[0]);
          event.currentTarget.value = "";
        }} />
        <Button type="button" variant="outline" className="min-h-11 rounded-lg bg-white" disabled={Boolean(pending)} onClick={() => photoInput.current?.click()}>
          {pending === "profile-photo" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          Changer ma photo
        </Button>
        <Button type="button" variant="outline" className="min-h-11 rounded-lg bg-white" disabled={Boolean(pending)} onClick={() => coverInput.current?.click()}>
          {pending === "custom-cover" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          Importer une couverture
        </Button>
      </div>
      {notice ? (
        <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
          <Check className="mr-1.5 inline h-4 w-4" />
          {notice}
        </p>
      ) : null}
      {pendingCoverUrl ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-semibold text-amber-950">Couverture personnalisée en attente</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-amber-800">Elle n'est pas publique. L'administration vérifie qu'elle respecte la règle : une seule scène liée à l'enseignement, sans aucune personne.</p>
        </div>
      ) : null}

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-[#111827]">Catalogue pédagogique Compétence.CI · {TEACHER_COVER_CATALOG.length} couvertures</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-[#64748B]">Des décors élégants liés à l'enseignement, sans personne. JPG, PNG ou WEBP, 4 Mo maximum.</p>
          </div>
          <Button type="button" variant="ghost" className="rounded-lg text-[#111B4D]" disabled={Boolean(pending) || !selectedCoverUrl} onClick={() => selectCover("automatic-cover")}>
            {pending === "automatic-cover" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Choix automatique
          </Button>
        </div>
        <div className="mt-3 grid snap-x snap-mandatory auto-cols-[minmax(250px,82vw)] grid-flow-col gap-3 overflow-x-auto pb-2 sm:auto-cols-[280px]">
          {TEACHER_COVER_CATALOG.map((cover) => {
            const selected = selectedCoverUrl === cover.url;
            return (
              <button
                key={cover.id}
                type="button"
                disabled={Boolean(pending)}
                onClick={() => selectCover("catalog-cover", cover.url)}
                className={`snap-start overflow-hidden rounded-lg border bg-white text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111B4D] ${selected ? "border-[#111B4D] ring-2 ring-[#111B4D]/15" : "border-[#DDE6F7] hover:border-[#111B4D]"}`}
                aria-pressed={selected}
              >
                <span className="relative block aspect-[3/1] overflow-hidden bg-[#111B4D]">
                  <Image src={cover.url} alt="" fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover" />
                  {pending === cover.url ? <span className="absolute inset-0 grid place-items-center bg-[#08103B]/55 text-white"><Loader2 className="h-5 w-5 animate-spin" /></span> : null}
                </span>
                <span className="flex items-start justify-between gap-2 p-3">
                  <span>
                    <span className="block text-xs font-semibold text-[#111827]">{cover.label}</span>
                    <span className="mt-1 block text-[11px] font-medium leading-4 text-[#64748B]">{cover.description}</span>
                  </span>
                  {selected ? <Check className="h-4 w-4 shrink-0 text-[#111B4D]" /> : null}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
