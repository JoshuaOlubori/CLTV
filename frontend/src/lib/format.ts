import type { Lang } from "./i18n";

/** Number, money and date formatting, matching the design preview.
 *  Shares arrive as 0–1 fractions; backtest error figures are already %. */
export function makeFormat(lang: Lang, currency = "XOF") {
  const locale = lang === "fr" ? "fr-FR" : "en-US";

  const num = (v: number, d = 0) =>
    new Intl.NumberFormat(locale, { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);

  const cur = (s: string) => (lang === "fr" ? `${s} ${currency}` : `${currency} ${s}`);

  const money = (v: number) => cur(num(v));

  const short = (v: number) =>
    v >= 1e6
      ? num(v / 1e6, 1) + (lang === "fr" ? " M" : "M")
      : v >= 1e4
        ? num(v / 1e3, 1) + (lang === "fr" ? " k" : "K")
        : num(v);

  const pct = (f: number, d = 0) => num(f * 100, d) + (lang === "fr" ? " %" : "%");

  const day = (iso: string) =>
    new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(iso));

  const monthYear = (date: Date) =>
    new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", { month: "short", year: "numeric" }).format(date);

  return { num, cur, money, short, pct, day, monthYear };
}

export type Format = ReturnType<typeof makeFormat>;

/** green from 0.7, orange from 0.4, red below — the design's status colours. */
export function statusOf(p: number): "good" | "watch" | "bad" {
  return p >= 0.7 ? "good" : p >= 0.4 ? "watch" : "bad";
}

/** Index of a segment in the API's display order (best to worst); drives the
 *  --seg-N colours. Unknown names (agent accounts) fall back to grey. */
export function segIndex(segments: string[], name: string): number {
  const i = segments.indexOf(name);
  return i >= 0 ? i : 3;
}

/** "0-14 days" → "0–14", "90+ days" → "90+" for the freshness strip. */
export function shortBand(name: string): string {
  return name.replace(" days", "").replace("-", "–");
}