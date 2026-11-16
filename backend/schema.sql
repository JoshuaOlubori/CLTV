DROP TABLE IF EXISTS cltv_line_scores;
DROP TABLE IF EXISTS cltv_customer_scores;
DROP TABLE IF EXISTS cltv_segment_transitions;
DROP TABLE IF EXISTS cltv_backtest;
DROP TABLE IF EXISTS cltv_run_info;

CREATE TABLE cltv_customer_scores (
    customer_id             TEXT PRIMARY KEY,     -- hashed national ID
    sims_scored             INTEGER NOT NULL,     -- their SIMs that are scored (connected, with a recharge)
    sims_registered         INTEGER NOT NULL,     -- SIMs registered to them, scored or not
    lapsed_sims             INTEGER NOT NULL,     -- their scored SIMs whose own segment is a risk segment
    over_sim_limit          INTEGER NOT NULL,     -- 1 = more SIMs than allowed for a person: agent or reseller
    department              TEXT NOT NULL,        -- department of their most valuable SIM
    segment                 TEXT NOT NULL,        -- from the customer's combined R, F, M ('Agent or reseller' if over the limit)
    cltv_tier               TEXT NOT NULL,        -- Platinum / Gold / Silver / Bronze by customer value ('Unranked' if over the limit)
    cltv_decile             INTEGER NOT NULL,     -- 1 = most valuable 10 % of customers (0 if over the limit)
    r_score                 INTEGER NOT NULL,     -- 1-5 from the recency band (0 if over the limit)
    f_score                 INTEGER NOT NULL,     -- 1-5 quintile of recharge_days (0 if over the limit)
    m_score                 INTEGER NOT NULL,     -- 1-5 quintile of monetary (0 if over the limit)
    days_since_last         INTEGER NOT NULL,     -- RECENCY: analysis date - last recharge on any of their SIMs
    recency_band            TEXT NOT NULL,        -- 0-14 days ... 90+ days
    tenure_months           INTEGER NOT NULL,     -- months since their oldest scored SIM was activated
    tenure_band             TEXT NOT NULL,
    recharge_days           INTEGER NOT NULL,     -- FREQUENCY: days on which any of their SIMs recharged
    monetary                DOUBLE PRECISION NOT NULL,   -- MONETARY: margin x spend across their SIMs
    p_active                DOUBLE PRECISION NOT NULL,   -- probability at least one SIM is still active
    cltv_12m                DOUBLE PRECISION NOT NULL,   -- sum of their SIMs' 12-month value
    value_at_risk           DOUBLE PRECISION NOT NULL,   -- sum of their SIMs' value at risk
    contact_msisdn_key      BIGINT NOT NULL              -- their most valuable SIM: the one to contact
);
CREATE INDEX idx_customer_segment    ON cltv_customer_scores (segment);
CREATE INDEX idx_customer_department ON cltv_customer_scores (department);
CREATE INDEX idx_customer_tier       ON cltv_customer_scores (cltv_tier);
CREATE INDEX idx_customer_cltv       ON cltv_customer_scores (cltv_12m);

CREATE TABLE cltv_line_scores (
    msisdn_key              BIGINT PRIMARY KEY,   -- surrogate MSISDN key from the feeds
    customer_id             TEXT NOT NULL,        -- the customer this SIM belongs to
    customer_sims           INTEGER NOT NULL,     -- SIMs registered to that customer
    department              TEXT NOT NULL,
    service_class_id        TEXT,
    segment                 TEXT NOT NULL,        -- from this SIM's own R, F, M
    cltv_tier               TEXT NOT NULL,        -- Platinum / Gold / Silver / Bronze among SIMs
    cltv_decile             INTEGER NOT NULL,     -- 1 = most valuable 10 % of SIMs
    r_score                 INTEGER NOT NULL,     -- 1-5, from the recency band
    f_score                 INTEGER NOT NULL,     -- 1-5, quintile of recharge_days
    m_score                 INTEGER NOT NULL,     -- 1-5, quintile of monetary
    days_since_last         INTEGER NOT NULL,     -- RECENCY: analysis date - this SIM's last recharge
    recency_band            TEXT NOT NULL,
    tenure_months           INTEGER NOT NULL,     -- months since line activation
    tenure_band             TEXT NOT NULL,
    recharge_days           INTEGER NOT NULL,     -- FREQUENCY: days with at least one recharge
    monetary                DOUBLE PRECISION NOT NULL,   -- MONETARY: margin x this SIM's spend
    t_days_observed         INTEGER NOT NULL,     -- model clock: days since first recharge in window
    exp_avg_value           DOUBLE PRECISION NOT NULL,   -- expected spend per recharge-day
    p_alive                 DOUBLE PRECISION NOT NULL,   -- probability the SIM is still active
    exp_recharge_days_90d   DOUBLE PRECISION NOT NULL,
    cltv_12m                DOUBLE PRECISION NOT NULL,   -- discounted 12-month value
    value_at_risk           DOUBLE PRECISION NOT NULL
);
CREATE INDEX idx_line_customer   ON cltv_line_scores (customer_id);
CREATE INDEX idx_line_segment    ON cltv_line_scores (segment);
CREATE INDEX idx_line_department ON cltv_line_scores (department);
CREATE INDEX idx_line_cltv       ON cltv_line_scores (cltv_12m);

CREATE TABLE cltv_segment_transitions (
    baseline_date           TEXT NOT NULL,        -- YYYY-MM-DD
    comparison_date         TEXT NOT NULL,        -- YYYY-MM-DD
    baseline_segment        TEXT NOT NULL,
    comparison_segment      TEXT NOT NULL,
    customers               INTEGER NOT NULL,
    PRIMARY KEY (baseline_date, comparison_date, baseline_segment, comparison_segment)
);

CREATE TABLE cltv_backtest (
    bucket_order            INTEGER PRIMARY KEY,
    bucket                  TEXT NOT NULL,        -- repeat recharge-days before the holdout
    sims                    INTEGER NOT NULL,
    actual_recharge_days    DOUBLE PRECISION NOT NULL,
    predicted_recharge_days DOUBLE PRECISION NOT NULL
);

CREATE TABLE cltv_run_info (
    setting                 TEXT PRIMARY KEY,     -- e.g. run.analysis_date, model.bgnbd_r
    value                   TEXT NOT NULL
);
