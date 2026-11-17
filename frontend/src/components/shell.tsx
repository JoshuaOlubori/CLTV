import type { ReactNode } from "react";
import { useMeta } from "@/hooks/use-api";
import { fill } from "@/lib/i18n";
import { useApp, type View } from "@/store/app";
import { useFormat, useT } from "./shared";

const NAV: { view: View; key: "nav_overview" | "nav_transitions" | "nav_subscribers"; icon: ReactNode }[] = [
  {
    view: "overview",
    key: "nav_overview",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="8" height="10" rx="2" />
        <rect x="13" y="3" width="8" height="6" rx="2" />
        <rect x="13" y="11" width="8" height="10" rx="2" />
        <rect x="3" y="15" width="8" height="6" rx="2" />
      </svg>
    ),
  },
  {
    view: "transitions",
    key: "nav_transitions",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7h12a4 4 0 0 1 4 4v0" />
        <path d="M15 3l4 4-4 4" />
        <path d="M21 17H9a4 4 0 0 1-4-4v0" />
        <path d="M9 21l-4-4 4-4" />
      </svg>
    ),
  },
  {
    view: "subscribers",
    key: "nav_subscribers",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="8" r="4" />
        <path d="M2 21c0-4 3-6 7-6s7 2 7 6" />
        <path d="M17 4a4 4 0 0 1 0 8" />
        <path d="M19 15c2 1 3 3 3 6" />
      </svg>
    ),
  },
];

const HEADLINES: Record<View, "h_overview" | "h_transitions" | "h_subscribers"> = {
  overview: "h_overview",
  transitions: "h_transitions",
  subscribers: "h_subscribers",
};

export function Shell({ children }: { children: ReactNode }) {
  const t = useT();
  const f = useFormat();
  const { data: meta } = useMeta();
  const lang = useApp((s) => s.lang);
  const view = useApp((s) => s.view);
  const setLang = useApp((s) => s.setLang);
  const show = useApp((s) => s.show);

  return (
    <div className="shell">
      <aside className="rail">
        <div className="brand">
          <div className="brand-mark">CLTV</div>
          <div>
            <b>{t.brand}</b>
            <span>MTN Bénin</span>
          </div>
        </div>
        <nav className="nav" role="tablist">
          {NAV.map((item) => (
            <button
              key={item.view}
              role="tab"
              type="button"
              aria-selected={view === item.view}
              onClick={() => show(item.view)}
            >
              {item.icon}
              <span>{t[item.key]}</span>
            </button>
          ))}
        </nav>
        <div className="rail-foot">
          <div className="lang" role="group" aria-label="Language / Langue">
            {(["en", "fr"] as const).map((l) => (
              <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          {meta?.run.is_synthetic === 1 && (
            <p className="rail-note">
              <b>{t.synthetic}</b>
              <span>{t.synthetic_note}</span>
            </p>
          )}
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div>
            <span className="kicker">{t.kicker}</span>
            {/* wording comes from our own dictionary, with <em> highlights */}
            <h1 dangerouslySetInnerHTML={{ __html: t[HEADLINES[view]] }} />
          </div>
          <span className="datechip">
            <i />
            <span>
              {meta
                ? fill(t.dates, { start: f.day(meta.run.obs_start), end: f.day(meta.run.analysis_date) })
                : t.loading}
            </span>
          </span>
        </header>

        {children}

        <p className="preview-note">{t.preview_note}</p>
      </div>
    </div>
  );
}