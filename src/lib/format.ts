/** Formate un montant en FCFA */
export function formatFCFA(amount: number | null | undefined): string {
  const n = amount ?? 0;
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(n) + " FCFA";
}

/** Formate un montant court (k) */
export function formatFCFAShort(amount: number): string {
  if (amount >= 1000) {
    return Math.round(amount / 1000) + "k FCFA";
  }
  return amount + " FCFA";
}

/** Date FR courte */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

/** Date+heure FR */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** Temps relatif en FR */
export function timeAgo(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "à l'instant";
  const min = Math.floor(sec / 60);
  if (min < 60) return `il y a ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `il y a ${hr} h`;
  const days = Math.floor(hr / 24);
  if (days < 30) return `il y a ${days} j`;
  const months = Math.floor(days / 30);
  if (months < 12) return `il y a ${months} mois`;
  return `il y a ${Math.floor(months / 12)} an(s)`;
}

/** Génère une référence type MP-XXXX */
export function generateReference(prefix = "MP"): string {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${n}${Date.now().toString().slice(-3)}`;
}

/** Initiales à partir d'un nom */
export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
}

/** Avatar URL basé sur initiales */
export function avatarFromName(name: string): string {
  const i = initials(name) || "?";
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
      <rect width="128" height="128" rx="64" fill="#F3E8FF"/>
      <circle cx="100" cy="28" r="22" fill="#FFF7E6" opacity="0.95"/>
      <text x="50%" y="53%" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-size="42" font-weight="700" fill="#1E2A78">${i}</text>
    </svg>
  `.trim();

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
