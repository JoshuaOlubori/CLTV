import { useEffect, useRef } from "react";
import { CountUp } from "@/components/count-up";
import { ErrorNote, useFormat, useT } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMeta, useOverview } from "@/hooks/use-api";
import { shortBand, statusOf } from "@/lib/format";
import { displayName, fill } from "@/lib/i18n";
import type { Group, Meta, Overview } from "@/lib/types";
import { useApp } from "@/store/app";

export function OverviewPage() {
  const { data: meta } = useMeta();
  const overview = useOverview();

  if (overview.error) return <ErrorNote error={overview.error} onRetry={() => overview.refetch()} />;
  if (!overview.data || !meta) return <OverviewSkeleton />;

  return (
    <main className="view">
      <HeroCards data={overview.data} meta={meta} />
      <SegmentExplorer data={overview.data} />
      <div className="grid-2">
        <Deciles data={overview.data} />
        <Freshness data={overview.data} meta={meta} />
      </div>
      <Departments data={overview.data} />
    </main>
  );
}

function OverviewSkeleton() {
  return (
    <main className="view">
      <div className="grid-hero">
        <Skeleton style={{ height: 250, borderRadius: 26 }} />
        <Skeleton style={{ height: 250, borderRadius: 26 }} />
        <Skeleton style={{ height: 250, borderRadius: 26 }} />
      </div>
      <Skeleton style={{ height: 420, borderRadius: 26 }} />
      <div className="grid-2">
        <Skeleton style={{ height: 320, borderRadius: 26 }} />
        <Skeleton style={{ height: 320, borderRadius: 26 }} />
      </div>
    </main>
  );
}

/* ---------- hero: value / likely active / risk ---------- */

function HeroCards({ data, meta }: { data: Overview; meta: Meta }) {
  const t = useT();
  const f = useFormat();
  const lang = useApp((s) => s.lang);
  const { kpis, by_segment } = data;
  const totalRisk = kpis.value_at_risk;
  const atRisk = by_segment.find((s) => s.name === "At risk");

  return (
    <div className="grid-hero">
      <section className="card hero">
        <svg className="hero-rings" viewBox="0 0 340 340" aria-hidden="true">
          <circle cx="170" cy="170" r="60" />
          <circle cx="170" cy="170" r="105" />
          <circle cx="170" cy="170" r="150" />
        </svg>
        <div>
          <span className="label">{t.k_value}</span>
          <CountUp as="div" className="big" value={kpis.total_value} format={(v) => f.cur(f.short(v))} />
          <p className="note">{t.k_value_note}</p>
        </div>
        <div className="hero-stats">
          <div>
            <b>{f.money(kpis.average_value)}</b>
            <span>{t.s_avg}</span>
          </div>
          <div>
            <b>{f.num(kpis.sims)}</b>
            <span>{t.s_sims}</span>
          </div>
          <div>
            <b>{f.num(kpis.customers)}</b>
            <span>{t.s_cust}</span>
          </div>
        </div>
      </section>

      <GaugeCard share={kpis.likely_active_share} active={kpis.likely_active_customers} total={kpis.customers} threshold={meta.run.alive_threshold} />

      <section className="card risk">
        <div>
          <span className="label">{t.k_risk}</span>
          <CountUp as="div" className="big" value={totalRisk} format={(v) => f.cur(f.short(v))} />
        </div>
        <div className="stack">
          {by_segment.map((s, i) => (
            <i
              key={s.name}
              style={{
                width: `${totalRisk ? (s.value_at_risk / totalRisk) * 100 : 0}%`,
                background: s.name === "At risk" ? "var(--white)" : `var(--seg-${i})`,
                animationDelay: `${i * 70}ms`,
              }}
              data-tip={`<b>${displayName(s.name, lang)}</b><br>${f.money(s.value_at_risk)}`}
            />
          ))}
        </div>
        <p
          className="risk-key"
          dangerouslySetInnerHTML={{ __html: fill(t.risk_key, { p: f.pct(atRisk?.value_at_risk_share ?? 0) }) }}
        />
      </section>
    </div>
  );
}

function GaugeCard({ share, active, total, threshold }: { share: number; active: number; total: number; threshold: number }) {
  const t = useT();
  const f = useFormat();
  const arcRef = useRef<SVGCircleElement>(null);
  const C = 2 * Math.PI * 80;

  useEffect(() => {
    const arc = arcRef.current;
    if (!arc) return;
    arc.setAttribute("stroke-dasharray", String(C));
    arc.setAttribute("stroke-dashoffset", String(C));
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        arc.setAttribute("stroke-dashoffset", String(C * (1 - share)));
      });
    });
  }, [share, C]);

  return (
    <section className="card gauge">
      <span className="label">{t.k_active}</span>
      <svg viewBox="0 0 200 200" role="img">
        <circle cx="100" cy="100" r="80" fill="none" stroke="var(--line)" strokeWidth="20" />
        <circle
          ref={arcRef}
          className="arc"
          cx="100"
          cy="100"
          r="80"
          fill="none"
          stroke="var(--yellow)"
          strokeWidth="20"
          strokeLinecap="round"
          transform="rotate(-90 100 100)"
        />
        <CountUp as="text" value={share} format={(v) => f.pct(v)} x={100} y={114} textAnchor="middle" />
      </svg>
      <p className="note">
        {fill(t.k_active_note, { a: f.num(active), b: f.num(total), t: f.num(threshold * 100) })}
      </p>
    </section>
  );
}

/* ---------- segment explorer ---------- */

function SegmentExplorer({ data }: { data: Overview }) {
  const t = useT();
  const f = useFormat();
  const lang = useApp((s) => s.lang);
  const pick = useApp((s) => s.pick);
  const setPick = useApp((s) => s.setPick);
  const viewSegment = useApp((s) => s.viewSegment);

  const segments = data.by_segment;
  const totalCustomers = segments.reduce((sum, s) => sum + s.customers, 0);
  const s: Group | undefined = segments[pick];
  const status = s ? statusOf(s.average_p_active) : "good";

  // Donut: one arc per segment, sized by customers.
  const r = 86;
  const C = 2 * Math.PI * r;
  const gap = 3;
  let start = 0;
  const slices = segments.map((seg, i) => {
    const len = totalCustomers ? (seg.customers / totalCustomers) * C : 0;
    const slice = { seg, i, len, start };
    start += len;
    return slice;
  });

  return (
    <section className="card">
      <span className="label">{t.e_segments}</span>
      <h2>{t.seg_title}</h2>
      <div className="chips">
        {segments.map((seg, i) => (
          <button key={seg.name} type="button" className="chip" aria-pressed={i === pick} onClick={() => setPick(i)}>
            <i style={{ background: `var(--seg-${i})` }} />
            {displayName(seg.name, lang)}
          </button>
        ))}
      </div>
      <div className="explorer">
        <div className="donut-wrap">
          <svg className="donut has-pick" viewBox="0 0 220 220" role="img">
            {slices.map(({ seg, i, len, start }) => (
              <circle
                key={seg.name}
                className={`slice${i === pick ? " on" : ""}`}
                cx="110"
                cy="110"
                r={r}
                stroke={`var(--seg-${i})`}
                strokeWidth="32"
                strokeDasharray={`${Math.max(0, len - gap)} ${C - len + gap}`}
                strokeDashoffset={-start}
                transform="rotate(-90 110 110)"
                onClick={() => setPick(i)}
                data-tip={`<b>${displayName(seg.name, lang)}</b><br>${f.num(seg.customers)} ${t.s_cust}`}
              />
            ))}
          </svg>
          <div className="donut-centre">
            <b>{f.pct(totalCustomers && s ? s.customers / totalCustomers : 0)}</b>
            <span>{t.of_customers}</span>
          </div>
        </div>
        {s && (
          <div className="detail swap" key={pick}>
            <h3>{displayName(s.name, lang)}</h3>
            <p className="note">{t.who[pick]}</p>
            <div className="facts">
              <div>
                <b>{f.num(s.customers)}</b>
                <span>{t.s_cust}</span>
              </div>
              <div>
                <b>{f.money(s.average_value)}</b>
                <span>{t.avg}</span>
              </div>
              <div>
                <b>{f.pct(s.value_share)}</b>
                <span>{t.share_value}</span>
              </div>
              <div>
                <b>{f.cur(f.short(s.value_at_risk))}</b>
                <span>{t.risk}</span>
              </div>
            </div>
            <div>
              <div className="meter-row">
                <span>{t.alive}</span>
                <span>{f.pct(s.average_p_active)}</span>
              </div>
              <div className="meter">
                <i style={{ width: `${s.average_p_active * 100}%`, background: `var(--${status})` }} />
              </div>
            </div>
            <div className="play">
              <span className="label">{t.todo}</span>
              <p className="play-title">{t.act_title[pick]}</p>
              <p className="note">{t.act[pick]}</p>
              <div className="levers">
                {t.act_levers[pick].map((lever) => (
                  <span key={lever}>{lever}</span>
                ))}
              </div>
            </div>
            <Button onClick={() => viewSegment(s.name)}>
              {t.view} →
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------- concentration + freshness ---------- */

function Deciles({ data }: { data: Overview }) {
  const t = useT();
  const f = useFormat();
  const shares = data.deciles.map((d) => d.value_share);
  const max = Math.max(...shares, 0.0001);
  const top20 = (shares[0] ?? 0) + (shares[1] ?? 0);

  return (
    <section className="card">
      <span className="label">{t.e_value}</span>
      <h2>{fill(t.decile_title, { p: f.pct(top20) })}</h2>
      <div className="bars">
        {shares.map((v, i) => (
          <div key={i} className={`bar${i < 2 ? " top" : ""}`}>
            <b>{v >= 0.01 ? f.pct(v) : v > 0 ? "<1%" : f.pct(0)}</b>
            <i style={{ height: `${Math.max(1.5, (v / max) * 100)}%`, animationDelay: `${i * 55}ms` }} />
          </div>
        ))}
      </div>
      <div className="bar-labels">
        {shares.map((_, i) => (
          <span key={i}>{i + 1}</span>
        ))}
      </div>
      <p className="note">{t.decile_note}</p>
    </section>
  );
}

const FRESH_COLOURS: [string, string][] = [
  ["var(--yellow)", "var(--ink)"],
  ["var(--yellow-soft)", "var(--ink)"],
  ["var(--grey)", "var(--ink)"],
  ["var(--grey-dark)", "var(--white)"],
  ["var(--ink)", "var(--white)"],
];

function Freshness({ data, meta }: { data: Overview; meta: Meta }) {
  const t = useT();
  const f = useFormat();
  const lang = useApp((s) => s.lang);
  const bands = data.by_recency;
  const silent = bands[bands.length - 1]?.customers ?? 0;
  const bt = meta.backtest;
  const sign = (v: number) => (v >= 0 ? "+" : "") + f.num(v, 1) + (lang === "fr" ? " %" : "%");

  return (
    <section className="card">
      <span className="label">{t.e_recency}</span>
      <h2>{t.rec_title}</h2>
      <div className="fresh">
        {bands.map((b, i) => (
          <div
            key={b.name}
            style={{
              flex: b.customers,
              background: FRESH_COLOURS[i]?.[0],
              color: FRESH_COLOURS[i]?.[1],
              animationDelay: `${i * 80}ms`,
            }}
          >
            {f.num(b.customers)}
          </div>
        ))}
      </div>
      <div className="fresh-labels">
        {bands.map((b) => (
          <span key={b.name} style={{ flex: b.customers }}>
            {shortBand(b.name)}
          </span>
        ))}
      </div>
      <p className="note">{fill(t.rec_note, { n: f.num(silent) })}</p>
      <span className="label" style={{ marginTop: 8 }}>
        {t.e_trust}
      </span>
      <div className="stat-row">
        <div>
          <b>{sign(bt.recharge_days_error_pct)}</b>
          <span>{t.bt1}</span>
        </div>
        <div>
          <b>{sign(bt.spend_error_pct)}</b>
          <span>{t.bt2}</span>
        </div>
        <div>
          <b>{f.num(bt.mae_recharge_days, 1)}</b>
          <span>{t.bt3}</span>
        </div>
      </div>
    </section>
  );
}

/* ---------- geography ---------- */

function Departments({ data }: { data: Overview }) {
  const t = useT();
  const f = useFormat();
  const depts = data.by_department; // already sorted, highest average value first
  const top = depts[0]?.average_value ?? 1;

  return (
    <section className="card">
      <span className="label">{t.e_where}</span>
      <h2>{t.dept_title}</h2>
      <div className="grid-2" style={{ gap: "12px 44px" }}>
        {depts.map((d, i) => (
          <div className="rank" key={d.name}>
            <span className="n">{i + 1}</span>
            <span>{d.name}</span>
            <span className="track">
              <i style={{ width: `${(d.average_value / top) * 100}%`, animationDelay: `${i * 40}ms` }} />
            </span>
            <b>{f.money(d.average_value)}</b>
          </div>
        ))}
      </div>
    </section>
  );
}