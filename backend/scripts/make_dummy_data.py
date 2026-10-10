"""Writes dummy ML files with the columns in docs/api_contract.md section 5.

Run from backend/:  python -m scripts.make_dummy_data
Stands in for the Colab outputs until ML delivers the real files.
"""

import json
import math
import random
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import pandas as pd

from app.core.config import get_settings
from app.utils import mock_data

MYT = timezone(timedelta(hours=8))
START = datetime(2026, 3, 16, tzinfo=MYT)
DAYS = 21
FESTIVE_START = datetime(2026, 3, 27, tzinfo=MYT)
FESTIVE_END = datetime(2026, 3, 30, 23, 30, tzinfo=MYT)
FESTIVE_MULTIPLIER = 1.7

PARAMS = {"avg_charge_min": 38, "rm_per_session": 35.0, "max_tolerable_wait_min": 45}
META = {
    "corridor_name": mock_data.META["corridor_name"],
    "currency": "RM",
    "festive_periods": mock_data.META["festive_periods"],
    "demo_times": mock_data.META["demo_times"],
}

# "load" = share of capacity used at the normal daily peak.
STATIONS = [
    {"station_id": "stn_001", "name": "Dengkil R&R", "lat": 2.86, "lon": 101.68, "n_chargers": 6, "power_kw": 120, "load": 0.15},
    {"station_id": "stn_002", "name": "Nilai R&R", "lat": 2.815, "lon": 101.80, "n_chargers": 4, "power_kw": 60, "load": 0.5},
    {"station_id": "stn_003", "name": "Seremban R&R", "lat": 2.725, "lon": 101.94, "n_chargers": 4, "power_kw": 60, "load": 0.5},
    {"station_id": "stn_004", "name": "Tapah R&R", "lat": 4.19, "lon": 101.26, "n_chargers": 2, "power_kw": 60, "load": 1.05},
    {"station_id": "stn_005", "name": "Sungai Perak R&R", "lat": 4.78, "lon": 100.95, "n_chargers": 4, "power_kw": 120, "load": 0.5},
]

# charger_id -> (status, first faulty day, power ratio, p_fault, evidence)
FAULTS = {
    "stn_003_c1": ("degraded", date(2026, 3, 23), 0.41, 0.86,
                   ["Power at 41% of 7-day median for 4 sessions", "Session success rate 92% (normal)"]),
    "stn_002_c2": ("connector_fault", date(2026, 3, 25), 0.90, 0.78,
                   ["Session success rate 55% over the last 20 sessions", "Many sessions shorter than 2 minutes"]),
    "stn_005_c1": ("safety_fault", date(2026, 3, 24), 0.70, 0.93,
                   ["Cable temperature rising across the last 6 sessions"]),
}


REPAIR_AFTER_DAYS = 3  # what "really happened": each fault was repaired three days after it started

# A charger that really broke on this day but whose sensors show nothing; only drivers noticed.
UNDETECTED = {"stn_002_c4": date(2026, 3, 24)}

# charger_id -> when drivers reported it (day in March 2026, hour)
REPORTS = {
    "stn_003_c1": [(25, 10), (25, 15), (26, 9)],  # sensors also flag it
    "stn_005_c1": [(26, 11)],
    "stn_002_c2": [(27, 8), (27, 12)],
    "stn_002_c4": [(25, 9), (25, 18), (26, 8)],  # reports only
    "stn_001_c3": [(20, 13)],  # one report on a healthy charger: not enough for an action
}

# charger_id -> when drivers reported its bay as blocked or dirty (a technician cannot fix that)
SITE_REPORTS = {"stn_001_c2": [(25, 9), (26, 10)]}


def report_rows(reports: dict[str, list[tuple[int, int]]], issue_type: str) -> pd.DataFrame:
    """user_reports.parquet: one row per driver report."""
    return pd.DataFrame([
        {"charger_id": charger_id, "reported_at": datetime(2026, 3, day, hour, tzinfo=MYT), "issue_type": issue_type}
        for charger_id, times in reports.items() for day, hour in times
    ])


def _daily_shape(hour: float) -> float:
    """0-1 demand curve with one peak around 3pm."""
    return 0.15 + 0.85 * math.exp(-(((hour - 15) / 4) ** 2))


def _forecasts(rng: random.Random) -> pd.DataFrame:
    rows = []
    for station in STATIONS:
        peak_arrivals = station["load"] * station["n_chargers"] * 30 / PARAMS["avg_charge_min"]
        for i in range(DAYS * 48):
            slot = START + timedelta(minutes=30 * i)
            baseline = peak_arrivals * _daily_shape(slot.hour + slot.minute / 60)
            is_festive = FESTIVE_START <= slot <= FESTIVE_END
            arrivals = baseline * (FESTIVE_MULTIPLIER if is_festive else 1.0) * rng.uniform(0.95, 1.05)
            rows.append({
                "station_id": station["station_id"], "slot_start": slot,
                "arrivals": round(arrivals, 2), "arrivals_baseline": round(baseline, 2),
                "is_festive": is_festive,
                # What "really happened": the forecast with some error, for the backtest.
                "arrivals_actual": round(arrivals * rng.uniform(0.85, 1.15), 2),
            })
    return pd.DataFrame(rows)


def health_rows(stations: list[dict], first_day: date, days: int, faults: dict, rng: random.Random) -> pd.DataFrame:
    """One row per charger per day; chargers in `faults` switch status on their fault date."""
    rows = []
    for station in stations:
        for n in range(1, station["n_chargers"] + 1):
            charger_id = f"{station['station_id']}_c{n}"
            fault = faults.get(charger_id)
            for d in range(days):
                day = first_day + timedelta(days=d)
                row = {
                    "charger_id": charger_id, "station_id": station["station_id"], "date": day,
                    "power_ratio": round(rng.uniform(0.92, 0.97), 2), "baseline": 0.94,
                    "status": "healthy", "p_fault": 0.03, "evidence": ["Power and session success normal"],
                }
                if fault and day >= fault[1]:
                    row.update(status=fault[0], power_ratio=fault[2], p_fault=fault[3], evidence=fault[4])
                rows.append(row)
    return pd.DataFrame(rows)


def fault_labels(faults: dict) -> pd.DataFrame:
    """fault_labels.parquet: the real faults, each repaired REPAIR_AFTER_DAYS after it started."""
    return pd.DataFrame([
        {"charger_id": c, "fault_type": f[0], "start_date": f[1], "end_date": f[1] + timedelta(days=REPAIR_AFTER_DAYS)}
        for c, f in faults.items()
    ])


def write_dummy_data(out_dir: str) -> None:
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    rng = random.Random(42)

    pd.DataFrame(STATIONS).drop(columns="load").to_parquet(out / "stations.parquet", index=False)
    _forecasts(rng).to_parquet(out / "forecasts.parquet", index=False)
    health_rows(STATIONS, START.date(), DAYS, FAULTS, rng).to_parquet(out / "health.parquet", index=False)
    undetected = {charger_id: ("undetected", day) for charger_id, day in UNDETECTED.items()}
    fault_labels({**FAULTS, **undetected}).to_parquet(out / "fault_labels.parquet", index=False)
    reports = pd.concat([report_rows(REPORTS, "user_reported"), report_rows(SITE_REPORTS, "site_issue")])
    reports.to_parquet(out / "user_reports.parquet", index=False)
    (out / "params.json").write_text(json.dumps(PARAMS, indent=2), encoding="utf-8")
    (out / "report_categories.json").write_text(json.dumps(mock_data.REPORT_CATEGORIES, indent=2), encoding="utf-8")
    (out / "meta.json").write_text(json.dumps(META, indent=2, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else get_settings().data_dir
    write_dummy_data(target)
    print(f"Dummy data written to {Path(target).resolve()}")
