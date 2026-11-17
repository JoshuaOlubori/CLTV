import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Filters } from "@/lib/types";

/** Called once when the app opens; kept for the whole session. */
export function useMeta() {
  return useQuery({
    queryKey: ["meta"],
    queryFn: api.meta,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function useOverview(filters: Filters = {}, enabled = true) {
  return useQuery({
    queryKey: ["overview", filters],
    queryFn: () => api.overview(filters),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useTransitions(baseline: string | undefined, comparison: string | undefined) {
  return useQuery({
    queryKey: ["transitions", baseline, comparison],
    queryFn: () => api.transitions(baseline!, comparison!),
    enabled: Boolean(baseline && comparison && baseline < comparison),
    placeholderData: keepPreviousData,
  });
}

export function useCustomers(params: {
  filters: Filters;
  search: string;
  page: number;
  pageSize: number;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: ["customers", params.filters, params.search, params.page, params.pageSize],
    queryFn: () => api.customers(params),
    enabled: params.enabled ?? true,
    placeholderData: keepPreviousData,
  });
}

/** The drill-down: loaded when a row is opened, not for every row. */
export function useCustomer(customerId: string | null) {
  return useQuery({
    queryKey: ["customer", customerId],
    queryFn: () => api.customer(customerId!),
    enabled: Boolean(customerId),
  });
}