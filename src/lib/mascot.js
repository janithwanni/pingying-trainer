/* Bao (包), the app's steamed-bun mascot, as inline SVG. Moods change the
 * eyes and mouth; colours come from CSS variables so it follows the theme. */
const EYES = {
  happy: `<path d="M35 55q5-7 10 0M59 55q5-7 10 0" fill="none" stroke="var(--bao-ink)" stroke-width="3.2" stroke-linecap="round"/>`,
  cheer: `<path d="M35 55q5-8 10 0M59 55q5-8 10 0" fill="none" stroke="var(--bao-ink)" stroke-width="3.2" stroke-linecap="round"/>`,
  calm: `<circle cx="40" cy="54" r="3.4" fill="var(--bao-ink)"/><circle cx="64" cy="54" r="3.4" fill="var(--bao-ink)"/>`,
  think: `<circle cx="41" cy="52" r="3.4" fill="var(--bao-ink)"/><circle cx="65" cy="52" r="3.4" fill="var(--bao-ink)"/>`,
  sad: `<path d="M35 53q5 5 10 0M59 53q5 5 10 0" fill="none" stroke="var(--bao-ink)" stroke-width="3.2" stroke-linecap="round"/>`,
  sleepy: `<path d="M35 55h10M59 55h10" fill="none" stroke="var(--bao-ink)" stroke-width="3.2" stroke-linecap="round"/>`,
};
const MOUTHS = {
  happy: `<path d="M45 64q7 7 14 0" fill="none" stroke="var(--bao-ink)" stroke-width="3.2" stroke-linecap="round"/>`,
  cheer: `<path d="M44 62h16q-1 11-8 11t-8-11z" fill="var(--seal)" stroke="var(--bao-ink)" stroke-width="2.6" stroke-linejoin="round"/>`,
  calm: `<path d="M46 65q6 4 12 0" fill="none" stroke="var(--bao-ink)" stroke-width="3.2" stroke-linecap="round"/>`,
  think: `<circle cx="54" cy="66" r="3" fill="none" stroke="var(--bao-ink)" stroke-width="2.8"/>`,
  sad: `<path d="M46 68q6-5 12 0" fill="none" stroke="var(--bao-ink)" stroke-width="3.2" stroke-linecap="round"/>`,
  sleepy: `<circle cx="52" cy="66" r="2.6" fill="var(--bao-ink)"/>`,
};

/** @param {"happy"|"cheer"|"calm"|"think"|"sad"|"sleepy"} mood */
export function bao(mood = "happy", size = 96) {
  const m = EYES[mood] ? mood : "happy";
  return `<svg class="bao bao-${m}" viewBox="0 0 104 96" width="${size}" height="${Math.round((size * 96) / 104)}" role="img" aria-label="Bao the bun, ${m}">
    <ellipse cx="52" cy="89" rx="30" ry="4" fill="var(--bao-shadow)"/>
    <path d="M52 12c7 0 9 6 16 9 16 7 26 19 26 35 0 19-17 30-42 30S10 75 10 56c0-16 10-28 26-35 7-3 9-9 16-9z" fill="var(--bao-body)" stroke="var(--bao-ink)" stroke-width="3.2" stroke-linejoin="round"/>
    <path d="M52 13v13M41 19q4 5 5 11M63 19q-4 5-5 11" fill="none" stroke="var(--bao-ink)" stroke-width="2.6" stroke-linecap="round" opacity=".55"/>
    <ellipse cx="31" cy="64" rx="6" ry="4" fill="var(--bao-blush)"/><ellipse cx="73" cy="64" rx="6" ry="4" fill="var(--bao-blush)"/>
    ${EYES[m]}${MOUTHS[m]}
    ${m === "cheer" ? `<path d="M12 22l3 7 7 3-7 3-3 7-3-7-7-3 7-3zM90 10l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="var(--gold)"/>` : ""}
    ${m === "sleepy" ? `<text x="80" y="30" font-size="16" font-weight="800" fill="var(--ink-soft)">z</text><text x="90" y="18" font-size="11" font-weight="800" fill="var(--ink-soft)">z</text>` : ""}
  </svg>`;
}
