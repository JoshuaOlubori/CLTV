# CLTV dashboard — frontend

The live dashboard for the Subscriber CLTV API, built to match the approved
design preview (`MTN CLTV Frontend sample - 2026-11_6175.html`) exactly.

**Stack**: Vite · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui-style
components (Radix primitives) · Zustand · TanStack Query.

## Run it

From the repo root, start the API (port 8000):

```
pip install -r requirements.txt
python -m uvicorn backend.main:app --port 8000
```

Then, from `frontend/`:

```
npm install
npm run dev
```

Open http://localhost:5173. In dev, Vite proxies `/api` to
`http://localhost:8000`, so no CORS setup is needed.

## Build for production

```
npm run build
npm run preview
```

Set `VITE_API_URL` at build time to the API's public address (for example
`https://cltv-api.mtn.bj`, no trailing slash), and make sure that address
lists the dashboard's origin in `CLTV_ALLOWED_ORIGINS` (see the API guide in
the repo root README).

## What is wired

| Screen | Calls |
|---|---|
| Frame (date chip, currency, filter lists, synthetic note) | `GET /api/meta` — fetched once and kept |
| Overview (value / activity / risk cards, segment explorer, concentration, freshness, forecast check, departments) | `GET /api/overview` |
| Transitions (date pickers, five tiles, matrix) | `GET /api/transitions` with dates from `meta.transition_dates` |
| Subscribers (chips, search, table, paging, CSV) | `GET /api/customers`, `GET /api/customers.csv` |
| Customer drill-down (click a row) | `GET /api/customers/{customer_id}` |
| "Send to CMS" drawer | audience counts from the list, totals from `GET /api/overview` with the same filters — **simulated**, nothing is sent |

Behaviour notes:

- Everything counts **customers** (API v2); a customer opens to show each SIM.
- Segment / class names are sent to the API as the fixed English keys; the
  EN / FR toggle only changes display wording (`src/lib/i18n.ts`).
- Search is debounced 300 ms; filters, search and paging reset to page 0 on
  change; out-of-order answers are handled by TanStack Query.
- The comparison date always stays later than the baseline, so the
  transitions call never 400s.
- No authentication yet, by design.

## Layout

```
src/
  lib/        API client, types, formatting, EN/FR wording
  store/      Zustand app state (language, view, filters, drawers)
  hooks/      TanStack Query hooks per endpoint
  components/
    ui/       shadcn-style primitives dressed in the design
    overview/ transitions/ customers/
  styles/     design.css — the design preview's stylesheet, ported
```