import type { CSSProperties } from "react";
import { ErrorNote, useFormat, useT } from "@/components/shared";
import { Dialog, DialogDescription, DialogTitle, DrawerContent } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useCustomer, useMeta } from "@/hooks/use-api";
import { segIndex, statusOf } from "@/lib/format";
import { displayName, fill } from "@/lib/i18n";
import { useApp } from "@/store/app";

/** The drill-down: one customer, then each of their SIMs with its own
 *  segment, class and value. Loaded when a row of the list is opened. */
export function CustomerDrawer() {
  const t = useT();
  const f = useFormat();
  const lang = useApp((s) => s.lang);
  const id = useApp((s) => s.openCustomerId);
  const setId = useApp((s) => s.setOpenCustomerId);
  const { data: meta } = useMeta();
  const query = useCustomer(id);
  const segments = meta?.lists.segments ?? [];

  const data = query.data;
  const customer = data?.customer;
  const summary = data
    ? fill(t.cust_sims_summary, {
        n: f.num(customer!.sims_scored),
        parts: Object.entries(data.sims_by_segment)
          .map(([seg, n]) => `${f.num(n)} ${displayName(seg, lang)}`)
          .join(", "),
      })
    : "";

  return (
    <Dialog open={Boolean(id)} onOpenChange={(open) => !open && setId(null)}>
      <DrawerContent>
        <span className="label">{t.cust_kicker}</span>
        <DialogTitle asChild>
          <h2 style={{ fontFamily: "ui-monospace, Consolas, monospace" }}>{id}</h2>
        </DialogTitle>
        <DialogDescription asChild>
          <p className="note">{data ? summary : t.loading}</p>
        </DialogDescription>

        {query.error && <ErrorNote error={query.error} onRetry={() => query.refetch()} />}
        {!data && !query.error && (
          <>
            <Skeleton style={{ height: 24, width: "70%" }} />
            <Skeleton style={{ height: 110 }} />
            <Skeleton style={{ height: 90 }} />
            <Skeleton style={{ height: 90 }} />
          </>
        )}

        {data && customer && (
          <>
            <div className="sim-meta">
              <span className="segtag">
                <i style={{ background: `var(--seg-${segIndex(segments, customer.segment)})` }} />
                {displayName(customer.segment, lang)}
              </span>
              <span className={`pill${customer.cltv_tier === "Platinum" ? " plat" : customer.cltv_tier === "Gold" ? " gold" : ""}`}>
                {displayName(customer.cltv_tier, lang)}
              </span>
              <span>
                {customer.r_score}-{customer.f_score}-{customer.m_score}
              </span>
              <span>{customer.department}</span>
            </div>

            <div className="facts">
              <div>
                <b>{f.money(customer.cltv_12m)}</b>
                <span>{t.c9}</span>
              </div>
              <div>
                <b>{f.money(customer.value_at_risk)}</b>
                <span>{t.c10}</span>
              </div>
              <div>
                <b>
                  <span className="live" style={{ "--c": `var(--${statusOf(customer.p_active)})` } as CSSProperties}>
                    {f.pct(customer.p_active)}
                  </span>
                </b>
                <span>{t.c8}</span>
              </div>
              <div>
                <b>{f.num(customer.days_since_last)}</b>
                <span>{t.c7}</span>
              </div>
            </div>

            <span className="label">{t.sims}</span>
            {data.sims.map((sim) => {
              const isContact = sim.msisdn_key === customer.contact_msisdn_key;
              return (
                <div key={sim.msisdn_key} className={`sim-line${isContact ? " contact" : ""}`}>
                  <div className="sim-head">
                    <b>{sim.msisdn_key}</b>
                    {isContact && <span className="pill gold">{t.cust_contact}</span>}
                  </div>
                  <div className="sim-meta">
                    <span className="segtag">
                      <i style={{ background: `var(--seg-${segIndex(segments, sim.segment)})` }} />
                      {displayName(sim.segment, lang)}
                    </span>
                    <span className={`pill${sim.cltv_tier === "Platinum" ? " plat" : sim.cltv_tier === "Gold" ? " gold" : ""}`}>
                      {displayName(sim.cltv_tier, lang)}
                    </span>
                    <span>
                      {sim.r_score}-{sim.f_score}-{sim.m_score}
                    </span>
                    <span>
                      <b>{f.num(sim.days_since_last)}</b> {t.days_short}
                    </span>
                  </div>
                  <div className="sim-figs">
                    <span className="live" style={{ "--c": `var(--${statusOf(sim.p_alive)})` } as CSSProperties}>
                      {f.pct(sim.p_alive)}
                    </span>
                    <span>
                      {t.c9}: <b>{f.money(sim.cltv_12m)}</b>
                    </span>
                    <span>
                      {t.c10}: <b>{f.money(sim.value_at_risk)}</b>
                    </span>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </DrawerContent>
    </Dialog>
  );
}