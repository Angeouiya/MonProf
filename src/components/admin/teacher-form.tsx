"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, Camera, CheckCircle2, Clock, FileText, KeyRound, Loader2, Save, Search, ShieldCheck, Sparkles, Trash2, UploadCloud, X } from "lucide-react";
import { ProfessorImage } from "@/components/shared/professor-image";
import { SearchableCatalogSelect } from "@/components/shared/searchable-catalog-select";
import { createEmptyAvailability, normalizeAvailability, TWO_HOUR_SLOTS, WEEK_DAYS } from "@/lib/scheduling";
import { validateTeacherPhotoUrl } from "@/lib/teacher-photo";
import { PLATFORM_COMMISSION_PERCENT, TEACHER_PERCENT } from "@/lib/pricing";

const PUBLIC_VISIBLE_TEACHER_STATUSES = ["ACTIVE"] as const;

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function matchesSearch(label: string, query: string) {
  const normalizedLabel = normalizeSearch(label);
  const normalizedQuery = normalizeSearch(query);
  if (!normalizedQuery) return true;
  return normalizedQuery.split(/\s+/).every((part) => normalizedLabel.includes(part));
}

function isPublicVisibleTeacherStatus(status?: string) {
  return PUBLIC_VISIBLE_TEACHER_STATUSES.includes(status as (typeof PUBLIC_VISIBLE_TEACHER_STATUSES)[number]);
}

const schema = z.object({
  fullName: z.string().min(2, "Nom requis"),
  professionalName: z.string().optional(),
  photoUrl: z.string().trim().optional().default(""),
  phone: z.string().min(5, "Téléphone requis"),
  portalAccessEnabled: z.boolean().default(false),
  portalPhone: z.string().optional(),
  portalPassword: z.string().optional(),
  email: z.string().optional(),
  commune: z.string().optional(),
  quartier: z.string().optional(),
  addressHint: z.string().optional(),
  jobTitle: z.string().min(2, "Titre requis"),
  bio: z.string().min(10, "Bio trop courte"),
  experienceYears: z.coerce.number().min(0).default(0),
  diploma: z.string().optional(),
  cvUrl: z.string().optional(),
  careerSummary: z.string().optional(),
  skills: z.string().optional(),
  workHistory: z.string().optional(),
  certifications: z.string().optional(),
  teachingAchievements: z.string().optional(),
  learnersCoached: z.coerce.number().min(0).default(0),
  profileType: z.string().default("ENSEIGNANT"),
  status: z.string().default("ACTIVE"),
  featured: z.boolean().default(false),
  badgeVerified: z.boolean().default(true),
  badgeRecommended: z.boolean().default(false),
  badgeNew: z.boolean().default(true),
  badgePopular: z.boolean().default(false),
  badgePremium: z.boolean().default(false),
  internalNote: z.string().optional(),
  offersHome: z.boolean().default(true),
  offersOnline: z.boolean().default(true),
  offersGroup: z.boolean().default(false),
  pricePerHour: z.coerce.number().min(0).default(10000),
  pricePerSession: z.coerce.number().min(0).default(10000),
  pricePack4: z.coerce.number().min(0).default(38000),
  pricePack8: z.coerce.number().min(0).default(72000),
  commissionRate: z.coerce.number().min(0).max(100).default(PLATFORM_COMMISSION_PERCENT),
  pricingTier: z.string().default("STANDARD"),
}).superRefine((values, ctx) => {
  const photoUrl = values.photoUrl?.trim() ?? "";
  if (isPublicVisibleTeacherStatus(values.status) && !photoUrl) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["photoUrl"],
      message: "La photo réelle du professeur est obligatoire pour un profil actif visible.",
    });
    return;
  }
  if (photoUrl && !validateTeacherPhotoUrl(photoUrl).ok) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["photoUrl"],
      message: "Utilisez une photo JPG, JPEG, PNG ou WEBP avec une URL http(s) ou un chemin local.",
    });
  }
  if (values.portalAccessEnabled) {
    const loginPhone = values.portalPhone?.trim() || values.phone?.trim();
    if (!loginPhone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["portalPhone"],
        message: "Téléphone de connexion requis pour activer l'espace professeur.",
      });
    }
    if (values.portalPassword && values.portalPassword.length < 6) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["portalPassword"],
        message: "Le mot de passe professeur doit contenir au moins 6 caractères.",
      });
    }
  }
});

type FormValues = z.infer<typeof schema>;

type Subject = { id: string; name: string };
type Level = { id: string; name: string };
type Commune = { id: string; name: string };
type CvAnalysisFields = Partial<Pick<
  FormValues,
  "jobTitle" | "bio" | "experienceYears" | "diploma" | "cvUrl" | "careerSummary" | "skills" | "workHistory" | "certifications" | "teachingAchievements" | "learnersCoached" | "profileType"
>>;
type CvAnalysisResult = {
  fields: CvAnalysisFields;
  detectedSections?: Array<{ label: string; items: string[] }>;
  previewText?: string;
  extractedCharacters?: number;
  confidence?: number;
  warnings?: string[];
  filename?: string;
};

const MAX_PHOTO_SIZE = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_CV_SIZE = 6 * 1024 * 1024;
const CV_ACCEPT = ".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown";
const CV_FIELD_LABELS: Partial<Record<keyof CvAnalysisFields, string>> = {
  jobTitle: "Titre professionnel",
  bio: "Bio",
  experienceYears: "Années d'expérience",
  diploma: "Diplôme principal",
  careerSummary: "Mini CV",
  skills: "Compétences clés",
  workHistory: "Parcours",
  certifications: "Certifications / preuves",
  teachingAchievements: "Résultats",
  learnersCoached: "Apprenants encadrés",
  profileType: "Type de profil",
};

function countAvailabilitySlots(availability: Record<string, Record<string, boolean>>) {
  return WEEK_DAYS.reduce(
    (total, day) => total + TWO_HOUR_SLOTS.filter((slot) => availability[day.key]?.[slot.key]).length,
    0,
  );
}

export function TeacherForm({
  mode,
  teacherId,
  initial,
  subjects,
  levels,
  communes,
}: {
  mode: "create" | "edit";
  teacherId?: string;
  initial?: any;
  subjects: Subject[];
  levels: Level[];
  communes: Commune[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [analyzingCv, setAnalyzingCv] = useState(false);
  const [cvError, setCvError] = useState<string | null>(null);
  const [cvAnalysis, setCvAnalysis] = useState<CvAnalysisResult | null>(null);

  // Selections
  const [selectedSubjects, setSelectedSubjects] = useState<Record<string, boolean>>({});
  const [primarySubject, setPrimarySubject] = useState<string | null>(null);
  const [selectedLevels, setSelectedLevels] = useState<Record<string, boolean>>({});
  const [selectedZones, setSelectedZones] = useState<Record<string, boolean>>({});
  const [subjectQuery, setSubjectQuery] = useState("");
  const [levelQuery, setLevelQuery] = useState("");
  const [zoneQuery, setZoneQuery] = useState("");
  const [availability, setAvailability] = useState<Record<string, Record<string, boolean>>>(() => createEmptyAvailability());

  const { register, handleSubmit, control, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: initial
      ? {
          ...initial,
          experienceYears: initial.experienceYears ?? 0,
          learnersCoached: initial.learnersCoached ?? 0,
          pricePerHour: initial.pricePerHour ?? 10000,
          pricePerSession: initial.pricePerSession ?? 10000,
          pricePack4: initial.pricePack4 ?? 38000,
          pricePack8: initial.pricePack8 ?? 72000,
          commissionRate: initial.commissionRate ?? PLATFORM_COMMISSION_PERCENT,
          portalAccessEnabled: initial.portalAccessEnabled ?? false,
          portalPhone: initial.portalPhone || initial.phone || "",
          portalPassword: "",
        }
      : {
          profileType: "ENSEIGNANT",
          status: "ACTIVE",
          pricingTier: "STANDARD",
          badgeVerified: true,
          badgeNew: true,
          offersHome: true,
          offersOnline: true,
          commissionRate: PLATFORM_COMMISSION_PERCENT,
          pricePerHour: 10000,
          pricePerSession: 10000,
          pricePack4: 38000,
          pricePack8: 72000,
          experienceYears: 0,
          learnersCoached: 0,
          portalAccessEnabled: false,
          portalPhone: "",
          portalPassword: "",
        } as any,
  });

  // Initialize selections from initial (edit mode)
  useEffect(() => {
    if (!initial) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const sSub: Record<string, boolean> = {};
      let primary: string | null = null;
      for (const s of initial.subjects ?? []) {
        const sid = s.subjectId || s.id;
        sSub[sid] = true;
        if (s.isPrimary) primary = sid;
      }
      setSelectedSubjects(sSub);
      setPrimarySubject(primary);
      const sLvl: Record<string, boolean> = {};
      for (const l of initial.levels ?? []) sLvl[l.levelId || l.id] = true;
      setSelectedLevels(sLvl);
      const sZ: Record<string, boolean> = {};
      for (const z of initial.zones ?? []) sZ[z.communeId || z.id] = true;
      setSelectedZones(sZ);
      if (initial.availability && typeof initial.availability === "object") {
        setAvailability(normalizeAvailability(initial.availability));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [initial]);

  const [
    commissionRate,
    photoUrl,
    fullName,
    professionalName,
    badgeVerified,
    status,
    portalAccessEnabled,
  ] = useWatch({
    control,
    name: [
      "commissionRate",
      "photoUrl",
      "fullName",
      "professionalName",
      "badgeVerified",
      "status",
      "portalAccessEnabled",
    ],
  });
  const previewName = professionalName || fullName || initial?.professionalName || initial?.fullName || "Professeur";
  const activeWithoutPhoto = isPublicVisibleTeacherStatus(status) && !photoUrl;
  const communeSelectionGroups = useMemo(() => [{
    label: "Villes et communes de Côte d'Ivoire",
    options: communes.map((commune) => ({
      value: commune.name,
      label: commune.name,
      keywords: commune.name,
    })),
  }], [communes]);
  const visibleCommunes = useMemo(() => {
    const normalizedQuery = normalizeSearch(zoneQuery);
    if (!normalizedQuery) return communes;
    return communes.filter((commune) => normalizeSearch(commune.name).includes(normalizedQuery));
  }, [communes, zoneQuery]);
  const visibleSubjects = useMemo(() => {
    return subjects.filter((subject) => matchesSearch(subject.name, subjectQuery));
  }, [subjects, subjectQuery]);
  const visibleLevels = useMemo(() => {
    return levels.filter((level) => matchesSearch(level.name, levelQuery));
  }, [levels, levelQuery]);
  const selectedSubjectCount = useMemo(
    () => Object.values(selectedSubjects).filter(Boolean).length,
    [selectedSubjects],
  );
  const selectedLevelCount = useMemo(
    () => Object.values(selectedLevels).filter(Boolean).length,
    [selectedLevels],
  );
  const selectedSubjectItems = useMemo(
    () => subjects.filter((subject) => selectedSubjects[subject.id]),
    [subjects, selectedSubjects],
  );
  const selectedLevelItems = useMemo(
    () => levels.filter((level) => selectedLevels[level.id]),
    [levels, selectedLevels],
  );

  const uploadPhoto = async (file?: File) => {
    setPhotoError(null);
    if (!file) return;
    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      setPhotoError("Format non autorisé. Utilisez JPG, JPEG, PNG ou WEBP.");
      return;
    }
    if (file.size > MAX_PHOTO_SIZE) {
      setPhotoError("Photo trop lourde. Taille maximale autorisée : 5 Mo.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    setUploadingPhoto(true);
    try {
      const res = await fetch("/api/admin/uploads/teacher-photo", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload impossible");
      setValue("photoUrl", data.photoUrl, { shouldDirty: true, shouldValidate: true });
      toast.success("Photo du professeur ajoutée");
    } catch (e: any) {
      setPhotoError(e.message || "Erreur pendant l'upload de la photo.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const applyCvAnalysis = (fields: CvAnalysisFields, showToast = false) => {
    let applied = 0;
    const applyString = (name: keyof CvAnalysisFields) => {
      const value = fields[name];
      if (typeof value !== "string" || !value.trim()) return;
      setValue(name as any, value.trim(), { shouldDirty: true, shouldValidate: true });
      applied += 1;
    };
    applyString("jobTitle");
    applyString("bio");
    applyString("diploma");
    applyString("careerSummary");
    applyString("skills");
    applyString("workHistory");
    applyString("certifications");
    applyString("teachingAchievements");
    applyString("profileType");
    if (typeof fields.experienceYears === "number" && Number.isFinite(fields.experienceYears)) {
      setValue("experienceYears", fields.experienceYears, { shouldDirty: true, shouldValidate: true });
      applied += 1;
    }
    if (typeof fields.learnersCoached === "number" && Number.isFinite(fields.learnersCoached)) {
      setValue("learnersCoached", fields.learnersCoached, { shouldDirty: true, shouldValidate: true });
      applied += 1;
    }
    if (showToast) {
      toast.success(applied ? `${applied} champ(s) professionnel(s) appliqué(s)` : "Aucun champ exploitable à appliquer");
    }
  };

  const analyzeCv = async (file?: File) => {
    setCvError(null);
    if (!file) return;
    const lowerName = file.name.toLowerCase();
    const allowed = [".pdf", ".docx", ".txt", ".md"].some((extension) => lowerName.endsWith(extension));
    if (!allowed) {
      setCvError("Format non autorisé. Utilisez PDF texte, DOCX, TXT ou MD.");
      return;
    }
    if (file.size > MAX_CV_SIZE) {
      setCvError("CV trop lourd. Taille maximale autorisée : 6 Mo.");
      return;
    }
    if (file.size <= 0) {
      setCvError("CV vide ou invalide.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    setAnalyzingCv(true);
    try {
      const res = await fetch("/api/admin/teachers/analyze-cv", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analyse impossible");
      setCvAnalysis(data);
      applyCvAnalysis(data.fields ?? {});
      toast.success("CV analysé et mini CV prérempli");
    } catch (e: any) {
      setCvError(e.message || "Erreur pendant l'analyse du CV.");
    } finally {
      setAnalyzingCv(false);
    }
  };

  const onSubmit = async (values: FormValues) => {
    if (Object.values(selectedSubjects).every((v) => !v)) {
      toast.error("Sélectionnez au moins une matière");
      return;
    }
    if (!primarySubject) {
      toast.error("Définissez une matière principale");
      return;
    }
    if (Object.values(selectedLevels).every((v) => !v)) {
      toast.error("Sélectionnez au moins un niveau enseigné");
      return;
    }
    if (values.status === "ACTIVE" && countAvailabilitySlots(availability) === 0) {
      toast.error("Un professeur actif doit avoir au moins un créneau de 2h disponible.");
      return;
    }
    if (values.portalAccessEnabled) {
      const loginPhone = values.portalPhone?.trim() || values.phone?.trim();
      const portalPassword = values.portalPassword?.trim();
      if (!loginPhone) {
        toast.error("Ajoutez le téléphone de connexion du professeur.");
        return;
      }
      if ((mode === "create" || !initial?.hasPortalPassword) && !portalPassword) {
        toast.error("Définissez le mot de passe d'accès professeur. Aucun OTP ne sera demandé.");
        return;
      }
      if (portalPassword && portalPassword.length < 6) {
        toast.error("Le mot de passe professeur doit contenir au moins 6 caractères.");
        return;
      }
    }
    setSaving(true);
    try {
      const payload = {
        ...values,
        subjects: Object.entries(selectedSubjects)
          .filter(([, v]) => v)
          .map(([id]) => ({ subjectId: id, isPrimary: id === primarySubject })),
        levels: Object.entries(selectedLevels).filter(([, v]) => v).map(([id]) => ({ levelId: id })),
        zones: Object.entries(selectedZones).filter(([, v]) => v).map(([id]) => ({ communeId: id })),
        availability,
      };

      const url = mode === "create" ? "/api/admin/teachers" : `/api/admin/teachers/${teacherId}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      toast.success(mode === "create" ? "Professeur créé" : "Professeur mis à jour");
      if (mode === "create" && data.id) {
        router.push(`/admin/professeurs/${data.id}`);
      } else {
        router.push(`/admin/professeurs/${teacherId}`);
        router.refresh();
      }
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const updateAvailability = (dayKey: string, slotKey: string, value: boolean) => {
    setAvailability((prev) => ({
      ...prev,
      [dayKey]: { ...prev[dayKey], [slotKey]: value },
    }));
  };
  const setDayAvailability = (dayKey: string, value: boolean) => {
    setAvailability((prev) => ({
      ...prev,
      [dayKey]: TWO_HOUR_SLOTS.reduce<Record<string, boolean>>((acc, slot) => {
        acc[slot.key] = value;
        return acc;
      }, {}),
    }));
  };
  const setSlotAcrossDays = (slotKey: string, value: boolean) => {
    setAvailability((prev) => {
      const next = { ...prev };
      for (const day of WEEK_DAYS) {
        next[day.key] = { ...next[day.key], [slotKey]: value };
      }
      return next;
    });
  };
  const setAvailabilityPreset = (preset: "weekdays" | "weekends" | "evenings" | "clear") => {
    if (preset === "clear") {
      setAvailability(createEmptyAvailability());
      return;
    }
    setAvailability((prev) => {
      const next = createEmptyAvailability();
      const dayKeys = preset === "weekends"
        ? ["sat", "sun"]
        : preset === "weekdays"
          ? ["mon", "tue", "wed", "thu", "fri"]
          : WEEK_DAYS.map((day) => day.key);
      const slotKeys = preset === "evenings" ? ["18-20", "20-22"] : TWO_HOUR_SLOTS.map((slot) => slot.key);

      for (const dayKey of dayKeys) {
        next[dayKey] = { ...prev[dayKey] };
        for (const slotKey of slotKeys) next[dayKey][slotKey] = true;
      }
      return next;
    });
  };
  const selectedAvailabilityCount = countAvailabilitySlots(availability);
  const selectedAvailabilityHours = selectedAvailabilityCount * 2;
  const daysWithAvailability = WEEK_DAYS.filter((day) => TWO_HOUR_SLOTS.some((slot) => availability[day.key]?.[slot.key])).length;

  return (
    <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-5">
      <Tabs defaultValue="infos" className="w-full">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 border border-violet-100 bg-white p-1">
          <TabsTrigger value="infos">Informations</TabsTrigger>
          <TabsTrigger value="acces">Accès prof</TabsTrigger>
          <TabsTrigger value="pro">Pro</TabsTrigger>
          <TabsTrigger value="matieres">Matières & Niveaux</TabsTrigger>
          <TabsTrigger value="dispo">Disponibilités</TabsTrigger>
          <TabsTrigger value="zones">Zones</TabsTrigger>
          <TabsTrigger value="tarifs">Tarifs</TabsTrigger>
          <TabsTrigger value="eval">Évaluation</TabsTrigger>
        </TabsList>

        {/* INFOS */}
        <TabsContent value="infos">
          <Card>
            <CardHeader><CardTitle className="text-base">Informations personnelles</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <div className="flex flex-col gap-4 rounded-lg border border-violet-100 bg-violet-50/45 p-4 sm:flex-row sm:items-center">
                  <ProfessorImage photoUrl={photoUrl} name={previewName} size="lg" shape="circle" verified={Boolean(badgeVerified)} />
                  <div className="min-w-0 flex-1 space-y-3">
                    <div>
                      <Label>Photo réelle du professeur *</Label>
                      <p className="text-xs text-muted-foreground">
                        Obligatoire pour créer ou activer un professeur visible. JPG, JPEG, PNG ou WEBP. Maximum 5 Mo.
                      </p>
                    </div>
                    <input
                      id="teacher-photo"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(event) => uploadPhoto(event.target.files?.[0])}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" asChild disabled={uploadingPhoto}>
                        <label htmlFor="teacher-photo" className="cursor-pointer">
                          {uploadingPhoto ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Camera className="mr-2 h-4 w-4" />
                          )}
                          {photoUrl ? "Changer la photo" : "Ajouter une photo"}
                        </label>
                      </Button>
                      {photoUrl && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setValue("photoUrl", "", { shouldDirty: true, shouldValidate: true });
                            setPhotoError(isPublicVisibleTeacherStatus(status)
                              ? "Photo supprimée : passez le professeur en inactif ou ajoutez une nouvelle photo avant d'enregistrer."
                              : null);
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Supprimer
                        </Button>
                      )}
                    </div>
                    <Input {...register("photoUrl")} placeholder="/uploads/teachers/photo.jpg" className="max-w-xl" />
                    {errors.photoUrl?.message && <p className="text-xs font-medium text-destructive">{errors.photoUrl.message}</p>}
                    {photoError && <p className="text-xs font-medium text-destructive">{photoError}</p>}
                    {activeWithoutPhoto && !errors.photoUrl?.message && (
                      <p className="text-xs font-medium text-amber-700">
                        Un professeur actif n'apparait jamais publiquement sans vraie photo. Ajoutez une photo ou changez son statut.
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <Field label="Nom complet" error={errors.fullName?.message} required>
                <Input {...register("fullName")} placeholder="Traoré Issa" />
              </Field>
              <Field label="Nom professionnel">
                <Input {...register("professionalName")} placeholder="M. Traoré" />
              </Field>
              <Field label="Téléphone" error={errors.phone?.message} required>
                <Input {...register("phone")} placeholder="+225 07 00 00 00 00" />
              </Field>
              <Field label="Email">
                <Input type="email" {...register("email")} placeholder="prof@competence.ci" />
              </Field>
              <Field label="Commune">
                <Controller control={control} name="commune" render={({ field }) => (
                  <SearchableCatalogSelect
                    name="commune"
                    value={field.value ?? ""}
                    onValueChange={field.onChange}
                    placeholder="Rechercher ou choisir une commune"
                    searchPlaceholder="Tapez une ville ou commune..."
                    emptyLabel="Aucune commune trouvée"
                    allLabel="Aucune commune principale"
                    groups={communeSelectionGroups}
                    triggerClassName="min-h-10"
                  />
                )} />
              </Field>
              <Field label="Quartier">
                <Input {...register("quartier")} placeholder="Riviera Palmeraie" />
              </Field>
              <Field label="Adresse approx. (indice)">
                <Input {...register("addressHint")} placeholder="Près de la pharmacie..." />
              </Field>
              <Field label="Statut">
                <Controller control={control} name="status" render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Actif</SelectItem>
                      <SelectItem value="INACTIVE">Inactif</SelectItem>
                      <SelectItem value="SUSPENDED">Suspendu</SelectItem>
                      <SelectItem value="PENDING">En attente</SelectItem>
                      <SelectItem value="TEMPORARILY_SUSPENDED">Suspendu temporairement</SelectItem>
                      <SelectItem value="PERMANENTLY_SUSPENDED">Suspendu définitivement</SelectItem>
                      <SelectItem value="OBSERVATION">En observation</SelectItem>
                      <SelectItem value="REPLACEABLE">Remplaçable</SelectItem>
                      <SelectItem value="PRIORITY">Prioritaire</SelectItem>
                      <SelectItem value="BLACKLISTED">Blacklisté</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </Field>
              <Field label="Mis en avant">
                <Controller control={control} name="featured" render={({ field }) => (
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                )} />
              </Field>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ACCÈS PROFESSEUR */}
        <TabsContent value="acces">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4 text-violet-700" />
                Accès à la plateforme professeur
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Le professeur ne s'inscrit pas publiquement. L'administration active un accès léger avec téléphone et mot de passe, sans code de validation.
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Controller control={control} name="portalAccessEnabled" render={({ field }) => (
                  <label className={`flex cursor-pointer flex-col gap-3 rounded-lg border p-4 transition sm:flex-row sm:items-center sm:justify-between ${field.value ? "border-violet-200 bg-violet-50 text-violet-950" : "border-violet-100 bg-white"}`}>
                    <div>
                      <p className="text-sm font-black text-foreground">Activer l'espace professeur</p>
                      <p className="mt-1 text-xs font-semibold leading-5 text-muted-foreground">
                        Donne accès à /professeur avec uniquement ses missions, disponibilités, paiements, notifications, avis et profil.
                      </p>
                    </div>
                    <Switch checked={!!field.value} onCheckedChange={field.onChange} />
                  </label>
                )} />
              </div>

              <Field label="Téléphone de connexion" error={errors.portalPhone?.message}>
                <Input {...register("portalPhone")} placeholder="+225 07 00 00 00 00" disabled={!portalAccessEnabled} />
                <p className="text-xs font-medium leading-5 text-muted-foreground">
                  Ce numéro est l'identifiant du professeur sur /professeur. Aucun code de validation n'est demandé.
                </p>
              </Field>
              <Field
                label={mode === "create" ? "Mot de passe d'accès" : "Nouveau mot de passe d'accès"}
                error={errors.portalPassword?.message}
              >
                <Input
                  type="text"
                  {...register("portalPassword")}
                  placeholder={mode === "create" ? "Ex: prof123" : "Laisser vide pour conserver l'ancien"}
                  disabled={!portalAccessEnabled}
                />
              </Field>

              <div className="sm:col-span-2 grid gap-3 rounded-lg border border-violet-100 bg-violet-50/45 p-4">
                <div className="flex items-start gap-3">
                  <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-violet-700" />
                  <div>
                    <p className="text-sm font-black text-foreground">Règle d'accès</p>
                    <p className="mt-1 text-sm font-medium leading-6 text-muted-foreground">
                      Le professeur utilise uniquement son numéro de téléphone et le mot de passe communiqué par l'administration. Il ne peut pas modifier ses tarifs, créer des réservations ou accéder aux données d'autres professeurs.
                    </p>
                    {mode === "edit" && initial?.hasPortalPassword && portalAccessEnabled && (
                      <p className="mt-2 text-xs font-bold text-violet-900">
                        Un mot de passe est déjà enregistré. Saisissez-en un nouveau uniquement pour le réinitialiser.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PRO */}
        <TabsContent value="pro">
          <Card>
            <CardHeader><CardTitle className="text-base">Informations professionnelles</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Titre professionnel" error={errors.jobTitle?.message} required>
                <Input {...register("jobTitle")} placeholder="Professeur de Mathématiques" />
              </Field>
              <Field label="Années d'expérience">
                <Input type="number" min={0} {...register("experienceYears")} />
              </Field>
              <Field label="Diplôme principal">
                <Input {...register("diploma")} placeholder="Master Mathématiques" />
              </Field>
              <Field label="CV (URL)">
                <Input {...register("cvUrl")} placeholder="https://..." />
              </Field>
              <Field label="Apprenants encadrés">
                <Input type="number" min={0} {...register("learnersCoached")} placeholder="Ex : 120" />
              </Field>
              <Field label="Type de profil">
                <Controller control={control} name="profileType" render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ENSEIGNANT">Enseignant</SelectItem>
                      <SelectItem value="ETUDIANT">Étudiant</SelectItem>
                      <SelectItem value="REPETITEUR">Répétiteur</SelectItem>
                      <SelectItem value="FORMATEUR">Formateur</SelectItem>
                      <SelectItem value="PROFESSIONNEL">Professionnel</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </Field>
              <div className="sm:col-span-2 rounded-lg border border-[#D8DEE9] bg-white p-4">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-white">
                        <Sparkles className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-[#111827]">Analyse automatique du CV</h3>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          Chargez un CV PDF texte, DOCX, TXT ou MD. L'analyse démarre immédiatement et remplit automatiquement le mini CV, les compétences, les expériences, les diplômes et les résultats.
                        </p>
                      </div>
                    </div>
                    <input
                      id="teacher-cv-analysis"
                      type="file"
                      accept={CV_ACCEPT}
                      className="hidden"
                      onChange={(event) => {
                        analyzeCv(event.target.files?.[0]);
                        event.currentTarget.value = "";
                      }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <Button type="button" variant="outline" asChild disabled={analyzingCv}>
                      <label htmlFor="teacher-cv-analysis" className="cursor-pointer">
                        {analyzingCv ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <UploadCloud className="mr-2 h-4 w-4" />
                        )}
                        {analyzingCv ? "Analyse en cours" : "Charger un CV"}
                      </label>
                    </Button>
                    {cvAnalysis?.fields && (
                      <Button type="button" variant="ghost" onClick={() => applyCvAnalysis(cvAnalysis.fields, true)}>
                        <FileText className="mr-2 h-4 w-4" />
                        Réappliquer
                      </Button>
                    )}
                  </div>
                </div>
                {cvError && (
                  <p className="mt-3 rounded-lg border border-red-100 bg-white px-3 py-2 text-sm font-semibold text-red-700">
                    {cvError}
                  </p>
                )}
                {cvAnalysis && (
                  <div className="mt-4 space-y-3">
                    <div className="flex items-start gap-2 rounded-lg border border-[#CAD7F2] bg-white px-3 py-2 text-sm font-semibold text-[#111B4D]">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        {Object.values(cvAnalysis.fields ?? {}).filter((value) => value !== undefined && value !== null && value !== "").length} champs professionnels ont été remplis automatiquement. Vous pouvez les contrôler puis enregistrer le professeur.
                      </span>
                    </div>
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
                    <div className="rounded-lg border border-[#E3E8F2] bg-white p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="bg-white text-[#111B4D] ring-1 ring-[#D8DEE9]">
                          {cvAnalysis.filename || "CV analysé"}
                        </Badge>
                        <Badge variant="secondary" className="bg-white text-[#111B4D] ring-1 ring-[#D8DEE9]">
                          Confiance {cvAnalysis.confidence ?? 0}%
                        </Badge>
                        <span className="text-xs font-semibold text-muted-foreground">
                          {cvAnalysis.extractedCharacters ?? 0} caractères extraits
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {Object.entries(cvAnalysis.fields ?? {}).map(([key, value]) => {
                          if (value === undefined || value === null || value === "") return null;
                          const label = CV_FIELD_LABELS[key as keyof CvAnalysisFields] ?? key;
                          const text = typeof value === "number" ? String(value) : String(value).split("\n").slice(0, 2).join(" · ");
                          return (
                            <div key={key} className="rounded-lg border border-[#E3E8F2] bg-white px-3 py-2">
                              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
                              <p className="mt-1 line-clamp-3 text-sm font-semibold leading-5 text-[#111827]">{text}</p>
                            </div>
                          );
                        })}
                      </div>
                      {!!cvAnalysis.warnings?.length && (
                        <div className="mt-3 space-y-1 text-xs font-semibold text-amber-700">
                          {cvAnalysis.warnings.map((warning) => (
                            <p key={warning}>{warning}</p>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="rounded-lg border border-[#E3E8F2] bg-white p-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Sections détectées</p>
                      <div className="mt-2 space-y-2">
                        {(cvAnalysis.detectedSections ?? []).slice(0, 5).map((section) => (
                          <div key={section.label}>
                            <p className="text-xs font-bold text-[#111B4D]">{section.label}</p>
                            <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">
                              {section.items.slice(0, 3).join(" · ")}
                            </p>
                          </div>
                        ))}
                        {!cvAnalysis.detectedSections?.length && (
                          <p className="text-xs leading-5 text-muted-foreground">
                            Aucune section structurée détectée. Les champs restent modifiables manuellement.
                          </p>
                        )}
                      </div>
                    </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="sm:col-span-2">
                <Field label="Bio" error={errors.bio?.message} required>
                  <Textarea rows={5} {...register("bio")} placeholder="Présentation pédagogique..." />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Résumé carrière / mini CV">
                  <Textarea
                    rows={4}
                    {...register("careerSummary")}
                    placeholder="Ex : 10 ans d'expérience entre lycée, soutien à domicile et préparation concours. Méthode orientée résultats, avec suivi des familles."
                  />
                </Field>
              </div>
              <div className="sm:col-span-2 grid gap-4 lg:grid-cols-2">
                <Field label="Compétences clés">
                  <Textarea
                    rows={5}
                    {...register("skills")}
                    placeholder={"Une compétence par ligne\nPréparation BAC série D\nRemise à niveau adulte\nMéthodologie intensive"}
                  />
                </Field>
                <Field label="Parcours et expériences">
                  <Textarea
                    rows={5}
                    {...register("workHistory")}
                    placeholder={"Une expérience par ligne\n2018-2024 - Encadrement Terminale à Cocody\nFormateur vacataire en soutien scolaire\nPréparation concours INP-HB / ENS"}
                  />
                </Field>
                <Field label="Certifications / preuves">
                  <Textarea
                    rows={4}
                    {...register("certifications")}
                    placeholder={"Un élément par ligne\nMaster vérifié\nDiplôme transmis à l'administration\nRéférences pédagogiques disponibles"}
                  />
                </Field>
                <Field label="Résultats et encadrements">
                  <Textarea
                    rows={4}
                    {...register("teachingAchievements")}
                    placeholder={"Un résultat par ligne\nPlusieurs élèves suivis jusqu'au BAC\nProgression moyenne constatée après 4 séances\nSuivi parent régulier"}
                  />
                </Field>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* MATIÈRES & NIVEAUX */}
        <TabsContent value="matieres">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Matières enseignées</CardTitle>
              <p className="text-sm text-muted-foreground">
                Recherchez rapidement une matière ou un niveau, cochez les choix du professeur, puis définissez la matière principale.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 rounded-lg border border-violet-100 bg-white p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="search"
                    value={subjectQuery}
                    onChange={(event) => setSubjectQuery(event.target.value)}
                    placeholder="Tapez une matière : mathématiques, couture, génie civil..."
                    aria-label="Rechercher une matière enseignée"
                    className="h-11 rounded-lg border-violet-100 bg-white pl-9"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <span>{visibleSubjects.length} / {subjects.length}</span>
                  <span className="rounded-full border border-violet-100 bg-white px-2 py-1 text-[#111B4D]">
                    {selectedSubjectCount} sélectionnée{selectedSubjectCount > 1 ? "s" : ""}
                  </span>
                  {subjectQuery && (
                    <button
                      type="button"
                      onClick={() => setSubjectQuery("")}
                      className="inline-flex min-h-8 items-center rounded-lg border border-violet-100 bg-white px-2 text-[#111B4D] transition hover:border-[#111B4D]"
                    >
                      Effacer
                    </button>
                  )}
                </div>
              </div>
              {selectedSubjectItems.length > 0 && (
                <div className="rounded-lg border border-violet-100 bg-white p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Matières sélectionnées
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedSubjectItems.map((subject) => (
                      <button
                        key={subject.id}
                        type="button"
                        onClick={() => {
                          setSelectedSubjects((prev) => ({ ...prev, [subject.id]: false }));
                          if (primarySubject === subject.id) setPrimarySubject(null);
                        }}
                        className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-[#CAD7F2] bg-white px-3 text-xs font-bold text-[#111B4D] transition hover:border-[#111B4D]"
                      >
                        <span>{subject.name}</span>
                        {primarySubject === subject.id && <span className="text-[10px] text-violet-700">Principale</span>}
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid gap-2 min-[420px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
                {visibleSubjects.map((s) => {
                  const checked = !!selectedSubjects[s.id];
                  return (
                    <label key={s.id} className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${checked ? "border-violet-200 bg-violet-50 text-violet-900" : "border-violet-100 bg-white hover:border-violet-200 hover:bg-violet-50/60"}`}>
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => {
                          setSelectedSubjects((prev) => ({ ...prev, [s.id]: !!v }));
                          if (!v && primarySubject === s.id) setPrimarySubject(null);
                        }}
                      />
                      <span className="min-w-0 flex-1 leading-snug">{s.name}</span>
                      {checked && (
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); setPrimarySubject(s.id); }}
                          className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-bold leading-none ${primarySubject === s.id ? "border-[#111B4D] bg-[#111B4D] text-white" : "border-[#CAD7F2] bg-white text-[#111B4D] hover:border-[#111B4D]"}`}
                        >
                          {primarySubject === s.id ? "Principale" : "Définir principale"}
                        </button>
                      )}
                    </label>
                  );
                })}
                {visibleSubjects.length === 0 && (
                  <div className="rounded-lg border border-dashed border-violet-100 bg-white p-4 text-sm font-medium text-muted-foreground min-[420px]:col-span-2 sm:col-span-3 lg:col-span-4">
                    Aucune matière ne correspond à cette recherche.
                  </div>
                )}
              </div>
              <div className="border-t border-border pt-4">
                <p className="mb-2 text-sm font-medium text-foreground">Niveaux enseignés</p>
                <div className="mb-3 grid gap-2 rounded-lg border border-violet-100 bg-white p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="search"
                      value={levelQuery}
                      onChange={(event) => setLevelQuery(event.target.value)}
                      placeholder="Tapez un niveau : BAC, BTS, adulte, concours..."
                      aria-label="Rechercher un niveau enseigné"
                      className="h-11 rounded-lg border-violet-100 bg-white pl-9"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground">
                    <span>{visibleLevels.length} / {levels.length}</span>
                    <span className="rounded-full border border-violet-100 bg-white px-2 py-1 text-[#111B4D]">
                      {selectedLevelCount} sélectionné{selectedLevelCount > 1 ? "s" : ""}
                    </span>
                    {levelQuery && (
                      <button
                        type="button"
                        onClick={() => setLevelQuery("")}
                        className="inline-flex min-h-8 items-center rounded-lg border border-violet-100 bg-white px-2 text-[#111B4D] transition hover:border-[#111B4D]"
                      >
                        Effacer
                      </button>
                    )}
                  </div>
                </div>
                {selectedLevelItems.length > 0 && (
                  <div className="mb-3 rounded-lg border border-violet-100 bg-white p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Niveaux sélectionnés
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedLevelItems.map((level) => (
                        <button
                          key={level.id}
                          type="button"
                          onClick={() => setSelectedLevels((prev) => ({ ...prev, [level.id]: false }))}
                          className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-[#CAD7F2] bg-white px-3 text-xs font-bold text-[#111B4D] transition hover:border-[#111B4D]"
                        >
                          <span>{level.name}</span>
                          <X className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid gap-2 min-[420px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
                  {visibleLevels.map((l) => {
                    const checked = !!selectedLevels[l.id];
                    return (
                      <label key={l.id} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${checked ? "border-violet-200 bg-violet-50 text-violet-900" : "border-violet-100 bg-white hover:border-violet-200 hover:bg-violet-50/60"}`}>
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => setSelectedLevels((prev) => ({ ...prev, [l.id]: !!v }))}
                        />
                        <span className="min-w-0 leading-snug">{l.name}</span>
                      </label>
                    );
                  })}
                  {visibleLevels.length === 0 && (
                    <div className="rounded-lg border border-dashed border-violet-100 bg-white p-4 text-sm font-medium text-muted-foreground min-[420px]:col-span-2 sm:col-span-3 lg:col-span-5">
                      Aucun niveau ne correspond à cette recherche.
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DISPONIBILITÉS */}
        <TabsContent value="dispo">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarClock className="h-4 w-4 text-violet-700" />
                Disponibilités détaillées du professeur
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Cochez les créneaux exacts du professeur. Une séance dure toujours 2 heures.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 rounded-lg border border-violet-100 bg-violet-50/45 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="grid gap-3 sm:grid-cols-3">
                  <AvailabilityMetric label="Créneaux ouverts" value={`${selectedAvailabilityCount}`} detail={`${selectedAvailabilityHours}h disponibles`} />
                  <AvailabilityMetric label="Jours couverts" value={`${daysWithAvailability}/7`} detail="Planning hebdomadaire" />
                  <AvailabilityMetric label="Durée séance" value="2h" detail="Chaque réservation suit ce format" />
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:w-[360px]">
                  <Button type="button" variant="outline" className="justify-start rounded-lg bg-white" onClick={() => setAvailabilityPreset("weekdays")}>
                    Jours ouvrés
                  </Button>
                  <Button type="button" variant="outline" className="justify-start rounded-lg bg-white" onClick={() => setAvailabilityPreset("weekends")}>
                    Week-end
                  </Button>
                  <Button type="button" variant="outline" className="justify-start rounded-lg bg-white" onClick={() => setAvailabilityPreset("evenings")}>
                    Soirs
                  </Button>
                  <Button type="button" variant="ghost" className="justify-start rounded-lg" onClick={() => setAvailabilityPreset("clear")}>
                    Tout vider
                  </Button>
                </div>
              </div>
              {selectedAvailabilityCount === 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-100 bg-amber-50/80 p-3 text-sm text-amber-950">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                  <p>
                    Aucun créneau défini. Un professeur actif ne pourra pas être enregistré sans au moins une disponibilité de 2h.
                  </p>
                </div>
              )}
              <div className="space-y-3 lg:hidden">
                {WEEK_DAYS.map((day) => {
                  const selectedCount = TWO_HOUR_SLOTS.filter((slot) => availability[day.key]?.[slot.key]).length;
                  return (
                    <section key={day.key} className="rounded-lg border border-violet-100 bg-white p-3">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{day.label}</p>
                          <p className="text-xs text-muted-foreground">{selectedCount} créneau{selectedCount > 1 ? "x" : ""} de 2h sélectionné{selectedCount > 1 ? "s" : ""}</p>
                        </div>
                        <div className="flex shrink-0 gap-1.5">
                          <Button type="button" variant="outline" size="sm" className="h-8 px-2 text-[11px]" onClick={() => setDayAvailability(day.key, true)}>
                            Tout
                          </Button>
                          <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-[11px]" onClick={() => setDayAvailability(day.key, false)}>
                            Vider
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-3">
                        {TWO_HOUR_SLOTS.map((slot) => {
                          const checked = !!availability[day.key]?.[slot.key];
                          return (
                            <button
                              key={slot.key}
                              type="button"
                              onClick={() => updateAvailability(day.key, slot.key, !checked)}
                              className={`min-h-11 rounded-lg border px-2 py-2 text-center text-xs font-semibold transition ${checked ? "border-violet-300 bg-violet-50 text-violet-900" : "border-violet-100 bg-slate-50 text-slate-600 hover:border-violet-200 hover:bg-white"}`}
                              aria-pressed={checked}
                              aria-label={`${day.label}, plage horaire ${slot.label}`}
                            >
                              {slot.label}
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>

              <div className="hidden overflow-x-auto lg:block">
                <table className="min-w-[1060px] w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th scope="col" className="py-2 text-left font-medium text-muted-foreground">Jour</th>
                    {TWO_HOUR_SLOTS.map((s) => (
                      <th key={s.key} scope="col" className="px-2 py-2 text-center">
                        <button
                          type="button"
                          className="min-h-11 rounded-lg px-2 py-1 text-xs font-semibold text-muted-foreground transition hover:bg-violet-50 hover:text-violet-800"
                          onClick={() => setSlotAcrossDays(s.key, !WEEK_DAYS.every((day) => availability[day.key]?.[s.key]))}
                          aria-label={`Sélectionner la plage ${s.label} pour tous les jours`}
                        >
                          <span className="block text-[10px] font-medium uppercase text-muted-foreground">Plage horaire</span>
                          <span className="mt-0.5 block whitespace-nowrap text-[#111827]">{s.label}</span>
                        </button>
                      </th>
                    ))}
                    <th scope="col" className="py-2 text-right font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {WEEK_DAYS.map((d) => {
                    const selectedCount = TWO_HOUR_SLOTS.filter((slot) => availability[d.key]?.[slot.key]).length;
                    return (
                      <tr key={d.key} className="border-b border-border last:border-0">
                        <td className="py-2 font-medium text-foreground">
                          <div>
                            <p>{d.label}</p>
                            <p className="text-[11px] font-normal text-muted-foreground">{selectedCount} créneau{selectedCount > 1 ? "x" : ""}</p>
                          </div>
                        </td>
                        {TWO_HOUR_SLOTS.map((s) => (
                          <td key={s.key} className="px-4 py-2 text-center">
                            <Checkbox
                              checked={!!availability[d.key]?.[s.key]}
                              onCheckedChange={(v) => updateAvailability(d.key, s.key, !!v)}
                              aria-label={`${d.label}, plage horaire ${s.label}`}
                            />
                          </td>
                        ))}
                        <td className="py-2 text-right">
                          <div className="flex justify-end gap-1.5">
                            <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg px-2 text-[11px]" onClick={() => setDayAvailability(d.key, true)}>
                              Tout
                            </Button>
                            <Button type="button" variant="ghost" size="sm" className="h-8 rounded-lg px-2 text-[11px]" onClick={() => setDayAvailability(d.key, false)}>
                              Vider
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ZONES */}
        <TabsContent value="zones">
          <Card>
            <CardHeader><CardTitle className="text-base">Zones d'intervention</CardTitle></CardHeader>
            <CardContent>
              <div className="mb-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <Input
                  type="search"
                  value={zoneQuery}
                  onChange={(event) => setZoneQuery(event.target.value)}
                  placeholder="Rechercher une ville ou commune..."
                  className="h-11 rounded-lg border-violet-100 bg-white"
                />
                <p className="text-xs font-semibold text-muted-foreground">
                  {visibleCommunes.length} / {communes.length} commune{communes.length > 1 ? "s" : ""}
                </p>
              </div>
              <div className="grid gap-2 min-[420px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
                {visibleCommunes.map((c) => {
                  const checked = !!selectedZones[c.id];
                  return (
                    <label key={c.id} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${checked ? "border-violet-200 bg-violet-50 text-violet-900" : "border-violet-100 bg-white hover:border-violet-200 hover:bg-violet-50/60"}`}>
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => setSelectedZones((prev) => ({ ...prev, [c.id]: !!v }))}
                      />
                      <span className="min-w-0 leading-snug">{c.name}</span>
                    </label>
                  );
                })}
                {visibleCommunes.length === 0 && (
                  <div className="rounded-lg border border-violet-100 bg-white p-4 text-sm font-medium text-muted-foreground sm:col-span-3 lg:col-span-4">
                    Aucune commune ne correspond à cette recherche.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TARIFS */}
        <TabsContent value="tarifs">
          <Card>
            <CardHeader><CardTitle className="text-base">Tarification (FCFA)</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Tarif / heure">
                <Input type="number" min={0} step={500} {...register("pricePerHour")} />
              </Field>
              <Field label="Tarif / séance">
                <Input type="number" min={0} step={500} {...register("pricePerSession")} />
              </Field>
              <Field label="Pack 4 séances">
                <Input type="number" min={0} step={500} {...register("pricePack4")} />
              </Field>
              <Field label="Pack 8 séances">
                <Input type="number" min={0} step={500} {...register("pricePack8")} />
              </Field>
              <Field label="Commission officielle (%)">
                <Input type="number" min={0} max={100} {...register("commissionRate")} />
              </Field>
              <Field label="Tier tarifaire">
                <Controller control={control} name="pricingTier" render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="STANDARD">Standard</SelectItem>
                      <SelectItem value="RECOMMENDED">Recommandé</SelectItem>
                      <SelectItem value="PREMIUM">Premium</SelectItem>
                      <SelectItem value="PROMOTIONAL">Promotionnel</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </Field>

              <div className="sm:col-span-2 grid gap-3 rounded-lg border border-violet-100 bg-violet-50/50 p-4">
                <div>
                  <p className="text-sm font-black text-foreground">Référence grille officielle</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Les prix saisis ici sont des indications internes du profil. Au moment de la réservation, le prix est calculé par catégorie, niveau, système scolaire, format, pack, groupe et déplacement.
                  </p>
                </div>
                <div className="grid gap-2 text-center sm:grid-cols-3">
                  <div className="rounded-lg border border-violet-100 bg-white p-3">
                    <p className="text-xs text-muted-foreground">Commission cours</p>
                    <p className="text-sm font-semibold">{commissionRate ?? PLATFORM_COMMISSION_PERCENT}%</p>
                  </div>
                  <div className="rounded-lg border border-violet-100 bg-white p-3">
                    <p className="text-xs text-muted-foreground">Part professeur</p>
                    <p className="text-sm font-semibold">{TEACHER_PERCENT}% + déplacement</p>
                  </div>
                  <div className="rounded-lg border border-violet-100 bg-white p-3">
                    <p className="text-xs text-muted-foreground">Remises packs</p>
                    <p className="text-sm font-semibold">Prises sur commission</p>
                  </div>
                </div>
              </div>

              <div className="sm:col-span-2 grid gap-3 sm:grid-cols-3">
                <FormatSwitch control={control} name="offersHome" label="À domicile" />
                <FormatSwitch control={control} name="offersOnline" label="En ligne" />
                <FormatSwitch control={control} name="offersGroup" label="Groupe" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ÉVALUATION */}
        <TabsContent value="eval">
          <Card>
            <CardHeader><CardTitle className="text-base">Avis publics, notes admin & badges</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 rounded-lg border border-blue-100 bg-blue-50/70 p-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-900/70">Note publique client</p>
                  <p className="mt-1 text-2xl font-black text-blue-950">
                    {Number(initial?.rating ?? 0).toFixed(1)}/5
                  </p>
                  <p className="mt-1 text-xs text-blue-900/75">
                    Calculée automatiquement à partir des avis clients publiés.
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-900/70">Avis publiés</p>
                  <p className="mt-1 text-2xl font-black text-blue-950">{Number(initial?.ratingCount ?? 0)}</p>
                  <p className="mt-1 text-xs text-blue-900/75">
                    L'admin ne modifie pas cette note depuis le formulaire professeur.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <BadgeToggle control={control} name="badgeVerified" label="Vérifié" />
                <BadgeToggle control={control} name="badgeRecommended" label="Recommandé" />
                <BadgeToggle control={control} name="badgeNew" label="Nouveau" />
                <BadgeToggle control={control} name="badgePopular" label="Populaire" />
                <BadgeToggle control={control} name="badgePremium" label="Premium" />
              </div>
              <Field label="Commentaire interne (admin)">
                <Textarea rows={3} {...register("internalNote")} placeholder="Notes, observations..." />
              </Field>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="sticky bottom-0 flex items-center justify-end gap-2 rounded-lg border border-violet-100 bg-white p-3">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          <X className="mr-1.5 h-4 w-4" /> Annuler
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
          {mode === "create" ? "Créer le professeur" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, error, required, children }: { label: string; error?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-foreground">
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function FormatSwitch({ control, name, label }: { control: any; name: "offersHome" | "offersOnline" | "offersGroup"; label: string }) {
  return (
    <Controller control={control} name={name} render={({ field }) => (
      <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-violet-100 bg-white px-3 py-2 transition hover:border-violet-200 hover:bg-violet-50/60">
        <span className="text-sm font-medium">{label}</span>
        <Switch checked={!!field.value} onCheckedChange={field.onChange} />
      </label>
    )} />
  );
}

function AvailabilityMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-violet-100 bg-white p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-violet-950/55">{label}</p>
      <p className="mt-1 text-xl font-black text-violet-950">{value}</p>
      <p className="mt-1 text-xs font-medium text-muted-foreground">{detail}</p>
    </div>
  );
}

function BadgeToggle({ control, name, label }: { control: any; name: any; label: string }) {
  return (
    <Controller control={control} name={name} render={({ field }) => (
      <label className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2 transition ${field.value ? "border-violet-200 bg-violet-50 text-violet-900" : "border-violet-100 bg-white hover:bg-violet-50/60"}`}>
        <span className="text-sm font-medium">{label}</span>
        <Switch checked={!!field.value} onCheckedChange={field.onChange} />
      </label>
    )} />
  );
}
