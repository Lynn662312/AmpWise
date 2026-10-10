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

MYT = timezone(timedelta(hours=8))
START = datetime(2026, 3, 16, tzinfo=MYT)
DAYS = 21
FESTIVE_START = datetime(2026, 3, 27, tzinfo=MYT)
FESTIVE_END = datetime(2026, 3, 30, 23, 30, tzinfo=MYT)
FESTIVE_MULTIPLIER = 1.7

PARAMS = {"avg_charge_min": 38, "rm_per_session": 35.0, "max_tolerable_wait_min": 45}

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
            })
    return pd.DataFrame(rows)


def _health(rng: random.Random) -> pd.DataFrame:
    rows = []
    for station in STATIONS:
        for n in range(1, station["n_chargers"] + 1):
            charger_id = f"{station['station_id']}_c{n}"
            fault = FAULTS.get(charger_id)
            for d in range(DAYS):
                day = START.date() + timedelta(days=d)
                row = {
                    "charger_id": charger_id, "station_id": station["station_id"], "date": day,
                    "power_ratio": round(rng.uniform(0.92, 0.97), 2), "baseline": 0.94,
                    "status": "healthy", "p_fault": 0.03, "evidence": ["Power and session success normal"],
                }
                if fault and day >= fault[1]:
                    row.update(status=fault[0], power_ratio=fault[2], p_fault=fault[3], evidence=fault[4])
                rows.append(row)
    return pd.DataFrame(rows)


def write_dummy_data(out_dir: str) -> None:
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    rng = random.Random(42)

    pd.DataFrame(STATIONS).drop(columns="load").to_parquet(out / "stations.parquet", index=False)
    _forecasts(rng).to_parquet(out / "forecasts.parquet", index=False)
    _health(rng).to_parquet(out / "health.parquet", index=False)
    pd.DataFrame(
        [{"charger_id": c, "fault_type": f[0], "start_date": f[1]} for c, f in FAULTS.items()]
    ).to_parquet(out / "fault_labels.parquet", index=False)
    (out / "params.json").write_text(json.dumps(PARAMS, indent=2), encoding="utf-8")


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else get_settings().data_dir
    write_dummy_data(target)
    print(f"Dummy data written to {Path(target).resolve()}")
