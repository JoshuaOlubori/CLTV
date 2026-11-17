/** Shapes returned by the Subscriber CLTV API (see README.md, section 5). */

export interface Health {
  status: string;
  database: string;
  customers_scored: number;
  sims_scored: number;
  scored_as_of: string;
  built: string;
}

export interface Meta {
  run: {
    analysis_date: string;
    obs_start: string;
    obs_end: string;
    calib_end: string;
    built: string;
    is_synthetic: number;
    currency: string;
    margin: number;
    discount_rate: number;
    alive_threshold: number;
    max_sims: number;
  };
  model: Record<string, unknown>;
  quality: Record<string, unknown>;
  backtest: {
    holdout_days: number;
    recharge_days_error_pct: number;
    spend_error_pct: number;
    mae_recharge_days: number;
    buckets: { bucket: string; sims: number; actual: number; predicted: number }[];
  };
  lists: {
    departments: string[];
    segments: string[];
    tiers: string[];
    recency_bands: string[];
    tenure_bands: string[];
  };
  transition_dates: string[];
}

/** One group of a breakdown (segment, department, recency band, tenure band). */
export interface Group {
  name: string;
  customers: number;
  customers_share: number;
  sims: number;
  total_value: number;
  value_share: number;
  average_value: number;
  average_p_active: number;
  value_at_risk: number;
  value_at_risk_share: number;
}

export interface Overview {
  kpis: {
    customers: number;
    all_customers: number;
    sims: number;
    multi_sim_customers: number;
    customers_with_lapsed_sim: number;
    total_value: number;
    average_value: number;
    total_monetary: number;
    value_at_risk: number;
    likely_active_customers: number;
    likely_active_share: number;
    accounts_over_sim_limit: number;
  };
  deciles: { decile: number; total_value: number; value_share: number }[];
  by_segment: Group[];
  by_department: Group[];
  by_recency: Group[];
  by_tenure: Group[];
}

export interface Transitions {
  baseline: string;
  comparison: string;
  rows: string[];
  cols: string[];
  matrix: number[][];
  row_totals: number[];
  row_shares: number[][];
  summary: {
    segmented_at_baseline: number;
    stayed: number;
    stayed_share: number;
    top_segment: string;
    top_segment_at_baseline: number;
    top_segment_kept: number;
    top_segment_kept_share: number;
    slipped_into_risk: number;
    disconnected: number;
    new_since_baseline: number;
  };
}

export interface CustomerRow {
  customer_id: string;
  sims_scored: number;
  sims_registered: number;
  lapsed_sims: number;
  over_sim_limit: boolean;
  department: string;
  segment: string;
  cltv_tier: string;
  r_score: number;
  f_score: number;
  m_score: number;
  days_since_last: number;
  recency_band: string;
  recharge_days: number;
  monetary: number;
  tenure_months: number;
  tenure_band: string;
  p_active: number;
  cltv_12m: number;
  value_at_risk: number;
  contact_msisdn_key: string;
}

export interface CustomerPage {
  total: number;
  sims: number;
  page: number;
  page_size: number;
  pages: number;
  highest_value: number;
  rows: CustomerRow[];
}

export interface SimRow {
  customer_id: string;
  msisdn_key: string;
  customer_sims: number;
  department: string;
  segment: string;
  cltv_tier: string;
  r_score: number;
  f_score: number;
  m_score: number;
  days_since_last: number;
  recency_band: string;
  recharge_days: number;
  monetary: number;
  tenure_months: number;
  t_days_observed: number;
  exp_avg_value: number;
  p_alive: number;
  exp_recharge_days_90d: number;
  cltv_12m: number;
  value_at_risk: number;
}

export interface CustomerDetail {
  customer: CustomerRow;
  sims: SimRow[];
  sims_by_segment: Record<string, number>;
}

/** The five filters shared by overview / customers / subscribers. */
export interface Filters {
  segment?: string[];
  tier?: string[];
  department?: string[];
  recency_band?: string[];
  tenure_band?: string[];
}