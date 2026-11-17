import type { CustomerDetail, CustomerPage, Filters, Health, Meta, Overview, Transitions } from "./types";

/** Empty in dev: Vite proxies /api to the FastAPI server on port 8000.
 *  In production builds, set VITE_API_URL to the API's public address. */
export const API_BASE: string = import.meta.env.VITE_API_URL ?? "";

/** Turns any failed call into an Error carrying the API's `detail` sentence. */
async function call<T>(path: string): Promise<T> {
  const response = await fetch(API_BASE + path);
  if (!response.ok) {
    const problem = await response.json().catch(() => ({ detail: response.statusText }));
    const detail = typeof problem.detail === "string" ? problem.detail : JSON.stringify(problem.detail);
    throw new Error(detail);
  }
  return response.json() as Promise<T>;
}

/** Repeats a parameter per selected value; URLSearchParams encodes the "+"
 *  in "5+ years" and "90+ days" correctly. */
export function filterQuery(filters: Filters, extra: Record<string, string | number | boolean> = {}): string {
  const query = new URLSearchParams();
  for (const [name, values] of Object.entries(filters)) {
    for (const value of values ?? []) query.append(name, value);
  }
  for (const [name, value] of Object.entries(extra)) query.set(name, String(value));
  return query.toString();
}

export const api = {
  health: () => call<Health>("/api/health"),
  meta: () => call<Meta>("/api/meta"),
  overview: (filters: Filters = {}) => call<Overview>(`/api/overview?${filterQuery(filters)}`),
  transitionDates: () => call<string[]>("/api/transitions/dates"),
  transitions: (baseline: string, comparison: string) =>
    call<Transitions>(`/api/transitions?${filterQuery({}, { baseline, comparison })}`),
  customers: (params: {
    filters: Filters;
    search: string;
    sort?: string;
    descending?: boolean;
    page: number;
    pageSize: number;
  }) =>
    call<CustomerPage>(
      `/api/customers?${filterQuery(params.filters, {
        search: params.search,
        sort: params.sort ?? "cltv_12m",
        descending: params.descending ?? true,
        page: params.page,
        page_size: params.pageSize,
      })}`,
    ),
  customer: (customerId: string) => call<CustomerDetail>(`/api/customers/${encodeURIComponent(customerId)}`),
  customersCsvUrl: (filters: Filters, search: string) =>
    `${API_BASE}/api/customers.csv?${filterQuery(filters, { search })}`,
};