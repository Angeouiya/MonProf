import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminAccessDeniedPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center text-center">
      <ShieldAlert className="h-10 w-10 text-[#111B4D]" />
      <h1 className="mt-4 text-2xl font-semibold text-[#111827]">Accès non autorisé</h1>
      <p className="mt-2 text-sm leading-6 text-[#64748B]">Votre rôle ne permet pas d'ouvrir ce module. Le propriétaire peut modifier vos droits depuis l'équipe administratrice.</p>
      <Button asChild className="mt-5 bg-[#111B4D] text-white hover:bg-[#1E2A78]"><Link href="/admin">Retour au tableau de bord</Link></Button>
    </div>
  );
}
