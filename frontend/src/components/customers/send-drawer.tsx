import { useEffect, useState } from "react";
import { useFormat, useT } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle, DrawerContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioItem } from "@/components/ui/radio-group";
import { useOverview } from "@/hooks/use-api";
import { displayName, fill } from "@/lib/i18n";
import type { CustomerPage, Filters } from "@/lib/types";
import { useApp } from "@/store/app";

/** The design's "Send to CMS" panel. Simulated: nothing leaves the page.
 *  Audience counts come from the customer list; value totals from the
 *  overview with the same filters (the overview has no search parameter,
 *  so value facts are hidden while a search is active). */
export function SendDrawer({ filters, search, page }: { filters: Filters; search: string; page: CustomerPage | undefined }) {
  const t = useT();
  const f = useFormat();
  const lang = useApp((s) => s.lang);
  const open = useApp((s) => s.sendOpen);
  const setOpen = useApp((s) => s.setSendOpen);
  const segmentFilter = useApp((s) => s.segmentFilter);
  const tierFilter = useApp((s) => s.tierFilter);

  const [sent, setSent] = useState(false);
  const [name, setName] = useState("");
  const [per, setPer] = useState<"sim" | "customer">("sim");

  useEffect(() => {
    if (open) {
      setSent(false);
      setName("");
      setPer("sim");
    }
  }, [open]);

  const totals = useOverview(filters, open && !search);

  const customers = page?.total ?? 0;
  const sims = page?.sims ?? 0;
  const contacts = per === "customer" ? customers : sims;

  const chosen = segmentFilter.map((s) => displayName(s, lang));
  const fallback = (chosen.length ? chosen.join(" + ") : t.all_seg) + " · " + f.monthYear(new Date());
  const finalName = name.trim() || fallback;

  const who = [
    ...(chosen.length ? chosen : [t.all_seg]),
    ...(tierFilter.length ? tierFilter.map((c) => displayName(c, lang)) : [t.all_class]),
    ...(search.trim() ? [fill(t.send_search, { q: search.trim() })] : []),
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DrawerContent>
        {sent ? (
          <div className="sent">
            <div className="tick">
              <svg viewBox="0 0 24 24" fill="none" stroke="#0d0d0d" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <DialogTitle asChild>
              <h2>{t.sent_title}</h2>
            </DialogTitle>
            <DialogDescription asChild>
              <p className="note">{fill(t.sent_body, { n: f.num(contacts), name: finalName })}</p>
            </DialogDescription>
            <p className="note">
              <b>{t.sent_preview}</b>
            </p>
            <Button onClick={() => setOpen(false)}>{t.done}</Button>
          </div>
        ) : (
          <>
            <span className="label">{t.send_kicker}</span>
            <DialogTitle asChild>
              <h2>{t.send_title}</h2>
            </DialogTitle>
            <DialogDescription asChild>
              <p className="note">{t.send_note}</p>
            </DialogDescription>

            <div className="facts">
              <div>
                <b>{f.num(sims)}</b>
                <span>{t.sims}</span>
              </div>
              <div>
                <b>{f.num(customers)}</b>
                <span>{t.s_cust}</span>
              </div>
              {!search && totals.data && (
                <>
                  <div>
                    <b>{f.cur(f.short(totals.data.kpis.total_value))}</b>
                    <span>{t.c9}</span>
                  </div>
                  <div>
                    <b>{f.cur(f.short(totals.data.kpis.value_at_risk))}</b>
                    <span>{t.c10}</span>
                  </div>
                </>
              )}
            </div>

            <div>
              <span className="label">{t.send_who}</span>
              <div className="levers">
                {who.map((x) => (
                  <span key={x}>{x}</span>
                ))}
              </div>
            </div>

            <label className="field">
              <span className="label">{t.send_name}</span>
              <Input type="text" value={name} placeholder={fallback} onChange={(e) => setName(e.target.value)} />
            </label>

            <fieldset className="choice">
              <legend className="label">{t.send_per}</legend>
              <RadioGroup value={per} onValueChange={(v) => setPer(v as "sim" | "customer")}>
                <RadioItem value="sim" title={t.per_sim} hint={fill(t.per_sim_h, { n: f.num(sims) })} />
                <RadioItem value="customer" title={t.per_cust} hint={fill(t.per_cust_h, { n: f.num(customers) })} />
              </RadioGroup>
            </fieldset>

            <div className="drawer-actions">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                {t.cancel}
              </Button>
              <Button variant="send" onClick={() => setSent(true)}>
                {fill(t.confirm, { n: f.num(contacts) })}
              </Button>
            </div>
          </>
        )}
      </DrawerContent>
    </Dialog>
  );
}