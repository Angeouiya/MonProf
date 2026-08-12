import { KeyRound, ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";
import { TeacherPasswordSettingsForm } from "@/app/professeur/(espace)/parametres/settings-client";

export function TemporaryPasswordGate({ teacherName }: { teacherName: string }) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#EEF4FF_0,#F8FAFD_42%,#FFFFFF_100%)] px-4 py-6 text-[#111827]" data-temporary-password-gate="professor">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[30rem] flex-col justify-center">
        <div className="mb-6 flex justify-center">
          <BrandLogo size="lg" priority />
        </div>
        <section className="overflow-hidden rounded-[2rem] border border-[#DDE6F7] bg-white/95 p-4 shadow-[0_24px_70px_rgba(15,23,42,0.10)] sm:p-6">
          <div className="text-center" data-temporary-password-intro>
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-[1.15rem] bg-[#111B4D] text-white shadow-lg shadow-[#111B4D]/15">
              <KeyRound className="h-6 w-6" />
            </span>
            <p className="mt-4 text-xs font-black uppercase tracking-[0.22em] text-[#64748B]">Première connexion</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-[#111B4D]">Nouveau mot de passe</h1>
            <p className="mx-auto mt-2 max-w-sm text-sm font-semibold leading-6 text-[#64748B]">
              {teacherName}, remplacez le mot de passe reçu pour ouvrir votre espace.
            </p>
          </div>

          <div className="mt-5 rounded-[1.35rem] border border-[#E3E8F2] bg-[#F8FAFD] p-3 sm:p-4">
            <TeacherPasswordSettingsForm />
          </div>

          <p className="mt-4 flex items-center justify-center gap-2 rounded-full bg-[#F8FAFD] px-3 py-2 text-xs font-black text-[#111B4D]">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            Missions et paiements protégés.
          </p>
        </section>
      </div>
    </main>
  );
}
