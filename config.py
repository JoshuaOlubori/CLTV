import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent

# PostgreSQL (postgresql://user:password@host:5432/dbname) via CLTV_DATABASE_URL,
# otherwise the local SQLite file.
DATABASE_URL = os.environ.get("CLTV_DATABASE_URL", f"sqlite:///{ROOT / 'data' / 'cltv_local.db'}")

# Maximum rows in /api/customers.csv and /api/subscribers.csv.
EXPORT_ROW_LIMIT = 200_000

# CORS: comma-separated origins of the deployed dashboard, no trailing slash,
# e.g. CLTV_ALLOWED_ORIGINS=https://dashboard.example.com
ALLOWED_ORIGINS = [origin.strip() for origin in os.environ.get("CLTV_ALLOWED_ORIGINS", "").split(",") if origin.strip()]

# Allow http://localhost:<any port>. Set CLTV_ALLOW_LOCAL_PAGES=0 to turn off.
ALLOW_LOCAL_PAGES = os.environ.get("CLTV_ALLOW_LOCAL_PAGES", "1") != "0"

CURRENCY = "XOF"
MARGIN = 0.8                  # share of recharge spend counted as value
ANNUAL_DISCOUNT_RATE = 0.10
CLTV_MONTHS = 12
ALIVE_THRESHOLD = 0.50        # "likely active" at or above this probability

# (first day of band, label, R score)
RECENCY_BANDS = [
    (0,  "0-14 days",  5),
    (15, "15-30 days", 4),
    (31, "31-60 days", 3),
    (61, "61-90 days", 2),
    (91, "90+ days",   1),
]

# (segment, (min R, max R), (min F, max F), (min M, max M)). First match wins.
ANY = (1, 5)
SEGMENT_RULES = [
    ("Champions",          (4, 5), (4, 5), (4, 5)),
    ("Loyal",              (4, 5), (4, 5), (1, 3)),
    ("Potential loyalist", (4, 5), (1, 3), ANY),
    ("Needs attention",    (3, 3), ANY,    ANY),
    ("At risk",            (1, 2), (3, 5), ANY),
    ("Churned",            (1, 2), (1, 2), ANY),
]

# (tier, cumulative share of customers by rank)
TIERS = [("Platinum", 0.10), ("Gold", 0.30), ("Silver", 0.60), ("Bronze", 1.00)]

# (first day of band, label)
TENURE_BANDS = [(0, "Under 3 months"), (90, "3-12 months"), (365, "1-3 years"),
                (1095, "3-5 years"), (1825, "5+ years")]

# Accounts with more SIMs than this are agents or resellers.
MAX_SIMS_PER_PERSON = 5
OVER_LIMIT_SEGMENT = "Agent or reseller"
OVER_LIMIT_TIER = "Unranked"
