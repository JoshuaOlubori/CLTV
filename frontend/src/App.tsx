import { useEffect } from "react";
import { CustomersPage } from "@/components/customers/customers-page";
import { OverviewPage } from "@/components/overview/overview-page";
import { ErrorNote } from "@/components/shared";
import { Shell } from "@/components/shell";
import { TooltipLayer } from "@/components/tooltip";
import { TransitionsPage } from "@/components/transitions/transitions-page";
import { useMeta } from "@/hooks/use-api";
import { useApp } from "@/store/app";

export default function App() {
  const view = useApp((s) => s.view);
  const lang = useApp((s) => s.lang);
  const meta = useMeta();

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <>
      <Shell>
        {meta.error ? (
          <ErrorNote error={meta.error} onRetry={() => meta.refetch()} />
        ) : view === "overview" ? (
          <OverviewPage />
        ) : view === "transitions" ? (
          <TransitionsPage />
        ) : (
          <CustomersPage />
        )}
      </Shell>
      <TooltipLayer />
    </>
  );
}