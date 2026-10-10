# AmpWise V2 API Addendum

This file documents the temporary integration additions for the V2 frontend.
It does not replace `docs/api_contract.md`, which remains authoritative.

## `GET /api/overview`

Status: **REPLACED (2026-10-11).** The endpoint now takes `time` and returns real totals from ML's session and energy files, with `data_source: "api"`. Its definition lives in `docs/api_contract.md` (v0.7, section 4). The fixed sample below is returned only in mock mode (`MOCK=1`). The rest of this section is kept as the history of the placeholder.

The route returns deterministic demo values for Overview metrics that are not
available from the current station, action or forecast services.

### Request

No query parameters are required. The response is currently independent of
simulated time. A future implementation may accept `time` only after the
backend defines how session and uptime aggregates are time-scoped.

### Response

```json
{
  "data_source": "placeholder",
  "energy_delivered_kwh": 1284,
  "energy_delivered_week_kwh": 8492,
  "live_sessions": 42,
  "network_uptime_pct": 99.2,
  "energy_trend": [
    { "date": "2019-12-01", "kwh": 1100 }
  ]
}
```

`energy_trend` contains ISO calendar dates and non-negative kWh values. The
temporary fixture is stored in `backend/app/utils/placeholder_data.py` and is
validated by `backend/app/schemas/overview.py`.

### Replacement requirements

Replace the fixture with approved California/US session, energy and network
uptime services. Keep the response fields stable, change `data_source` to the
agreed real-data value, preserve USD metadata conventions, and validate all
dates against the active dataset. Do not derive energy from charger capacity
or fabricate uptime from instantaneous availability.

## Existing API status

All existing v0.5 endpoint paths remain unchanged. Missing action-status,
scenario persistence, demo reset, session and uptime capabilities remain
backend handoff items and are not represented by fake routes in this addendum.
