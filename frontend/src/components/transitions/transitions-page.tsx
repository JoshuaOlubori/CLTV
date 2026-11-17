import { useEffect, useState, type CSSProperties } from "react";
import { ErrorNote, useFormat, useT } from "@/components/shared";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useMeta, useTransitions } from "@/hooks/use-api";
import { displayName, fill } from "@/lib/i18n";
import { useApp } from "@/store/app";

export function TransitionsPage() {
  const t = useT();
  const f = useFormat();
  const lang = useApp((s) => s.lang);
  const { data: meta } = useMeta();
  const dates = meta?.transition_dates ?? [];

  // About three months back → the analysis date, to start with.
  const [baseline, setBaseline] = useState<string | undefined>();
  const [comparison, setComparison] = useState<string | undefined>();

  useEffect(() => {
    if (!dates.length || baseline) return;
    setBaseline(dates[Math.max(0, dates.length - 4)]);
    setComparison(dates[dates.length - 1]);
  }, [dates, baseline]);

  const query = useTransitions(baseline, comparison);

  const onBaseline = (next: string) => {
    setBaseline(next);
    // Keep the comparison later than the baseline so a 400 never happens.
    if (comparison && comparison <= next) setComparison(dates[dates.length - 1]);
  };

  if (!meta) {
    return (
      <main className="view">
        <Skeleton style={{ height: 64, borderRadius: 26 }} />
        <Skeleton style={{ height: 110, borderRadius: 22 }} />
        <Skeleton style={{ height: 480, borderRadius: 26 }} />
      </main>
    );
  }

  const data = query.data;

  return (
    <main className="view">
      <div className="compare">
        <label className="pick">
          <span>{t.tr_base}</span>
          <Select value={baseline} onValueChange={onBaseline}>
            <SelectTrigger aria-label={t.tr_base}>
              <SelectValue>{baseline ? f.day(baseline) : ""}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {dates.slice(0, -1).map((d) => (
                <SelectItem key={d} value={d}>
                  {f.day(d)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <span className="arrow" aria-hidden="true">
          →
        </span>
        <label className="pick">
          <span>{t.tr_comp}</span>
          <Select value={comparison} onValueChange={setComparison}>
            <SelectTrigger aria-label={t.tr_comp}>
              <SelectValue>{comparison ? f.day(comparison) : ""}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {dates.filter((d) => baseline !== undefined && d > baseline).map((d) => (
                <SelectItem key={d} value={d}>
                  {f.day(d)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>

      {query.error && <ErrorNote error={query.error} onRetry={() => query.refetch()} />}

      {data && (
        <>
          <section className="tiles">
            <div className="tile hot">
              <b>{f.pct(data.summary.stayed_share)}</b>
              <span>{t.tr1}</span>
            </div>
            <div className="tile">
              <b>{f.pct(data.summary.top_segment_kept_share)}</b>
              <span>{fill(t.tr2, { seg: displayName(data.summary.top_segment, lang) })}</span>
            </div>
            <div className="tile">
              <b>{f.num(data.summary.slipped_into_risk)}</b>
              <span>{t.tr3}</span>
            </div>
            <div className="tile">
              <b>{f.num(data.summary.disconnected)}</b>
              <span>{t.tr4}</span>
            </div>
            <div className="tile">
              <b>{f.num(data.summary.new_since_baseline)}</b>
              <span>{t.tr5}</span>
            </div>
          </section>

          <section className="card">
            <div>
              <span className="label">
                {f.day(data.baseline)} → {f.day(data.comparison)}
              </span>
              <h2>{t.tr_title}</h2>
            </div>
            <p className="note">{t.tr_note}</p>
            <div className="scroll">
              <table className="matrix">
                <thead>
                  <tr>
                    <th>{t.corner}</th>
                    {data.cols.map((c) => (
                      <th key={c}>{displayName(c, lang)}</th>
                    ))}
                    <th>{t.total}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.matrix.map((row, r) => (
                    <tr key={data.rows[r]}>
                      <th scope="row">{displayName(data.rows[r], lang)}</th>
                      {row.map((v, c) => {
                        const share = data.row_shares[r][c];
                        const same = data.cols[c] === data.rows[r];
                        return (
                          <td key={c} className={`${same ? "same" : ""}${v ? "" : " zero"}`}>
                            <span style={{ "--s": v ? (0.1 + 0.9 * Math.pow(share, 0.7)).toFixed(3) : 0 } as CSSProperties}>
                              <b>{f.num(v)}</b>
                              <small>{f.pct(share, 1)}</small>
                            </span>
                          </td>
                        );
                      })}
                      <td>
                        <span style={{ "--s": 0 } as CSSProperties}>
                          <b>{f.num(data.row_totals[r])}</b>
                          <small>{f.pct(data.row_totals[r] ? 1 : 0)}</small>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="legend-row">
              <span>0%</span>
              <span className="ramp" />
              <span>100%</span>
              <span>{t.tr_legend}</span>
              <span className="boxed" />
              <span>{t.tr_same}</span>
            </p>
          </section>
        </>
      )}

      {!data && !query.error && <Skeleton style={{ height: 480, borderRadius: 26 }} />}
    </main>
  );
}