from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import config as cfg
from backend.api import router

DESCRIPTION = """
Feeds the Subscriber CLTV dashboard: predicted 12-month value, activity and
segments for every customer, and how customers move between segments over time.

**Two levels.** Scores are worked out for each SIM, then added up to the
customer who holds them. The overview, the customer list and the transitions
count **customers**; open a customer to see each of their SIMs.

A screen-by-screen guide with worked examples is in `docs/API_GUIDE.md`.

**Conventions**

* Money is in the run's currency (`/api/meta` → `run.currency`).
* A *share* or a probability is a fraction between 0 and 1 (0.74 means 74 %).
* Dates are text in the form `YYYY-MM-DD`.
* Names of segments, tiers and bands are always returned in English. Treat them
  as fixed keys and translate them for display.
* Filters are repeatable query parameters: `?segment=At risk&segment=Churned&tier=Gold`
  keeps SIMs that are (At risk **or** Churned) **and** Gold. Leave a filter out to not filter on it.
* Errors come back as `{"detail": "what went wrong"}`.

"""

TAGS = [
    {"name": "System", "description": "Health check and the fixed facts about the current run."},
    {"name": "Overview", "description": "The figures behind the Overview page, counted in customers."},
    {"name": "Transitions", "description": "Movement of customers between segments from one snapshot date to another."},
    {"name": "Customers", "description": "The customer list, its CSV download, and the drill-down into one customer's SIMs."},
    {"name": "SIMs", "description": "Every scored SIM, one row each, and its CSV download."},
]

# Any page served from localhost, on any port (e.g. http://localhost:5173).
LOCAL_PAGES = r"^http://(localhost|127\.0\.0\.1)(:\d+)?$"

app = FastAPI(title="Subscriber CLTV API", version="2.0.0", description=DESCRIPTION,
              openapi_tags=TAGS)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cfg.ALLOWED_ORIGINS,
    allow_origin_regex=LOCAL_PAGES if cfg.ALLOW_LOCAL_PAGES else None,
    allow_methods=["GET"],
    allow_headers=["Content-Type"],
    expose_headers=["Content-Disposition"],
)

app.include_router(router)


@app.exception_handler(RequestValidationError)
async def explain_bad_input(request, error):
    problems = []
    for problem in error.errors():
        where = ".".join(str(part) for part in problem["loc"][1:]) or str(problem["loc"][0])
        problems.append(f"{where}: {problem['msg']}")
    return JSONResponse(status_code=422, content={"detail": "; ".join(problems)})
