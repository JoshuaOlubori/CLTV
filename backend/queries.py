import config as cfg
from backend import db

CUSTOMERS = "cltv_customer_scores"
SIMS = "cltv_line_scores"

FILTER_COLUMNS = {
    "department": "department",
    "segment": "segment",
    "tier": "cltv_tier",
    "recency_band": "recency_band",
    "tenure_band": "tenure_band",
}

# Must match the fields of schemas.Customer / schemas.Subscriber.
CUSTOMER_COLUMNS = [
    "customer_id", "sims_scored", "sims_registered", "lapsed_sims", "over_sim_limit", "department",
    "segment", "cltv_tier", "r_score", "f_score", "m_score", "days_since_last", "recency_band",
    "recharge_days", "monetary", "tenure_months", "tenure_band", "p_active", "cltv_12m", "value_at_risk",
    "contact_msisdn_key",
]

SIM_COLUMNS = [
    "customer_id", "msisdn_key", "customer_sims", "department", "segment", "cltv_tier",
    "r_score", "f_score", "m_score", "days_since_last", "recency_band", "recharge_days", "monetary",
    "tenure_months", "t_days_observed", "exp_avg_value", "p_alive", "exp_recharge_days_90d",
    "cltv_12m", "value_at_risk",
]

SEGMENTS = [name for name, *_ in cfg.SEGMENT_RULES]
TIERS = [name for name, _ in cfg.TIERS]
RECENCY_BANDS = [name for _, name, _ in cfg.RECENCY_BANDS]
TENURE_BANDS = [name for _, name in cfg.TENURE_BANDS]

ALLOWED_VALUES = {"segment": SEGMENTS, "tier": TIERS, "recency_band": RECENCY_BANDS, "tenure_band": TENURE_BANDS}

NEW_SINCE_BASELINE = "New since baseline"
DISCONNECTED = "Disconnected"
TRANSITION_ROWS = SEGMENTS + [NEW_SINCE_BASELINE]
TRANSITION_COLS = SEGMENTS + [DISCONNECTED]

# Risk segments: silent for 61+ days (R score 1-2). All others are healthy.
RISK_SEGMENTS = [name for name, r_range, _, _ in cfg.SEGMENT_RULES if r_range[1] <= 2]
HEALTHY_SEGMENTS = [name for name in SEGMENTS if name not in RISK_SEGMENTS]
TOP_SEGMENT = SEGMENTS[0]


def share(part, whole):
    return part / whole if whole else 0.0


def pages_needed(total, page_size):
    return max(1, -(-total // page_size))


def filter_conditions(filters, skip=None):
    conditions, params = [], {}
    for name, column in FILTER_COLUMNS.items():
        values = [value for value in filters.get(name) or [] if value]
        if not values or name == skip:
            continue
        keys = [f"{name}_{i}" for i in range(len(values))]
        conditions.append(f"{column} IN ({', '.join(':' + key for key in keys)})")
        params.update(zip(keys, values))
    return conditions, params


def search_text(search):
    return f"%{search.strip().upper()}%" if search and search.strip() else None


def where_customers(filters, skip=None, search=None, over_sim_limit=False):
    conditions, params = filter_conditions(filters, skip)
    conditions.insert(0, "over_sim_limit = :over_sim_limit")
    params["over_sim_limit"] = int(over_sim_limit)
    pattern = search_text(search)
    if pattern:
        conditions.append(f"""(UPPER(customer_id) LIKE :search
              OR customer_id IN (SELECT customer_id FROM {SIMS} WHERE CAST(msisdn_key AS TEXT) LIKE :search))""")
        params["search"] = pattern
    return "WHERE " + " AND ".join(conditions), params


def where_sims(filters, search=None):
    conditions, params = filter_conditions(filters)
    pattern = search_text(search)
    if pattern:
        conditions.append("(CAST(msisdn_key AS TEXT) LIKE :search OR UPPER(customer_id) LIKE :search)")
        params["search"] = pattern
    return ("WHERE " + " AND ".join(conditions) if conditions else ""), params


def to_number(text):
    for convert in (int, float):
        try:
            return convert(text)
        except ValueError:
            pass
    return text


def run_info():
    """Rows like ("run.analysis_date", "2026-11-15") become {"run": {"analysis_date": ...}}."""
    info = {}
    for row in db.query("SELECT setting, value FROM cltv_run_info"):
        group, name = row["setting"].split(".", 1)
        info.setdefault(group, {})[name] = to_number(row["value"])
    return info


def transition_dates():
    rows = db.query("""
        SELECT baseline_date AS snapshot_date FROM cltv_segment_transitions
        UNION
        SELECT comparison_date AS snapshot_date FROM cltv_segment_transitions
        ORDER BY snapshot_date""")
    return [row["snapshot_date"] for row in rows]


def health():
    info = run_info()["run"]
    return {
        "status": "ok",
        "database": db.DATABASE_KIND,
        "customers_scored": db.query_one(f"SELECT COUNT(*) AS n FROM {CUSTOMERS}")["n"],
        "sims_scored": db.query_one(f"SELECT COUNT(*) AS n FROM {SIMS}")["n"],
        "scored_as_of": info["analysis_date"],
        "built": info["built"],
    }


def meta():
    info = run_info()
    buckets = db.query("""
        SELECT bucket, sims, actual_recharge_days AS actual, predicted_recharge_days AS predicted
        FROM cltv_backtest
        ORDER BY bucket_order""")
    departments = db.query(f"SELECT DISTINCT department AS name FROM {CUSTOMERS} WHERE over_sim_limit = 0 ORDER BY department")

    return {
        "run": info["run"],
        "model": info["model"],
        "quality": info["quality"],
        "backtest": {**info["backtest"], "buckets": buckets},
        "lists": {
            "departments": [row["name"] for row in departments],
            "segments": SEGMENTS,
            "tiers": TIERS,
            "recency_bands": RECENCY_BANDS,
            "tenure_bands": TENURE_BANDS,
        },
        "transition_dates": transition_dates(),
    }


def group_stats(column, filters, skip=None, all_names=None):
    """all_names: return exactly these groups in this order, with zeros for empty ones."""
    clause, params = where_customers(filters, skip)
    rows = db.query(f"""
        SELECT {column}            AS name,
               COUNT(*)            AS customers,
               SUM(sims_scored)    AS sims,
               SUM(cltv_12m)       AS total_value,
               AVG(cltv_12m)       AS average_value,
               AVG(p_active)       AS average_p_active,
               SUM(value_at_risk)  AS value_at_risk
        FROM {CUSTOMERS}
        {clause}
        GROUP BY {column}""", params)

    if all_names is not None:
        found = {row["name"]: row for row in rows}
        empty = {"customers": 0, "sims": 0, "total_value": 0.0, "average_value": 0.0,
                 "average_p_active": 0.0, "value_at_risk": 0.0}
        rows = [found.get(name, {"name": name, **empty}) for name in all_names]

    all_customers = sum(row["customers"] for row in rows)
    all_value = sum(row["total_value"] for row in rows)
    all_risk = sum(row["value_at_risk"] for row in rows)
    for row in rows:
        row["customers_share"] = share(row["customers"], all_customers)
        row["value_share"] = share(row["total_value"], all_value)
        row["value_at_risk_share"] = share(row["value_at_risk"], all_risk)
    return rows


def overview(filters):
    clause, params = where_customers(filters)

    risk_keys = [f"risk_{i}" for i in range(len(RISK_SEGMENTS))]
    kpis = db.query_one(f"""
        SELECT COUNT(*)                                                        AS customers,
               COALESCE(SUM(sims_scored), 0)                                   AS sims,
               COALESCE(SUM(CASE WHEN sims_registered > 1 THEN 1 ELSE 0 END), 0) AS multi_sim_customers,
               COALESCE(SUM(CASE WHEN lapsed_sims > 0
                                  AND segment NOT IN ({', '.join(':' + key for key in risk_keys)})
                                 THEN 1 ELSE 0 END), 0)                        AS customers_with_lapsed_sim,
               COALESCE(SUM(cltv_12m), 0)                                      AS total_value,
               COALESCE(SUM(monetary), 0)                                      AS total_monetary,
               COALESCE(SUM(value_at_risk), 0)                                 AS value_at_risk,
               COALESCE(SUM(CASE WHEN p_active >= :alive_threshold THEN 1 ELSE 0 END), 0) AS likely_active_customers
        FROM {CUSTOMERS}
        {clause}""", {**params, **dict(zip(risk_keys, RISK_SEGMENTS)), "alive_threshold": cfg.ALIVE_THRESHOLD})

    counts = db.query_one(f"""
        SELECT COALESCE(SUM(CASE WHEN over_sim_limit = 0 THEN 1 ELSE 0 END), 0) AS all_customers,
               COALESCE(SUM(CASE WHEN over_sim_limit = 1 THEN 1 ELSE 0 END), 0) AS accounts_over_sim_limit
        FROM {CUSTOMERS}""")
    kpis.update(counts)
    kpis["average_value"] = share(kpis["total_value"], kpis["customers"])
    kpis["likely_active_share"] = share(kpis["likely_active_customers"], kpis["customers"])

    deciles = db.query(f"""
        SELECT decile, SUM(cltv_12m) AS total_value
        FROM (
            SELECT cltv_12m, NTILE(10) OVER (ORDER BY cltv_12m DESC, customer_id) AS decile
            FROM {CUSTOMERS}
            {clause}
        ) ranked
        GROUP BY decile
        ORDER BY decile""", params)
    for row in deciles:
        row["value_share"] = share(row["total_value"], kpis["total_value"])

    by_department = group_stats("department", filters, skip="department")
    by_department.sort(key=lambda row: row["average_value"], reverse=True)

    return {
        "kpis": kpis,
        "deciles": deciles,
        "by_segment": group_stats("segment", filters, skip="segment", all_names=SEGMENTS),
        "by_department": by_department,
        "by_recency": group_stats("recency_band", filters, all_names=RECENCY_BANDS),
        "by_tenure": group_stats("tenure_band", filters, all_names=TENURE_BANDS),
    }


def transitions(baseline, comparison):
    """Returns None if the pair of dates is not stored."""
    rows = db.query("""
        SELECT baseline_segment, comparison_segment, customers
        FROM cltv_segment_transitions
        WHERE baseline_date = :baseline AND comparison_date = :comparison""",
        {"baseline": baseline, "comparison": comparison})
    if not rows:
        return None

    counts = {(row["baseline_segment"], row["comparison_segment"]): row["customers"] for row in rows}
    matrix = [[counts.get((r, c), 0) for c in TRANSITION_COLS] for r in TRANSITION_ROWS]
    row_totals = [sum(row) for row in matrix]
    row_shares = [[share(cell, total) for cell in row] for row, total in zip(matrix, row_totals)]

    # "segmented" excludes the last row (new customers).
    moved = lambda from_names, to_names: sum(counts.get((r, c), 0) for r in from_names for c in to_names)
    segmented = sum(row_totals[:len(SEGMENTS)])
    stayed = sum(counts.get((name, name), 0) for name in SEGMENTS)
    top_at_baseline = row_totals[0]
    top_kept = counts.get((TOP_SEGMENT, TOP_SEGMENT), 0)

    return {
        "baseline": baseline, "comparison": comparison,
        "rows": TRANSITION_ROWS, "cols": TRANSITION_COLS,
        "matrix": matrix, "row_totals": row_totals, "row_shares": row_shares,
        "summary": {
            "segmented_at_baseline": segmented,
            "stayed": stayed,
            "stayed_share": share(stayed, segmented),
            "top_segment": TOP_SEGMENT,
            "top_segment_at_baseline": top_at_baseline,
            "top_segment_kept": top_kept,
            "top_segment_kept_share": share(top_kept, top_at_baseline),
            "slipped_into_risk": moved(HEALTHY_SEGMENTS, RISK_SEGMENTS + [DISCONNECTED]),
            "disconnected": moved(SEGMENTS, [DISCONNECTED]),
            "new_since_baseline": row_totals[-1],
        },
    }


def as_customer(row):
    row["contact_msisdn_key"] = str(row["contact_msisdn_key"])
    row["over_sim_limit"] = bool(row["over_sim_limit"])
    return row


def customers(filters, search, sort, descending, page, page_size, over_sim_limit=False):
    if sort not in CUSTOMER_COLUMNS:  # only known column names reach the SQL
        sort = "cltv_12m"
    clause, params = where_customers(filters, search=search, over_sim_limit=over_sim_limit)

    totals = db.query_one(f"""
        SELECT COUNT(*) AS total, COALESCE(SUM(sims_scored), 0) AS sims,
               COALESCE(MAX(cltv_12m), 0) AS highest_value
        FROM {CUSTOMERS}
        {clause}""", params)
    rows = db.query(f"""
        SELECT {', '.join(CUSTOMER_COLUMNS)}
        FROM {CUSTOMERS}
        {clause}
        ORDER BY {sort} {'DESC' if descending else 'ASC'}, customer_id
        LIMIT :limit OFFSET :offset""",
        {**params, "limit": page_size, "offset": page * page_size})

    return {
        "total": totals["total"],
        "sims": totals["sims"],
        "page": page,
        "page_size": page_size,
        "pages": pages_needed(totals["total"], page_size),
        "highest_value": totals["highest_value"],
        "rows": [as_customer(row) for row in rows],
    }


def customers_export(filters, search, over_sim_limit=False):
    clause, params = where_customers(filters, search=search, over_sim_limit=over_sim_limit)
    yield CUSTOMER_COLUMNS
    yield from db.stream(f"""
        SELECT {', '.join(CUSTOMER_COLUMNS)}
        FROM {CUSTOMERS}
        {clause}
        ORDER BY cltv_12m DESC, customer_id
        LIMIT :limit""", {**params, "limit": cfg.EXPORT_ROW_LIMIT})


def customer(customer_id):
    found = db.query(f"""
        SELECT {', '.join(CUSTOMER_COLUMNS)}
        FROM {CUSTOMERS}
        WHERE customer_id = :customer_id""", {"customer_id": customer_id})
    if not found:
        return None

    sims = db.query(f"""
        SELECT {', '.join(SIM_COLUMNS)}
        FROM {SIMS}
        WHERE customer_id = :customer_id
        ORDER BY cltv_12m DESC, msisdn_key""", {"customer_id": customer_id})

    held = [sim["segment"] for sim in sims]
    sims_by_segment = {name: held.count(name) for name in SEGMENTS if name in held}

    return {"customer": as_customer(found[0]), "sims": [as_subscriber(sim) for sim in sims],
            "sims_by_segment": sims_by_segment}


def as_subscriber(row):
    row["msisdn_key"] = str(row["msisdn_key"])
    return row


def subscribers(filters, search, sort, descending, page, page_size):
    if sort not in SIM_COLUMNS:  # only known column names reach the SQL
        sort = "cltv_12m"
    clause, params = where_sims(filters, search=search)

    totals = db.query_one(f"""
        SELECT COUNT(*) AS total, COUNT(DISTINCT customer_id) AS customers,
               COALESCE(MAX(cltv_12m), 0) AS highest_value
        FROM {SIMS}
        {clause}""", params)
    rows = db.query(f"""
        SELECT {', '.join(SIM_COLUMNS)}
        FROM {SIMS}
        {clause}
        ORDER BY {sort} {'DESC' if descending else 'ASC'}, msisdn_key
        LIMIT :limit OFFSET :offset""",
        {**params, "limit": page_size, "offset": page * page_size})

    return {
        "total": totals["total"],
        "customers": totals["customers"],
        "page": page,
        "page_size": page_size,
        "pages": pages_needed(totals["total"], page_size),
        "highest_value": totals["highest_value"],
        "rows": [as_subscriber(row) for row in rows],
    }


def subscribers_export(filters, search):
    clause, params = where_sims(filters, search=search)
    yield SIM_COLUMNS
    yield from db.stream(f"""
        SELECT {', '.join(SIM_COLUMNS)}
        FROM {SIMS}
        {clause}
        ORDER BY cltv_12m DESC, msisdn_key
        LIMIT :limit""", {**params, "limit": cfg.EXPORT_ROW_LIMIT})
