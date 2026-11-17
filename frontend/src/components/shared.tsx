import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useMeta } from "@/hooks/use-api";
import { makeFormat } from "@/lib/format";
import { STRINGS, type Dict } from "@/lib/i18n";
import { useApp } from "@/store/app";

/** Formatting helpers bound to the current language and run currency. */
export function useFormat() {
  const lang = useApp((s) => s.lang);
  const { data: meta } = useMeta();
  return useMemo(() => makeFormat(lang, meta?.run.currency ?? "XOF"), [lang, meta?.run.currency]);
}

/** The current language's wording dictionary. */
export function useT(): Dict {
  const lang = useApp((s) => s.lang);
  return STRINGS[lang];
}

/** Inline error with a retry action, in the design's voice. */
export function ErrorNote({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  const t = useT();
  return (
    <div className="card">
      <span className="label">{t.error_title}</span>
      <p className="error-note">{error.message}</p>
      {onRetry && (
        <Button variant="ghost" onClick={onRetry}>
          {t.retry}
        </Button>
      )}
    </div>
  );
}