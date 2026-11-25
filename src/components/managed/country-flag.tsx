/** Vector flags stay identical on phones and on Windows (no emoji fallback). */
export function ManagedCountryFlag({ journey }: { journey: "ivoirien" | "francais" }) {
  const colors = journey === "ivoirien" ? ["#ef8533", "#ffffff", "#19946b"] : ["#22478d", "#ffffff", "#d84b53"];
  return <svg width="23" height="17" viewBox="0 0 24 18" fill="none" aria-hidden="true">
    <rect width="8" height="18" fill={colors[0]} />
    <rect x="8" width="8" height="18" fill={colors[1]} />
    <rect x="16" width="8" height="18" fill={colors[2]} />
    <rect x=".5" y=".5" width="23" height="17" rx="1" stroke="#142d4e" strokeOpacity=".12" />
  </svg>;
}
