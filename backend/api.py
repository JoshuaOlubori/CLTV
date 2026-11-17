import csv
import io
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from fastapi.responses import StreamingResponse

from backend import queries, schemas

BAD_INPUT = {422: {"model": schemas.Error, "description": "A parameter is missing, mistyped or not an allowed value."}}
NOT_FOUND = {404: {"model": schemas.Error, "description": "Nothing exists with that identifier."}}
BAD_REQUEST = {400: {"model": schemas.Error, "description": "The request cannot be carried out as asked."}}

router = APIRouter(prefix="/api", responses=BAD_INPUT)


def check_filter_values(filters):
    for name, allowed in queries.ALLOWED_VALUES.items():
        for value in filters.get(name) or []:
            if value not in allowed:
                raise HTTPException(status_code=422, detail=f"Unknown {name} '{value}'. Allowed values: {', '.join(allowed)}.")
    return filters


def chosen_filters(
    department: Annotated[list[str], Query(description="Keep rows in any of these departments. Repeat the parameter for several.")] = [],
    segment: Annotated[list[str], Query(description="Keep rows in any of these segments.")] = [],
    tier: Annotated[list[str], Query(description="Keep rows in any of these value tiers ('Class' on the dashboard).")] = [],
    recency_band: Annotated[list[str], Query(description="Keep rows in any of these recency bands.")] = [],
    tenure_band: Annotated[list[str], Query(description="Keep rows in any of these tenure bands.")] = [],
):
    return check_filter_values({"department": department, "segment": segment, "tier": tier,
                                "recency_band": recency_band, "tenure_band": tenure_band})


Filters = Annotated[dict, Depends(chosen_filters)]
Search = Annotated[str, Query(max_length=60, description="Text matched against the customer ID and the MSISDN key.")]
SnapshotDate = Annotated[str, Query(pattern=schemas.ISO_DATE, description="A date from /api/transitions/dates, as YYYY-MM-DD.")]
Descending = Annotated[bool, Query(description="Largest first when true.")]
PageNumber = Annotated[int, Query(ge=0, description="Page to return; the first page is 0.")]
PageSize = Annotated[int, Query(ge=1, le=200, description="Rows per page.")]
OverSimLimit = Annotated[bool, Query(description="false (default): people. true: agent and reseller accounts only, "
                                                 "which are left out everywhere else.")]

BYTE_ORDER_MARK = "﻿"  # lets Excel read accents in the CSV correctly
CSV_RESPONSE = {200: {"content": {"text/csv": {}}, "description": "A CSV file."}}


def csv_download(rows, filename):
    def lines():
        yield BYTE_ORDER_MARK
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        for row in rows:
            writer.writerow(row)
            yield buffer.getvalue()
            buffer.seek(0)
            buffer.truncate(0)

    return StreamingResponse(lines(), media_type="text/csv",
                             headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@router.get("/health", tags=["System"], response_model=schemas.Health, summary="Is the API up and the data loaded?")
def get_health():
    """Checks that the database answers and reports which scores are loaded. Use it for monitoring."""
    return queries.health()


@router.get("/meta", tags=["System"], response_model=schemas.Meta, summary="Run details and the lists that fill the filters")
def get_meta():
    """Everything that does not change between requests: the analysis date and assumptions, the
    forecast back-test, the allowed values of each filter, and the transition dates.
    The dashboard calls this once when it opens."""
    return queries.meta()


@router.get("/overview", tags=["Overview"], response_model=schemas.Overview, summary="All figures on the Overview page")
def get_overview(filters: Filters):
    """Headline numbers, value concentration, and breakdowns by segment, department,
    recency band and tenure band. **Everything here counts customers**, each with all
    their SIMs taken together. Agent and reseller accounts are left out.

    The segment breakdown ignores the segment filter, and the department breakdown
    ignores the department filter, so every option stays visible while some are selected."""
    return queries.overview(filters)


@router.get("/transitions/dates", tags=["Transitions"], response_model=list[str], summary="Snapshot dates available")
def get_transition_dates():
    """Dates at which every customer was re-segmented, oldest first: recent month ends,
    then the analysis date. Any earlier date can be a baseline and any later one a comparison."""
    return queries.transition_dates()


@router.get("/transitions", tags=["Transitions"], response_model=schemas.Transitions,
            responses={**BAD_REQUEST, **NOT_FOUND}, summary="How customers moved between segments between two dates")
def get_transitions(baseline: SnapshotDate, comparison: SnapshotDate):
    """The transition matrix as counts and as shares of each row, with headline figures.

    Counts customers, including those since disconnected, so the filters do not apply here."""
    if baseline >= comparison:
        raise HTTPException(status_code=400, detail="The comparison date must be after the baseline date.")
    result = queries.transitions(baseline, comparison)
    if result is None:
        raise HTTPException(status_code=404, detail="No transitions are stored for that pair of dates. See /api/transitions/dates.")
    return result


@router.get("/customers", tags=["Customers"], response_model=schemas.CustomerPage, summary="One page of the customer list")
def get_customers(
    filters: Filters,
    search: Search = "",
    sort: Annotated[schemas.CustomerSort, Query(description="Column to sort by.")] = schemas.CustomerSort.cltv_12m,
    descending: Descending = True,
    page: PageNumber = 0,
    page_size: PageSize = 20,
    over_sim_limit: OverSimLimit = False,
):
    """The main list: one row per customer, with their SIMs taken together.
    Open a row with `/api/customers/{customer_id}` to see each SIM.

    The search text matches the customer ID, or the MSISDN key of any of the customer's SIMs.
    Filtering, searching, sorting and paging all happen in the database."""
    return queries.customers(filters, search, sort.value, descending, page, page_size, over_sim_limit)


@router.get("/customers.csv", tags=["Customers"], responses=CSV_RESPONSE, response_class=StreamingResponse,
            summary="The filtered customer list as a CSV file")
def download_customers(filters: Filters, search: Search = "", over_sim_limit: OverSimLimit = False):
    """Same filters and search as /api/customers, most valuable customers first."""
    return csv_download(queries.customers_export(filters, search, over_sim_limit), "cltv_customer_list.csv")


@router.get("/customers/{customer_id}", tags=["Customers"], response_model=schemas.CustomerDetail,
            responses=NOT_FOUND, summary="One customer and each of their SIMs (the drill-down)")
def get_customer(customer_id: Annotated[str, Path(max_length=40, description="Customer ID, e.g. CE6D2694CC2.")]):
    """The customer's combined figures, then every scored SIM with its own segment,
    class, value and probability of being active, and a count of SIMs per segment."""
    result = queries.customer(customer_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"No customer with ID '{customer_id}'.")
    return result


@router.get("/subscribers", tags=["SIMs"], response_model=schemas.SubscriberPage, summary="One page of the SIM list")
def get_subscribers(
    filters: Filters,
    search: Search = "",
    sort: Annotated[schemas.SortColumn, Query(description="Column to sort by.")] = schemas.SortColumn.cltv_12m,
    descending: Descending = True,
    page: PageNumber = 0,
    page_size: PageSize = 20,
):
    """Every scored SIM, one row each, whoever it belongs to. Here the filters test the
    SIM's own segment and class, which may differ from its customer's."""
    return queries.subscribers(filters, search, sort.value, descending, page, page_size)


@router.get("/subscribers.csv", tags=["SIMs"], responses=CSV_RESPONSE, response_class=StreamingResponse,
            summary="The filtered SIM list as a CSV file")
def download_subscribers(filters: Filters, search: Search = ""):
    """Same filters and search as /api/subscribers, most valuable SIMs first."""
    return csv_download(queries.subscribers_export(filters, search), "cltv_sim_list.csv")


for download in (download_customers, download_subscribers):
    download.__doc__ += " " + schemas.EXPORT_LIMIT_NOTE