import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { CustomerDrawer } from "@/components/customers/customer-drawer";
import { SendDrawer } from "@/components/customers/send-drawer";
import { ErrorNote, useFormat, useT } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useCustomers, useMeta } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { segIndex, statusOf } from "@/lib/format";
import { displayName, fill } from "@/lib/i18n";
import type { Filters } from "@/lib/types";
import { useApp } from "@/store/app";

const PAGE_SIZE = 20;

export function CustomersPage() {
  const t = useT();
  const f = useFormat();
  const lang = useApp((s) => s.lang);
  const { data: meta } = useMeta();

  const segmentFilter = useApp((s) => s.segmentFilter);
  const tierFilter = useApp((s) => s.tierFilter);
  const search = useApp((s) => s.search);
  const page = useApp((s) => s.page);
  const toggleSegment = useApp((s) => s.toggleSegment);
  const toggleTier = useApp((s) => s.toggleTier);
  const setSearch = useApp((s) => s.setSearch);
  const setPage = useApp((s) => s.setPage);
  const clearFilters = useApp((s) => s.clearFilters);
  const setSendOpen = useApp((s) => s.setSendOpen);
  const setOpenCustomerId = useApp((s) => s.setOpenCustomerId);

  const filters: Filters = useMemo(
    () => ({ segment: segmentFilter, tier: tierFilter }),
    [segmentFilter, tierFilter],
  );

  // Wait ~300 ms after the last keystroke before searching.
  const [text, setText] = useState(search);
  useEffect(() => {
    const id = setTimeout(() => {
      if (text !== search) setSearch(text);
    }, 300);
    return () => clearTimeout(id);
  }, [text, search, setSearch]);

  const query = useCustomers({ filters, search, page, pageSize: PAGE_SIZE });
  const data = query.data;
  const segments = meta?.lists.segments ?? [];
  const tiers = meta?.lists.tiers ?? [];
  const anyFilter = segmentFilter.length > 0 || tierFilter.length > 0 || search !== "" || text !== "";

  return (
    <main className="view">
      <section className="card">
        <div className="toolbar">
          <div>
            <h2>{t.list_title}</h2>
            <p className="note">
              {data ? fill(t.list_count, { n: f.num(data.total), s: f.num(data.sims) }) : t.loading}
            </p>
          </div>
          <span className="spacer" />
          <Input
            type="search"
            aria-label={t.search}
            placeholder={t.search}
            value={text}
            maxLength={60}
            onChange={(e) => setText(e.target.value)}
          />
          <Button variant="ghost" asChild>
            <a href={api.customersCsvUrl(filters, search)} download="cltv_customer_list.csv">
              {t.download}
            </a>
          </Button>
          <Button variant="send" disabled={!data || data.total === 0} onClick={() => setSendOpen(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 2 11 13" />
              <path d="M22 2 15 22l-4-9-9-4z" />
            </svg>
            <span>{t.send}</span>
          </Button>
        </div>

        <div className="filterbar">
          <div className="fgroup">
            <span className="label">{t.f_segment}</span>
            <div className="chips">
              {segments.map((name, i) => (
                <button
                  key={name}
                  type="button"
                  className="chip"
                  aria-pressed={segmentFilter.includes(name)}
                  onClick={() => toggleSegment(name)}
                >
                  <i style={{ background: `var(--seg-${i})` }} />
                  {displayName(name, lang)}
                </button>
              ))}
            </div>
          </div>
          <div className="fgroup">
            <span className="label">{t.f_class}</span>
            <div className="chips">
              {tiers.map((name) => (
                <button
                  key={name}
                  type="button"
                  className="chip"
                  aria-pressed={tierFilter.includes(name)}
                  onClick={() => toggleTier(name)}
                >
                  {displayName(name, lang)}
                </button>
              ))}
            </div>
          </div>
          {anyFilter && (
            <button
              type="button"
              className="clear"
              onClick={() => {
                setText("");
                clearFilters();
              }}
            >
              {t.f_clear}
            </button>
          )}
        </div>

        {query.error && <ErrorNote error={query.error} onRetry={() => query.refetch()} />}

        <div className="scroll">
          <table className="rows-click">
            <thead>
              <tr>
                <th className="l">{t.c1}</th>
                <th className="l">{t.c2}</th>
                <th className="l">{t.c3}</th>
                <th className="l">{t.c4}</th>
                <th className="l">{t.c5}</th>
                <th>{t.c6}</th>
                <th>{t.c7}</th>
                <th>{t.c8}</th>
                <th>{t.c9}</th>
                <th>{t.c10}</th>
              </tr>
            </thead>
            <tbody>
              {!data &&
                Array.from({ length: 8 }, (_, i) => (
                  <tr key={i}>
                    <td colSpan={10}>
                      <Skeleton style={{ height: 34 }} />
                    </td>
                  </tr>
                ))}
              {data && data.rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="l">
                    {t.empty}
                  </td>
                </tr>
              )}
              {data?.rows.map((r) => {
                const status = statusOf(r.p_active);
                const tier = r.cltv_tier === "Platinum" ? " plat" : r.cltv_tier === "Gold" ? " gold" : "";
                const si = segIndex(segments, r.segment);
                return (
                  <tr key={r.customer_id} onClick={() => setOpenCustomerId(r.customer_id)}>
                    <td>
                      <div className="who">
                        <span className="avatar">{r.customer_id.slice(1, 3)}</span>
                        <div>
                          <b>{r.customer_id}</b>
                          <small>{r.contact_msisdn_key}</small>
                        </div>
                      </div>
                    </td>
                    <td className="l">{r.sims_scored}</td>
                    <td className="l">{r.department}</td>
                    <td className="l">
                      <span className="segtag">
                        <i style={{ background: `var(--seg-${si})` }} />
                        {displayName(r.segment, lang)}
                      </span>
                    </td>
                    <td className="l">
                      <span className={`pill${tier}`}>{displayName(r.cltv_tier, lang)}</span>
                    </td>
                    <td>
                      {r.r_score}-{r.f_score}-{r.m_score}
                    </td>
                    <td>{f.num(r.days_since_last)}</td>
                    <td>
                      <span className="live" style={{ "--c": `var(--${status})` } as CSSProperties}>
                        {f.pct(r.p_active)}
                      </span>
                    </td>
                    <td>
                      <span
                        className="valuebar"
                        style={{ width: `${data.highest_value ? Math.round((r.cltv_12m / data.highest_value) * 60) : 0}px` }}
                      />
                      <b>{f.money(r.cltv_12m)}</b>
                    </td>
                    <td>{f.money(r.value_at_risk)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {data && data.pages > 1 && (
          <div className="pager">
            <span>{fill(t.page_of, { p: data.page + 1, n: data.pages })}</span>
            <Button variant="ghost" disabled={page <= 0} onClick={() => setPage(page - 1)}>
              ← {t.prev}
            </Button>
            <Button variant="ghost" disabled={page >= data.pages - 1} onClick={() => setPage(page + 1)}>
              {t.next} →
            </Button>
          </div>
        )}
      </section>

      <SendDrawer filters={filters} search={search} page={data} />
      <CustomerDrawer />
    </main>
  );
}