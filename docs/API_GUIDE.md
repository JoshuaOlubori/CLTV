# Subscriber CLTV API — usage guide

For the developer building the dashboard. It explains every address, what to
send, what comes back, and which part of the approved design each one feeds.

All example figures are real answers from the synthetic data set.

- [1. Getting started](#1-getting-started)
- [2. Rules that apply everywhere](#2-rules-that-apply-everywhere)
- [3. Filters](#3-filters)
- [4. Which call feeds which screen](#4-which-call-feeds-which-screen)
- [5. Reference](#5-reference)
  - System: [`/api/health`](#51-get-apihealth) · [`/api/meta`](#52-get-apimeta)
  - Overview: [`/api/overview`](#53-get-apioverview)
  - Transitions: [`/api/transitions/dates`](#54-get-apitransitionsdates) · [`/api/transitions`](#55-get-apitransitions)
  - Customers: [`/api/customers`](#56-get-apicustomers) · [`/api/customers.csv`](#57-get-apicustomerscsv) · [`/api/customers/{customer_id}`](#58-get-apicustomerscustomer_id)
  - SIMs: [`/api/subscribers`](#59-get-apisubscribers) · [`/api/subscribers.csv`](#510-get-apisubscriberscsv)
- [6. Recipes](#6-recipes)
- [7. What the API leaves to the frontend](#7-what-the-api-leaves-to-the-frontend)

---

## 1. Getting started

### Run the API on your machine

From the folder that contains `config.py`:

```
pip install -r requirements.txt
python -m uvicorn backend.main:app --port 8000
```

With nothing else configured it reads the SQLite file `data/cltv_local.db`,
which is already loaded with synthetic data.

| Address | What it is |
|---|---|
| http://localhost:8000/docs | Swagger: try every call from the browser |
| http://localhost:8000/redoc | The same documentation in a reading layout |
| http://localhost:8000/openapi.json | Machine-readable description (also saved as `docs/openapi.json`) |
| http://localhost:8000/api/health | Quick check that it is up |

`/docs` and `/redoc` load their styling from the internet. Without an internet
connection they are blank; the API itself is unaffected.

### Calling it from your pages (CORS)

Your pages are served from a different address than the API, so the browser
checks whether they are allowed to read its answers.

- **While developing**: any page on `http://localhost:<port>` or
  `http://127.0.0.1:<port>` is allowed. Nothing to set up.
- **When deployed**: the address of the dashboard must be given to the API
  through the environment variable `CLTV_ALLOWED_ORIGINS`
  (for example `https://dashboard.example.com`, no trailing slash; several addresses
  separated by commas). Tell whoever deploys the API which address you use.

If a call works in Swagger but fails in your page with a CORS error, the
page's address is not in that list.

### A first call

```js
const API = "http://localhost:8000";

const health = await fetch(`${API}/api/health`).then((response) => response.json());
// { status: "ok", database: "sqlite", customers_scored: 5221, sims_scored: 6131,
//   scored_as_of: "2026-11-15", built: "2026-11-15" }
```

---

## 2. Rules that apply everywhere

### Customers and SIMs

Scores are worked out for each SIM, then added up to the customer who holds
them. **The dashboard presents customers.** A customer opens to show each of
their SIMs.

| | Customer | SIM |
|---|---|---|
| What it is | A person, identified by `customer_id` | One line, identified by `msisdn_key` |
| Recency (`days_since_last`) | Analysis date minus the last recharge on **any** of their SIMs | Analysis date minus that SIM's last recharge |
| Frequency (`recharge_days`) | Days on which any of their SIMs recharged | Days on which that SIM recharged |
| Monetary (`monetary`) | 0.8 × spend across all their SIMs | 0.8 × that SIM's spend |
| `segment` | From the customer's combined R, F, M | From that SIM's own R, F, M |
| `cltv_12m`, `value_at_risk` | Sum of their SIMs | The model's output for that SIM |
| Likely active | `p_active`: at least one SIM is active | `p_alive`: that SIM is active |
| Class (`cltv_tier`) | Ranked among customers | Ranked among SIMs |

A customer's segment and their SIMs' segments can differ, and that is the
point. A customer whose main SIM is a Champion and whose old SIM has gone quiet
is a Champion; the quiet SIM shows up in the drill-down, not in a win-back list.

The 0.8 is `run.margin` from `/api/meta`. It is already applied to every
`monetary` and every 12-month value; do not apply it again.

**Agents and resellers.** An account holding more than `run.max_sims` SIMs
(currently 5) is not one person. Such accounts are left out of the overview,
the transitions and the normal customer list. They can be listed separately
(see [`/api/customers`](#56-get-apicustomers)).

### General rules

| Rule | Detail |
|---|---|
| **No login** | No token or cookie is needed. The API is meant for the internal network only. |
| **JSON** | Every answer is JSON, except the two `.csv` addresses. |
| **Money** | A plain number in the run's currency. The currency code is `run.currency` from `/api/meta` (currently `XOF`). The API never formats amounts. |
| **Shares and probabilities** | A fraction from 0 to 1. `0.74` means 74 %. Multiply by 100 to display. |
| **Dates** | Text, `YYYY-MM-DD`. |
| **`msisdn_key`, `contact_msisdn_key`** | Sent as text (`"800996079508"`). They are identifiers; do not convert them to numbers. |
| **Names are fixed English keys** | Segments, classes and bands always come back in English (`"At risk"`, `"Gold"`, `"0-14 days"`). Send them back exactly as received when filtering. Translate only for display (see [section 7](#7-what-the-api-leaves-to-the-frontend)). |
| **Dates move** | The analysis date is the day the pipeline ran, so every date in the examples below will be different in your copy. Always read dates from the API. |

### Errors

Every error has the same shape: one field, `detail`, holding one readable sentence.

```json
{ "detail": "Unknown segment 'Hibernating'. Allowed values: Champions, Loyal, Potential loyalist, Needs attention, At risk, Churned." }
```

| Status | Meaning | Example `detail` |
|---|---|---|
| 400 | The request is well-formed but cannot be done | `The comparison date must be after the baseline date.` |
| 404 | Nothing has that identifier | `No customer with ID 'NOBODY'.` |
| 422 | A parameter is missing, mistyped or not an allowed value | `page_size: Input should be less than or equal to 200` |

When several inputs are wrong, the sentences are joined with `; `.

A helper that turns any failure into a thrown error with that sentence:

```js
async function call(path) {
  const response = await fetch(API + path);
  if (!response.ok) {
    const problem = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(problem.detail);
  }
  return response.json();
}
```

---

## 3. Filters

Five addresses take the same five filters: `/api/overview`, `/api/customers`,
`/api/customers.csv`, `/api/subscribers` and `/api/subscribers.csv`.

| Parameter | Allowed values | Shown in the design as |
|---|---|---|
| `segment` | `Champions`, `Loyal`, `Potential loyalist`, `Needs attention`, `At risk`, `Churned` | Segment chips |
| `tier` | `Platinum`, `Gold`, `Silver`, `Bronze` | **Class** chips |
| `department` | Any value of `lists.departments` from `/api/meta` | (not in the current design) |
| `recency_band` | `0-14 days`, `15-30 days`, `31-60 days`, `61-90 days`, `90+ days` | (not in the current design) |
| `tenure_band` | `Under 3 months`, `3-12 months`, `1-3 years`, `3-5 years`, `5+ years` | (not in the current design) |

Always take the allowed values from `lists` in `/api/meta`, not from this
table: the pipeline can change them.

**The filters test whatever the address lists.** On `/api/overview` and
`/api/customers`, `segment=Churned` means customers whose **customer** segment
is Churned. On `/api/subscribers` it means SIMs whose **own** segment is
Churned, whatever their customer's segment is.

**How they combine**

- Repeat a parameter to allow several values. Values of the same filter are
  alternatives (**or**).
- Different filters must all hold (**and**).
- Leave a filter out to not filter on it.

```
/api/customers?segment=At%20risk&segment=Churned&tier=Gold
```

keeps customers that are (At risk **or** Churned) **and** Gold.

**Build the query with `URLSearchParams`.** It encodes spaces and, importantly,
the `+` in `5+ years` and `90+ days`. Written by hand, a `+` in an address
means a space, and the API answers 422 for the unknown value `5 years`.

```js
function filterQuery(filters, extra = {}) {
  const query = new URLSearchParams();
  for (const [name, values] of Object.entries(filters)) {
    for (const value of values) query.append(name, value);          // repeats the parameter
  }
  for (const [name, value] of Object.entries(extra)) query.set(name, value);
  return query.toString();
}

filterQuery({ segment: ["At risk", "Churned"], tier: ["Gold"] }, { page: 0 });
// "segment=At+risk&segment=Churned&tier=Gold&page=0"
```

An unknown value is answered with 422 and the list of allowed values.
A `department` that does not exist is not an error; it simply matches nothing.

---

## 4. Which call feeds which screen

| Part of the design | Call | Fields |
|---|---|---|
| **Every page** | | |
| Date chip "Recharges 16 Nov 2025 – 15 Nov 2026" | `/api/meta` | `run.obs_start`, `run.analysis_date` |
| "Synthetic data" note in the side rail | `/api/meta` | `run.is_synthetic` (1 = show it) |
| Currency in front of amounts | `/api/meta` | `run.currency` |
| **Overview** | | |
| Yellow card: 12-month value, average per customer, customers, SIMs | `/api/overview` | `kpis.total_value`, `.average_value`, `.customers`, `.sims` |
| Ring "77%" and "4,039 of 5,217 customers are at 50% or higher" | `/api/overview`, `/api/meta` | `kpis.likely_active_share`, `.likely_active_customers`, `.customers`; `run.alive_threshold` |
| Black card: value at risk and the bar split by segment | `/api/overview` | `kpis.value_at_risk`; `by_segment[].value_at_risk` |
| "39% of it sits in At risk" | `/api/overview` | `by_segment[].value_at_risk_share` |
| Segment chips and donut | `/api/overview` | `by_segment[].name`, `.customers`, `.customers_share` |
| Segment detail panel | `/api/overview` | `by_segment[].customers`, `.sims`, `.average_value`, `.value_share`, `.value_at_risk`, `.average_p_active` |
| "View these customers" button | — | go to the Customers page with that segment selected |
| Ten value bars and "top 20% hold 66%" | `/api/overview` | `deciles[].value_share` (headline = first two added) |
| Freshness strip | `/api/overview` | `by_recency[].name`, `.customers` |
| Forecast check, three figures | `/api/meta` | `backtest.recharge_days_error_pct`, `.spend_error_pct`, `.mae_recharge_days` |
| Department ranking | `/api/overview` | `by_department[].name`, `.average_value` (already sorted) |
| **Transitions** | | |
| Baseline and comparison pickers | `/api/transitions/dates` | the list |
| Five tiles | `/api/transitions` | `summary.stayed_share`, `.top_segment_kept_share`, `.slipped_into_risk`, `.disconnected`, `.new_since_baseline` |
| Table: count and percent in each cell, total column | `/api/transitions` | `rows`, `cols`, `matrix`, `row_shares`, `row_totals` |
| **Customers page** (was "Subscribers") | | |
| Segment and Class chips | `/api/meta` | `lists.segments`, `lists.tiers` |
| "1,432 customers · 1,921 SIMs in this list" | `/api/customers` | `total`, `sims` |
| Table rows | `/api/customers` | `rows[]` |
| Yellow value bar in each row | `/api/customers` | `rows[].cltv_12m` ÷ `highest_value` |
| Search box | `/api/customers` | `search` parameter |
| Download CSV | `/api/customers.csv` | link with the same filters |
| **Opening a customer (drill-down)** | | |
| "4 SIMs: 1 Champion, 1 Potential loyalist, 2 Churned" | `/api/customers/{customer_id}` | `customer.sims_scored`, `sims_by_segment` |
| One line per SIM with its segment, class and value | `/api/customers/{customer_id}` | `sims[]` |

---

## 5. Reference

### 5.1 `GET /api/health`

Is the API up, and which scores are loaded? For monitoring, or to show a
"data as of" line.

No parameters.

```json
{
  "status": "ok",
  "database": "sqlite",
  "customers_scored": 5221,
  "sims_scored": 6131,
  "scored_as_of": "2026-11-15",
  "built": "2026-11-15"
}
```

| Field | Meaning |
|---|---|
| `status` | Always `"ok"`. If the database is unreachable the call fails with a 500 instead. |
| `database` | `"postgresql"` or `"sqlite"` |
| `customers_scored` | Customers in the data, agent and reseller accounts included |
| `sims_scored` | Scored SIMs |
| `scored_as_of` | The analysis date behind the scores |
| `built` | Day the pipeline last loaded the data |

---

### 5.2 `GET /api/meta`

Everything that stays the same until the next pipeline run. **Call it once
when the app opens and keep the answer.**

No parameters.

```json
{
  "run": {
    "analysis_date": "2026-11-15",
    "obs_start": "2025-11-16",
    "obs_end": "2026-11-15",
    "calib_end": "2026-08-15",
    "built": "2026-11-15",
    "is_synthetic": 1,
    "currency": "XOF",
    "margin": 0.8,
    "discount_rate": 0.1,
    "alive_threshold": 0.5,
    "max_sims": 5
  },
  "model": { "bgnbd_r": 0.9853, "bgnbd_alpha": 9.4834, "…": "…" },
  "quality": { "rows_read": 178995, "duplicate_events_removed": 535, "…": "…" },
  "backtest": {
    "holdout_days": 92,
    "recharge_days_error_pct": 5.907395967651774,
    "spend_error_pct": 4.804257991233718,
    "mae_recharge_days": 1.8624777618413135,
    "buckets": [
      { "bucket": "0", "sims": 710, "actual": 0.98, "predicted": 1.34 },
      { "bucket": "1-2", "sims": 1045, "actual": 1.22, "predicted": 1.23 }
    ]
  },
  "lists": {
    "departments": ["Alibori", "Atacora", "Atlantique", "Borgou", "Collines", "Couffo", "Donga", "Littoral", "Mono", "Ouémé", "Plateau", "Zou"],
    "segments": ["Champions", "Loyal", "Potential loyalist", "Needs attention", "At risk", "Churned"],
    "tiers": ["Platinum", "Gold", "Silver", "Bronze"],
    "recency_bands": ["0-14 days", "15-30 days", "31-60 days", "61-90 days", "90+ days"],
    "tenure_bands": ["Under 3 months", "3-12 months", "1-3 years", "3-5 years", "5+ years"]
  },
  "transition_dates": ["2026-05-31", "2026-06-30", "2026-07-31", "2026-08-31", "2026-09-30", "2026-10-31", "2026-11-15"]
}
```

| Field | Use |
|---|---|
| `run.analysis_date` | The day the analysis was done. Recency is counted back from it. |
| `run.obs_start` | First day of recharge history used; with `analysis_date` it gives the date range chip |
| `run.obs_end` | The same as `analysis_date` |
| `run.is_synthetic` | `1` → show the synthetic-data note; `0` → hide it |
| `run.currency` | Currency code for every amount |
| `run.margin` | The factor already applied to monetary and 12-month value (`0.8`). For a note such as "value is 80% of recharge spend". |
| `run.alive_threshold` | The "50%" in "at 50% or higher" |
| `run.max_sims` | Accounts with more SIMs than this are agents or resellers |
| `run.calib_end`, `run.discount_rate` | Background facts, useful for a "how these numbers are produced" note |
| `backtest.recharge_days_error_pct`, `.spend_error_pct` | **Already in percent** (`5.9` means +5.9 %), unlike shares. Show with a sign. |
| `backtest.mae_recharge_days` | "Typical miss per SIM", in recharge-days. The forecast is checked per SIM. |
| `lists.*` | Filter options, in display order. Segments run best to worst; classes best first. |
| `transition_dates` | Same list as `/api/transitions/dates` |
| `model`, `quality` | Model parameters and data-cleaning counts; not needed by the current design |

---

### 5.3 `GET /api/overview`

Every figure on the Overview page in one call. **Everything is counted in
customers.** Agent and reseller accounts are left out.

**Parameters**: the five [filters](#3-filters), all optional. The approved
design shows the Overview unfiltered, so call it with none.

```
GET /api/overview
GET /api/overview?segment=At%20risk&tier=Gold
```

**Answer** (lists shortened)

```json
{
  "kpis": {
    "customers": 5217,
    "all_customers": 5217,
    "sims": 6099,
    "multi_sim_customers": 1266,
    "customers_with_lapsed_sim": 386,
    "total_value": 73308757.7326,
    "average_value": 14051.899124516007,
    "total_monetary": 97715360.0,
    "value_at_risk": 19065345.3122,
    "likely_active_customers": 4039,
    "likely_active_share": 0.7741997316465402,
    "accounts_over_sim_limit": 4
  },
  "deciles": [
    { "decile": 1, "total_value": 33827027.9808, "value_share": 0.4614322903163493 },
    { "decile": 2, "total_value": 14436031.983000001, "value_share": 0.19692097410321246 }
  ],
  "by_segment": [
    {
      "name": "At risk",
      "customers": 559,
      "customers_share": 0.1071,
      "sims": 636,
      "total_value": 494087.5437,
      "value_share": 0.0067,
      "average_value": 883.8775,
      "average_p_active": 0.1281,
      "value_at_risk": 7431071.518,
      "value_at_risk_share": 0.3898
    }
  ],
  "by_department": [ { "name": "Couffo", "customers": 205, "average_value": 15838.933896097562, "…": "…" } ],
  "by_recency":    [ { "name": "0-14 days", "customers": 2203, "…": "…" } ],
  "by_tenure":     [ { "name": "Under 3 months", "…": "…" } ]
}
```

**`kpis`**

| Field | Meaning |
|---|---|
| `customers` | Customers matching the filters |
| `all_customers` | Customers in total, ignoring filters ("5,217 of 5,217") |
| `sims` | Scored SIMs held by the matching customers |
| `multi_sim_customers` | Matching customers with more than one SIM registered |
| `customers_with_lapsed_sim` | Matching customers in a healthy segment who nevertheless have at least one SIM gone quiet. They moved their usage; they did not leave. |
| `total_value` | Sum of predicted 12-month value |
| `average_value` | `total_value ÷ customers` |
| `total_monetary` | Sum of monetary: 0.8 × spend in the history window |
| `value_at_risk` | Value expected to be lost because SIMs may have lapsed |
| `likely_active_customers` | Customers at or above `run.alive_threshold` |
| `likely_active_share` | `likely_active_customers ÷ customers` |
| `accounts_over_sim_limit` | Agent and reseller accounts, which are in none of the figures. Ignores the filters. |

**`deciles`** — the matching customers ranked by value and cut into ten equal
groups. `decile` 1 is the most valuable tenth. Ten rows, unless fewer than ten
customers match (then one row per customer) or none match (empty list). The
headline "top 20% hold 66%" is `deciles[0].value_share + deciles[1].value_share`.

**`by_segment`, `by_department`, `by_recency`, `by_tenure`** — the same ten
fields for each group:

| Field | Meaning |
|---|---|
| `name` | Group name (a fixed English key) |
| `customers`, `customers_share` | Customers in the group, and their share of the breakdown |
| `sims` | Scored SIMs those customers hold |
| `total_value`, `value_share` | 12-month value, and its share |
| `average_value` | Value per customer |
| `average_p_active` | Average probability that a customer in the group is active (0–1) |
| `value_at_risk`, `value_at_risk_share` | Value at risk, and its share |

Things to know:

- **`by_segment` always has all six segments, in display order**, with zeros
  for a segment that has no customers. Same for `by_recency` and `by_tenure`.
  You can rely on position.
- **`by_department` only lists departments that have customers**, highest
  `average_value` first. A customer's department is that of their most
  valuable SIM.
- **`by_segment` ignores the `segment` filter, and `by_department` ignores the
  `department` filter**, so every option stays visible while some are
  selected. All other filters still apply to them.
- With no matching customers, counts and sums are `0`, shares are `0`, and
  `deciles` is `[]`. Nothing is `null`.

---

### 5.4 `GET /api/transitions/dates`

The dates that can be compared: recent month ends, then the analysis date.
Every customer was re-segmented on each. Oldest first. No parameters.

```json
["2026-05-31", "2026-06-30", "2026-07-31", "2026-08-31", "2026-09-30", "2026-10-31", "2026-11-15"]
```

For the two pickers: the baseline list is every date except the last; the
comparison list is every date after the chosen baseline. The dates change
with each pipeline run, so never hard-code them.

---

### 5.5 `GET /api/transitions`

Where the customers of each segment on the baseline date are on the comparison date.

| Parameter | Required | Value |
|---|---|---|
| `baseline` | yes | A date from `/api/transitions/dates` |
| `comparison` | yes | A later date from the same list |

```
GET /api/transitions?baseline=2026-08-31&comparison=2026-11-15
```

```json
{
  "baseline": "2026-08-31",
  "comparison": "2026-11-15",
  "rows": ["Champions", "Loyal", "Potential loyalist", "Needs attention", "At risk", "Churned", "New since baseline"],
  "cols": ["Champions", "Loyal", "Potential loyalist", "Needs attention", "At risk", "Churned", "Disconnected"],
  "matrix": [
    [1238, 9, 12, 104, 102, 0, 0],
    [48, 145, 2, 25, 27, 0, 0],
    [102, 68, 734, 256, 83, 229, 0],
    [36, 14, 187, 82, 77, 137, 72],
    [7, 7, 18, 16, 270, 47, 90],
    [0, 1, 141, 72, 0, 639, 55],
    [1, 0, 177, 79, 0, 25, 0]
  ],
  "row_totals": [1465, 247, 1472, 605, 455, 908, 282],
  "row_shares": [
    [0.8451, 0.0061, 0.0082, 0.071, 0.0696, 0.0, 0.0],
    "… one list per row …"
  ],
  "summary": {
    "segmented_at_baseline": 5152,
    "stayed": 3108,
    "stayed_share": 0.6032608695652174,
    "top_segment": "Champions",
    "top_segment_at_baseline": 1465,
    "top_segment_kept": 1238,
    "top_segment_kept_share": 0.8450511945392492,
    "slipped_into_risk": 727,
    "disconnected": 217,
    "new_since_baseline": 282
  }
}
```

**Reading the matrix.** `matrix[r][c]` is the number of customers that were in
`rows[r]` on the baseline date and are in `cols[c]` on the comparison date.
Above: of the 1,465 Champions on 31 August, 1,238 are still Champions and 102
are At risk.

- `row_shares[r][c]` is the same cell as a share of its row
  (`matrix[r][c] ÷ row_totals[r]`). Each row adds up to 1, or to 0 if the row
  is empty. This is the percentage under each count in the design.
- `row_totals[r]` is the Total column.
- A cell where `rows[r] === cols[c]` is "stayed in the same segment": outline it.

**Two labels are not segments**

- The last row, `"New since baseline"`: customers whose first recharge came
  after the baseline date. It also holds the few customers who had no
  connected SIM on the baseline date and have since recharged on a new one.
- The last column, `"Disconnected"`: customers with no connected SIM left on
  the comparison date.

**`summary`** feeds the five tiles:

| Tile | Field |
|---|---|
| "60% stayed in the same segment" | `stayed_share` (of `segmented_at_baseline`, which leaves out the new customers) |
| "85% of Champions kept" | `top_segment_kept_share`; the segment's name is in `top_segment` |
| "727 slipped into risk" | `slipped_into_risk`: from Champions, Loyal, Potential loyalist or Needs attention to At risk, Churned or Disconnected |
| "217 disconnected" | `disconnected` |
| "282 new since baseline" | `new_since_baseline` |

This call counts customers, including those since disconnected, and leaves out
agent and reseller accounts. **The filters do not apply to it.**

**Errors**

| Status | When |
|---|---|
| 400 | `comparison` is the same as or earlier than `baseline` |
| 404 | A date that is not in `/api/transitions/dates` |
| 422 | A date missing or not written `YYYY-MM-DD` |

---

### 5.6 `GET /api/customers`

One page of the customer list: the main list of the dashboard. One row per
customer, with their SIMs taken together. Filtering, searching, sorting and
paging are done by the database, so ask for a new page; never load everything.

| Parameter | Default | Value |
|---|---|---|
| the five [filters](#3-filters) | none | They test the customer's segment, class and so on |
| `search` | empty | Up to 60 characters. Matches any part of the customer ID (upper or lower case), **or of the MSISDN key of any of the customer's SIMs**. |
| `sort` | `cltv_12m` | Any field of a row (see below) |
| `descending` | `true` | `true` = largest first; `false` = smallest first |
| `page` | `0` | **The first page is 0** |
| `page_size` | `20` | 1 to 200 |
| `over_sim_limit` | `false` | `false` = people. `true` = agent and reseller accounts only. |

```
GET /api/customers?segment=Champions&sort=sims_scored&page_size=1
```

```json
{
  "total": 1432,
  "sims": 1921,
  "page": 0,
  "page_size": 1,
  "pages": 1432,
  "highest_value": 276358.6392,
  "rows": [
    {
      "customer_id": "C67F6C94373",
      "sims_scored": 4,
      "sims_registered": 4,
      "lapsed_sims": 2,
      "over_sim_limit": false,
      "department": "Ouémé",
      "segment": "Champions",
      "cltv_tier": "Platinum",
      "r_score": 5,
      "f_score": 5,
      "m_score": 5,
      "days_since_last": 1,
      "recency_band": "0-14 days",
      "recharge_days": 55,
      "monetary": 55880.0,
      "tenure_months": 92,
      "tenure_band": "5+ years",
      "p_active": 1.0,
      "cltv_12m": 44713.1296,
      "value_at_risk": 1281.2544,
      "contact_msisdn_key": "292491519634"
    }
  ]
}
```

**Around the rows**

| Field | Meaning |
|---|---|
| `total` | Customers matching the filters and search (all pages) |
| `sims` | Scored SIMs they hold |
| `page`, `page_size` | What was asked for |
| `pages` | Pages available; at least 1 |
| `highest_value` | Largest `cltv_12m` among **all** matching customers, not only this page. Row bar width = `cltv_12m ÷ highest_value`. `0` when nothing matches. |

**Each row**

| Field | Meaning | Column in the design |
|---|---|---|
| `customer_id` | Hashed national ID. Starts with `C`, or `S` for a SIM that could not be linked to a person (such a customer has exactly one SIM). | Customer |
| `sims_scored` | Their SIMs that are scored. The number of lines in the drill-down. | SIMs |
| `sims_registered` | SIMs registered to them, scored or not (some may be disconnected or never recharged) | — |
| `lapsed_sims` | How many of their scored SIMs are, on their own, At risk or Churned | (badge, if wanted) |
| `over_sim_limit` | `true` only when listing agent and reseller accounts | — |
| `department` | Department of their most valuable SIM | Department |
| `segment` | From the customer's combined R, F and M | Segment |
| `cltv_tier` | `Platinum`, `Gold`, `Silver` or `Bronze`, ranked among customers | Class |
| `r_score`, `f_score`, `m_score` | 1 to 5, 5 is best | R-F-M, shown as `5-5-5` |
| `days_since_last` | Recency: analysis date minus the last recharge on any of their SIMs | Days since recharge |
| `recency_band` | Band of `days_since_last` | — |
| `recharge_days` | Frequency: days on which any of their SIMs recharged | — |
| `monetary` | 0.8 × spend across all their SIMs | (Monetary, if wanted) |
| `tenure_months`, `tenure_band` | Months since their oldest scored SIM was activated | — |
| `p_active` | Probability that at least one of their SIMs is still active, 0–1 | Likely active |
| `cltv_12m` | Predicted 12-month value: the sum of their SIMs | 12-month value |
| `value_at_risk` | Sum of their SIMs' value at risk | Value at risk |
| `contact_msisdn_key` | Their most valuable SIM: the number to contact | Customer (second line) |

The dot colour beside "likely active" in the design: green from 0.7, orange
from 0.4, red below.

Things to know:

- **Rows with equal sort values are ordered by `customer_id`**, so paging is
  stable: no row is repeated or skipped between pages.
- **A page past the end is not an error**: `rows` is empty and `total` is still correct.
- **Reset `page` to 0** whenever a filter, the search text or the sort changes.
- **Searching a SIM's key finds its customer**, even when that SIM is not the
  contact number.
- Sorting by `r_score` sorts on R only, not on the three scores together.

**Agent and reseller accounts** (`over_sim_limit=true`). Their rows have
`segment` = `"Agent or reseller"`, `cltv_tier` = `"Unranked"` and scores of
`0`. Those two names are not in `lists` and cannot be used as filter values.
The synthetic data has 4 such accounts holding 32 SIMs.

**Errors**: 422 for an unknown `sort`, `page` below 0, `page_size` outside
1–200, `search` over 60 characters, or an unknown filter value.

---

### 5.7 `GET /api/customers.csv`

The filtered customer list as a file.

**Parameters**: the five [filters](#3-filters), `search` and `over_sim_limit`.
No paging or sort; rows are always most valuable first. At most 200,000 rows.

It is a download, so use a link, not `fetch`:

```js
downloadLink.href = `${API}/api/customers.csv?${filterQuery(filters, { search })}`;
```

```
customer_id,sims_scored,sims_registered,lapsed_sims,over_sim_limit,department,segment,cltv_tier,r_score,f_score,m_score,days_since_last,recency_band,recharge_days,monetary,tenure_months,tenure_band,p_active,cltv_12m,value_at_risk,contact_msisdn_key
C28279E8B17,1,1,0,0,Littoral,Loyal,Gold,5,4,3,1,0-14 days,23,11640.0,2,Under 3 months,0.9794,31559.5073,662.7911,989843900413
```

The columns are the same as the fields of a row in `/api/customers`, in the
same order, except that `over_sim_limit` is written `0` or `1`. The file is
UTF-8 with a byte-order mark so Excel reads accents correctly. The suggested
file name is `cltv_customer_list.csv`.

---

### 5.8 `GET /api/customers/{customer_id}`

**The drill-down.** One customer, then each of their SIMs with its own
segment, class and value. Call it when a row of the customer list is opened.

```
GET /api/customers/C67F6C94373
```

```json
{
  "customer": {
    "customer_id": "C67F6C94373",
    "sims_scored": 4,
    "segment": "Champions",
    "cltv_tier": "Platinum",
    "days_since_last": 1,
    "monetary": 55880.0,
    "p_active": 1.0,
    "cltv_12m": 44713.1296,
    "value_at_risk": 1281.2544,
    "contact_msisdn_key": "292491519634",
    "…": "the same fields as a row of /api/customers"
  },
  "sims": [
    { "msisdn_key": "292491519634", "segment": "Champions", "cltv_tier": "Platinum", "r_score": 5, "f_score": 5, "m_score": 5,
      "days_since_last": 1, "monetary": 50200.0, "p_alive": 0.9882, "cltv_12m": 39645.795, "value_at_risk": 474.2603, "…": "…" },
    { "msisdn_key": "428553785914", "segment": "Potential loyalist", "cltv_tier": "Bronze", "r_score": 4, "f_score": 3, "m_score": 2,
      "days_since_last": 17, "monetary": 3560.0, "p_alive": 0.9564, "cltv_12m": 3082.6336, "value_at_risk": 140.3908, "…": "…" },
    { "msisdn_key": "435026156785", "segment": "Churned", "cltv_tier": "Bronze", "r_score": 1, "f_score": 1, "m_score": 1,
      "days_since_last": 232, "monetary": 1880.0, "p_alive": 0.6733, "cltv_12m": 997.0776, "value_at_risk": 483.8551, "…": "…" },
    { "msisdn_key": "455443236991", "segment": "Churned", "cltv_tier": "Bronze", "r_score": 1, "f_score": 1, "m_score": 1,
      "days_since_last": 98, "monetary": 240.0, "p_alive": 0.8439, "cltv_12m": 987.6234, "value_at_risk": 182.7481, "…": "…" }
  ],
  "sims_by_segment": { "Champions": 1, "Potential loyalist": 1, "Churned": 2 }
}
```

| Part | Meaning |
|---|---|
| `customer` | Exactly the row `/api/customers` returns for this customer |
| `sims` | Their scored SIMs, most valuable first. Each has the fields of a row of [`/api/subscribers`](#59-get-apisubscribers). `sims.length` equals `customer.sims_scored`. |
| `sims_by_segment` | How many of those SIMs are in each SIM segment, in display order; segments with no SIM are left out. For a line such as "4 SIMs: 1 Champion, 1 Potential loyalist, 2 Churned". |

How the customer's figures relate to the SIMs shown:

| Customer field | From the SIMs |
|---|---|
| `cltv_12m`, `value_at_risk`, `monetary` | The sum |
| `days_since_last` | The smallest (the most recently recharged SIM) |
| `contact_msisdn_key` | `sims[0].msisdn_key` |
| `p_active` | 1 − the product of each SIM's (1 − `p_alive`) |
| `recharge_days` | Not the sum: a day on which two SIMs recharged counts once |
| `segment`, `r_score`, `f_score`, `m_score`, `cltv_tier` | Worked out from the customer's combined figures, so they need not match any single SIM |

This address also works for agent and reseller accounts.

The ID must match exactly, in upper case as returned by the API.

**Errors**: 404 if no customer has that ID.

---

### 5.9 `GET /api/subscribers`

One page of the list of every scored SIM, whoever it belongs to. Not a page of
the current design; use it if a "by SIM" view or a SIM-level export is wanted.

| Parameter | Default | Value |
|---|---|---|
| the five [filters](#3-filters) | none | They test **the SIM's own** segment, class and so on |
| `search` | empty | Matches any part of the MSISDN key or of the customer ID |
| `sort` | `cltv_12m` | Any field of a row |
| `descending` | `true` | |
| `page` | `0` | The first page is 0 |
| `page_size` | `20` | 1 to 200 |

```
GET /api/subscribers?segment=Churned&tier=Gold&page_size=1
```

```json
{
  "total": 1,
  "customers": 1,
  "page": 0,
  "page_size": 1,
  "pages": 1,
  "highest_value": 13241.3407,
  "rows": [
    {
      "customer_id": "C09302604B1",
      "msisdn_key": "369289726479",
      "customer_sims": 2,
      "department": "Atlantique",
      "segment": "Churned",
      "cltv_tier": "Gold",
      "r_score": 2,
      "f_score": 2,
      "m_score": 4,
      "days_since_last": 65,
      "recency_band": "61-90 days",
      "recharge_days": 9,
      "monetary": 18320.0,
      "tenure_months": 46,
      "t_days_observed": 325,
      "exp_avg_value": 2471.9324,
      "p_alive": 0.8229,
      "exp_recharge_days_90d": 1.9198,
      "cltv_12m": 13241.3407,
      "value_at_risk": 2850.4596
    }
  ]
}
```

| Field | Meaning |
|---|---|
| `customer_id` | The customer this SIM belongs to |
| `msisdn_key` | Surrogate MSISDN key, as text |
| `customer_sims` | SIMs registered to that customer |
| `segment` | From this SIM's own R, F and M. May differ from the customer's segment. |
| `cltv_tier` | Class, ranked among SIMs |
| `r_score`, `f_score`, `m_score` | 1 to 5 |
| `days_since_last` | Recency: analysis date minus this SIM's last recharge |
| `recharge_days` | Frequency: days with at least one recharge |
| `monetary` | 0.8 × this SIM's spend |
| `tenure_months` | Months since the line was activated |
| `t_days_observed` | Days since the first recharge seen in the window |
| `exp_avg_value` | Expected spend per future recharge-day |
| `p_alive` | Probability the SIM is still active, 0–1 |
| `exp_recharge_days_90d` | Expected recharge-days in the next 90 days |
| `cltv_12m`, `value_at_risk` | The model's output for this SIM |

`total`, `page`, `page_size`, `pages` and `highest_value` work as in
`/api/customers`; `customers` is the number of distinct customers among the
matching SIMs. This list includes the SIMs of agent and reseller accounts.

**Errors**: as for `/api/customers`.

---

### 5.10 `GET /api/subscribers.csv`

The filtered SIM list as a file. Same filters and search as `/api/subscribers`,
most valuable SIMs first, at most 200,000 rows. Suggested file name
`cltv_sim_list.csv`.

```
customer_id,msisdn_key,customer_sims,department,segment,cltv_tier,r_score,f_score,m_score,days_since_last,recency_band,recharge_days,monetary,tenure_months,t_days_observed,exp_avg_value,p_alive,exp_recharge_days_90d,cltv_12m,value_at_risk
CDD5AAE6298,751187193216,1,Atacora,Loyal,Gold,5,4,3,2,0-14 days,20,10720.0,2,72,686.5007,0.9715,18.4023,29991.6888,880.524
```

---

## 6. Recipes

### When the app opens

```js
const meta = await call("/api/meta");            // once; keep it
const overview = await call("/api/overview");    // the Overview page
```

`meta` gives the currency, the date range, the filter lists and the transition
dates, so no other call is needed before drawing the frame of any page.

### Overview page

One call, no parameters. Everything on the page comes from `overview` and
`meta` (see the table in [section 4](#4-which-call-feeds-which-screen)).
Selecting a segment in the explorer needs no new call: all six segments are
already in `by_segment`.

### Transitions page

```js
const dates = meta.transition_dates;
let baseline = dates.at(-4);          // about three months back
let comparison = dates.at(-1);        // the analysis date

const transitions = await call(`/api/transitions?baseline=${baseline}&comparison=${comparison}`);
```

When the baseline changes, rebuild the comparison list (`dates.filter(d => d > baseline)`)
and, if the current comparison is no longer later than the baseline, move it
to the last date before calling again. That way a 400 never happens.

### Customers page

```js
const state = { filters: { segment: [], tier: [] }, search: "", sort: "cltv_12m", descending: true, page: 0 };

async function loadList() {
  const query = filterQuery(state.filters, {
    search: state.search, sort: state.sort, descending: state.descending, page: state.page, page_size: 20,
  });
  return call(`/api/customers?${query}`);
}
```

- A chip toggles a value in `state.filters.segment` or `state.filters.tier`;
  then set `state.page = 0` and call `loadList()`.
- Wait about 300 ms after the last keystroke before searching, so each letter
  typed does not become a request.
- If the user can change filters quickly, ignore answers that arrive out of
  order (keep a counter and drop any answer that is not the latest).
- "View these customers" on the Overview: set `state.filters = { segment: [name], tier: [] }`,
  open the Customers page, load.

### Opening a customer

```js
async function openCustomer(customerId) {
  const { customer, sims, sims_by_segment } = await call(`/api/customers/${customerId}`);
  // Heading: "4 SIMs · Champions · Platinum"
  // Summary: Object.entries(sims_by_segment) -> "1 Champions, 1 Potential loyalist, 2 Churned"
  // One line per SIM: msisdn_key, segment, cltv_tier, days_since_last, p_alive, cltv_12m
}
```

Load it when the row is opened, not for every row of the page. A customer with
`sims_scored` of 1 has one line; you may choose not to offer the drill-down
for them.

### Showing numbers

```js
const amount  = (value) => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
const percent = (share) => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(share);

percent(0.7742);   // "77%"
```

Remember that the two `backtest.*_error_pct` figures are already percentages.

---

## 7. What the API leaves to the frontend

- **Language.** The API has no language setting. Names come back in English
  and must be sent back in English. The wording used in the approved design:

  | From the API | French |
  |---|---|
  | Champions | Champions |
  | Loyal | Fidèles |
  | Potential loyalist | Fidèles potentiels |
  | Needs attention | À surveiller |
  | At risk | À risque |
  | Churned | Perdues |
  | Disconnected | Déconnectées |
  | New since baseline | Nouvelles depuis la référence |
  | Agent or reseller | Agent ou revendeur |
  | Platinum / Gold / Silver / Bronze / Unranked | Platine / Or / Argent / Bronze / Non classé |
  | 0-14 days … 90+ days | 0-14 jours … 90+ jours |
  | Under 3 months / 3-12 months / 1-3 years / 3-5 years / 5+ years | Moins de 3 mois / 3-12 mois / 1-3 ans / 3-5 ans / 5 ans et plus |

  The design's wording spoke of SIMs ("6,131 SIMs scored"). The headline
  figures are now customers, so labels need to say customers.

- **Segment descriptions and recommended actions.** The "who they are" line,
  the headline action and the lever tags in the segment explorer are marketing
  copy and live in the frontend, keyed by segment name.
- **Formatting.** Currency placement, thousands separators, rounding
  (`73308757.7` → `XOF 73.3M`), percent signs.
- **Status colours.** The healthy / watch / win-back label on a segment and
  the dot beside "likely active" are derived from `average_p_active`,
  `p_active` and `p_alive` (green from 0.7, orange from 0.4, red below).
- **Department names** contain accents (`Ouémé`). They are data, not keys to
  translate.
