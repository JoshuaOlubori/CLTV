from enum import Enum

from pydantic import BaseModel, Field

import config as cfg

ISO_DATE = r"^\d{4}-\d{2}-\d{2}$"


class Health(BaseModel):
    status: str = Field(description="Always 'ok' when the API can reach the database.", examples=["ok"])
    database: str = Field(description="Kind of database in use.", examples=["postgresql"])
    customers_scored: int = Field(description="Rows in cltv_customer_scores.", examples=[5221])
    sims_scored: int = Field(description="Rows in cltv_line_scores.", examples=[6131])
    scored_as_of: str = Field(description="The analysis date of the current scores.", examples=["2026-11-15"])
    built: str = Field(description="Day the pipeline last loaded the tables.", examples=["2026-11-15"])


class RunInfo(BaseModel):
    analysis_date: str = Field(description="The day the analysis was done. Recency is counted back from it.", examples=["2026-11-15"])
    obs_start: str = Field(description="First day of recharge history used.", examples=["2025-11-16"])
    obs_end: str = Field(description="Last day of recharge history used. Same as analysis_date.", examples=["2026-11-15"])
    calib_end: str = Field(description="The model is back-tested on the days after this date.", examples=["2026-08-15"])
    built: str = Field(description="Day the tables were loaded.", examples=["2026-11-15"])
    is_synthetic: int = Field(description="1 if the data is synthetic (show a warning), 0 if real.", examples=[1])
    currency: str = Field(examples=["XOF"])
    margin: float = Field(description="Share of recharge spend counted as value: monetary = margin x spend, "
                                      "and 12-month value is margin x predicted spend.", examples=[0.8])
    discount_rate: float = Field(description="Annual discount rate applied to future value.", examples=[0.1])
    alive_threshold: float = Field(description="A customer or SIM is 'likely active' at or above this probability.", examples=[0.5])
    max_sims: int = Field(description="An account with more SIMs than this is treated as an agent or reseller.", examples=[5])


class BacktestBucket(BaseModel):
    bucket: str = Field(description="Repeat recharge-days before the holdout period.", examples=["6-10"])
    sims: int
    actual: float = Field(description="Average recharge-days per SIM that really happened in the holdout.")
    predicted: float = Field(description="Average recharge-days per SIM the model predicted.")


class Backtest(BaseModel):
    holdout_days: int = Field(description="Length of the holdout period in days.", examples=[92])
    recharge_days_error_pct: float = Field(description="Predicted vs actual total recharge-days, in percent.", examples=[5.9])
    spend_error_pct: float = Field(description="Predicted vs actual total spend, in percent.", examples=[4.8])
    mae_recharge_days: float = Field(description="Average absolute miss per SIM, in recharge-days.", examples=[1.86])
    buckets: list[BacktestBucket]


class Lists(BaseModel):
    """The allowed values for each filter, in display order."""
    departments: list[str]
    segments: list[str]
    tiers: list[str] = Field(description="Value tiers, best first. Shown as 'Class' on the dashboard.")
    recency_bands: list[str]
    tenure_bands: list[str]


class Meta(BaseModel):
    run: RunInfo
    model: dict[str, float] = Field(description="Fitted model parameters (BG/NBD and Gamma-Gamma).")
    quality: dict[str, int] = Field(description="What the data cleaning read and removed.")
    backtest: Backtest
    lists: Lists
    transition_dates: list[str] = Field(description="Snapshot dates available for /api/transitions, oldest first. "
                                                    "The last one is the analysis date.")


class Kpis(BaseModel):
    customers: int = Field(description="Customers matching the filters.")
    all_customers: int = Field(description="Customers in total, ignoring the filters.")
    sims: int = Field(description="Scored SIMs held by the matching customers.")
    multi_sim_customers: int = Field(description="Matching customers with more than one SIM registered.")
    customers_with_lapsed_sim: int = Field(description="Matching customers in a healthy segment who nevertheless have at least "
                                                       "one SIM that has gone quiet. They moved their usage; they did not leave.")
    total_value: float = Field(description="Sum of predicted 12-month value.")
    average_value: float = Field(description="total_value / customers (0 if there are none).")
    total_monetary: float = Field(description="Sum of monetary: margin x spend in the history window.")
    value_at_risk: float = Field(description="Value expected to be lost because SIMs may have lapsed.")
    likely_active_customers: int = Field(description="Customers whose probability of being active is at or above the threshold.")
    likely_active_share: float = Field(description="likely_active_customers / customers.")
    accounts_over_sim_limit: int = Field(description="Agent or reseller accounts, which are left out of every figure here. Ignores the filters.")


class Decile(BaseModel):
    decile: int = Field(description="1 = the most valuable tenth of the matching customers.", ge=1, le=10)
    total_value: float
    value_share: float = Field(description="This decile's share of the total value.")


class GroupStats(BaseModel):
    """Figures for one group of customers: a segment, a department, or a band."""
    name: str
    customers: int
    customers_share: float = Field(description="Share of the customers in this breakdown.")
    sims: int = Field(description="Scored SIMs held by these customers.")
    total_value: float
    value_share: float = Field(description="Share of the value in this breakdown.")
    average_value: float = Field(description="Average predicted 12-month value per customer.")
    average_p_active: float = Field(description="Average probability that a customer in the group is still active.")
    value_at_risk: float
    value_at_risk_share: float = Field(description="Share of the value at risk in this breakdown.")


class Overview(BaseModel):
    kpis: Kpis
    deciles: list[Decile] = Field(description="Up to ten rows; fewer only if fewer than ten customers match.")
    by_segment: list[GroupStats] = Field(description="Every segment, in display order. Ignores the segment filter.")
    by_department: list[GroupStats] = Field(description="Departments with customers, highest average value first. Ignores the department filter.")
    by_recency: list[GroupStats] = Field(description="Every recency band, in order.")
    by_tenure: list[GroupStats] = Field(description="Every tenure band, in order.")


class TransitionSummary(BaseModel):
    segmented_at_baseline: int = Field(description="Customers that had a segment on the baseline date.")
    stayed: int = Field(description="Of those, customers in the same segment on the comparison date.")
    stayed_share: float
    top_segment: str = Field(description="The best segment (first in the list).", examples=["Champions"])
    top_segment_at_baseline: int
    top_segment_kept: int = Field(description="Customers in the top segment on both dates.")
    top_segment_kept_share: float
    slipped_into_risk: int = Field(description="Customers that moved from a healthy segment to a risk segment or were disconnected.")
    disconnected: int = Field(description="Segmented customers with no connected SIM left by the comparison date.")
    new_since_baseline: int = Field(description="Customers whose first recharge came after the baseline date.")


class Transitions(BaseModel):
    baseline: str = Field(examples=["2026-08-31"])
    comparison: str = Field(examples=["2026-11-15"])
    rows: list[str] = Field(description="Segment on the baseline date (matrix rows). The last row is customers that were new.")
    cols: list[str] = Field(description="Segment on the comparison date (matrix columns). The last column is disconnected customers.")
    matrix: list[list[int]] = Field(description="matrix[r][c] = customers that were in rows[r] and are now in cols[c].")
    row_totals: list[int] = Field(description="Sum of each matrix row.")
    row_shares: list[list[float]] = Field(description="matrix[r][c] / row_totals[r]: each cell as a share of its row.")
    summary: TransitionSummary


class Customer(BaseModel):
    """One customer: their scored SIMs taken together."""
    customer_id: str = Field(description="Hashed national ID. Starts with C, or S for a SIM that could not be linked to a person.",
                             examples=["CE6D2694CC2"])
    sims_scored: int = Field(description="Their SIMs that are scored (connected, with a recharge). The number of rows in the drill-down.")
    sims_registered: int = Field(description="SIMs registered to them, scored or not.")
    lapsed_sims: int = Field(description="How many of their scored SIMs are, on their own, in a risk segment (silent 61 days or more).")
    over_sim_limit: bool = Field(description="True for an agent or reseller account (more SIMs than run.max_sims).")
    department: str = Field(description="Department of their most valuable SIM.")
    segment: str = Field(description="From the customer's combined R, F and M. 'Agent or reseller' if over_sim_limit.")
    cltv_tier: str = Field(description="Platinum, Gold, Silver or Bronze by customer value; 'Unranked' if over_sim_limit. "
                                       "Shown as 'Class' on the dashboard.")
    r_score: int = Field(ge=0, le=5, description="1-5 from the recency band; 0 if over_sim_limit.")
    f_score: int = Field(ge=0, le=5, description="1-5; 0 if over_sim_limit.")
    m_score: int = Field(ge=0, le=5, description="1-5; 0 if over_sim_limit.")
    days_since_last: int = Field(description="RECENCY: analysis date minus the last recharge on any of their SIMs.")
    recency_band: str
    recharge_days: int = Field(description="FREQUENCY: days on which any of their SIMs recharged.")
    monetary: float = Field(description="MONETARY: run.margin x spend across all their SIMs in the history window.")
    tenure_months: int = Field(description="Months since their oldest scored SIM was activated.")
    tenure_band: str
    p_active: float = Field(ge=0, le=1, description="Probability that at least one of their SIMs is still active.")
    cltv_12m: float = Field(description="Predicted 12-month value: the sum of their SIMs.")
    value_at_risk: float = Field(description="Sum of their SIMs' value at risk.")
    contact_msisdn_key: str = Field(description="Their most valuable SIM: the number to contact.")


CustomerSort = Enum("CustomerSort", {name: name for name in Customer.model_fields}, type=str)


class CustomerPage(BaseModel):
    total: int = Field(description="Customers matching the filters and search.")
    sims: int = Field(description="Scored SIMs held by them.")
    page: int = Field(description="Page returned; the first page is 0.")
    page_size: int
    pages: int = Field(description="Number of pages available (at least 1).")
    highest_value: float = Field(description="Largest 12-month value among ALL matching customers (not just this page); "
                                             "use it to scale the value bar in each row. 0 if nothing matches.")
    rows: list[Customer]


class Subscriber(BaseModel):
    """One scored SIM."""
    customer_id: str = Field(description="The customer this SIM belongs to.", examples=["CE6D2694CC2"])
    msisdn_key: str = Field(description="Surrogate MSISDN key, as text.", examples=["800996079508"])
    customer_sims: int = Field(description="SIMs registered to that customer.")
    department: str
    segment: str = Field(description="From this SIM's own R, F and M. May differ from the customer's segment.")
    cltv_tier: str = Field(description="Platinum, Gold, Silver or Bronze among SIMs.")
    r_score: int = Field(ge=1, le=5)
    f_score: int = Field(ge=1, le=5)
    m_score: int = Field(ge=1, le=5)
    days_since_last: int = Field(description="RECENCY: analysis date minus this SIM's last recharge.")
    recency_band: str
    recharge_days: int = Field(description="FREQUENCY: days with at least one recharge in the window.")
    monetary: float = Field(description="MONETARY: run.margin x this SIM's spend in the history window.")
    tenure_months: int = Field(description="Months since the line was activated.")
    t_days_observed: int = Field(description="Days since the first recharge seen in the window (the model's clock).")
    exp_avg_value: float = Field(description="Expected spend per future recharge-day.")
    p_alive: float = Field(description="Probability the SIM is still active.", ge=0, le=1)
    exp_recharge_days_90d: float = Field(description="Expected recharge-days in the next 90 days.")
    cltv_12m: float = Field(description="Predicted 12-month value.")
    value_at_risk: float


SortColumn = Enum("SortColumn", {name: name for name in Subscriber.model_fields}, type=str)


class SubscriberPage(BaseModel):
    total: int = Field(description="SIMs matching the filters and search.")
    customers: int = Field(description="Distinct customers among them.")
    page: int = Field(description="Page returned; the first page is 0.")
    page_size: int
    pages: int = Field(description="Number of pages available (at least 1).")
    highest_value: float = Field(description="Largest 12-month value among ALL matching SIMs (not just this page). 0 if nothing matches.")
    rows: list[Subscriber]


class CustomerDetail(BaseModel):
    """The drill-down: one customer, then each of their SIMs with its own segment and value."""
    customer: Customer
    sims: list[Subscriber] = Field(description="The customer's scored SIMs, most valuable first.")
    sims_by_segment: dict[str, int] = Field(description="How many of those SIMs are in each SIM segment, "
                                                        "e.g. {'Champions': 1, 'Churned': 1}.")


class Error(BaseModel):
    detail: str = Field(description="What went wrong, in plain words.")


EXPORT_LIMIT_NOTE = f"At most {cfg.EXPORT_ROW_LIMIT:,} rows are returned."
