"""Turns ML's exports into the files the backend reads.

ML's files live in ml/output/ (pushed to main by the ML team):
    model1_test_predictions.csv, station_profile.csv
1. Run from backend/:   python -m scripts.convert_ml_outputs
2. Check the result:    python -m scripts.check_data

ML's own column names are read as they are; the renaming to the contract's names happens here.
Everything marked PLACEHOLDER is a guess to be replaced when the team decides.
"""

import json
import random
import sys
from datetime import date, timedelta
from pathlib import Path

import pandas as pd

from app.core.config import get_settings
from scripts.make_dummy_data import FAULTS, fault_labels, health_rows, report_rows

ML_DIR = "../ml/output"  # where the ML team keeps its exports
LOCAL_TZ = "America/Los_Angeles"  # the ACN stations are in California
CURRENCY = "USD"
NETWORK_NAME = "ACN California (Caltech / JPL)"

# PLACEHOLDER: team assumptions. Charge time comes from ML's station_profile.csv instead.
RM_PER_SESSION = 10.0
MAX_TOLERABLE_WAIT_MIN = 45

# PLACEHOLDER display names and approximate map positions, keyed by ML's "station" value.
# ML's files have no coordinates. A station not listed here keeps its raw name and DEFAULT_POSITION.
DEFAULT_POSITION = {"lat": 34.1377, "lon": -118.1253}
STATION_INFO = {
    "caltech/California_Garage_01": {"name": "Caltech California Garage 01", "lat": 34.1392, "lon": -118.1220},
    "caltech/California_Garage_02": {"name": "Caltech California Garage 02", "lat": 34.1385, "lon": -118.1212},
    "caltech/S_Wilson_Garage_01": {"name": "Caltech South Wilson Garage", "lat": 34.1352, "lon": -118.1285},
    "jpl/Arroyo_Garage_01": {"name": "JPL Arroyo Garage", "lat": 34.2005, "lon": -118.1745},
}

US_HOLIDAYS = {
    date(2019, 12, 25): "Christmas",
    date(2020, 1, 1): "New Year",
    date(2020, 1, 20): "Martin Luther King Jr. Day",
    date(2020, 2, 15): "Presidents' Day weekend",
    date(2020, 2, 17): "Presidents' Day",
}

# PLACEHOLDER until ML 2 delivers health.parquet: the dummy faults, starting this many days in.
PLACEHOLDER_FAULT_DAYS = (20, 22, 21)


def _forecasts(raw: pd.DataFrame, station_ids: dict[str, str]) -> pd.DataFrame:
    """ML's predictions as they are. Holidays are only labelled; no festive multiplier is applied."""
    return pd.DataFrame({
        "station_id": raw["station"].map(station_ids),
        "slot_start": pd.to_datetime(raw["slot_utc"], utc=True).dt.tz_convert(LOCAL_TZ),
        "arrivals": raw["pred"].clip(lower=0).round(2),
        "arrivals_baseline": raw["baseline_last_week"].fillna(0).round(2),
        "is_festive": raw["is_holiday"].astype(bool),  # ML's near_holiday column is not used
        "arrivals_actual": raw["arrivals"],  # what really happened, kept for the backtest
    })


def _stations(profile: pd.DataFrame, station_ids: dict[str, str]) -> list[dict]:
    """Charger count, power and charge time come from ML's station_profile.csv."""
    stations = []
    for row in profile.itertuples():
        stations.append({
            "station_id": station_ids[row.station],
            "name": row.station,
            **DEFAULT_POSITION,
            **STATION_INFO.get(row.station, {}),
            "n_chargers": int(row.n_chargers),
            "power_kw": round(row.rated_kw, 1),
            "avg_charge_min": round(row.mean_charge_min, 1),
        })
    return sorted(stations, key=lambda s: s["station_id"])


def _festive_periods(forecasts: pd.DataFrame) -> list[dict]:
    """Runs of consecutive festive days, named after the US holiday inside them."""
    days = sorted(set(forecasts.loc[forecasts["is_festive"], "slot_start"].dt.date))
    runs: list[list[date]] = []
    for day in days:
        if runs and day - runs[-1][-1] == timedelta(days=1):
            runs[-1].append(day)
        else:
            runs.append([day])
    return [
        {
            "name": next((US_HOLIDAYS[d] for d in run if d in US_HOLIDAYS), "Holiday period"),
            "start": _local(run[0], "00:00"),
            "end": _local(run[-1], "23:30"),
        }
        for run in runs
    ]


def _local(day: date, clock: str) -> str:
    return pd.Timestamp(f"{day} {clock}", tz=LOCAL_TZ).isoformat()


def _report_time(day: date, clock: str) -> pd.Timestamp:
    return pd.Timestamp(f"{day} {clock}", tz=LOCAL_TZ)


def _demo_times(forecasts: pd.DataFrame) -> list[dict]:
    """PLACEHOLDER picks: the busiest day in the data and the Sunday before it, at the busiest hour."""
    busiest_hour = forecasts.groupby(forecasts["slot_start"].dt.hour)["arrivals"].mean().idxmax()
    clock = f"{busiest_hour:02d}:00"
    busiest_day = forecasts.groupby(forecasts["slot_start"].dt.date)["arrivals"].sum().idxmax()
    sunday = busiest_day - timedelta(days=(busiest_day.weekday() + 1) % 7 or 7)
    sunday = max(sunday, forecasts["slot_start"].min().date() + timedelta(days=1))
    return [
        {"label": "Quiet Sunday", "time": _local(sunday, clock)},
        {"label": "Weekday morning rush", "time": _local(busiest_day, clock)},
    ]


def convert(raw_dir: str, out_dir: str) -> None:
    raw_path, out = Path(raw_dir), Path(out_dir)
    if not (raw_path / "model1_test_predictions.csv").exists():
        sys.exit(f"ML's files were not found in {raw_path.resolve()}. Merge main to get ml/output/.")
    out.mkdir(parents=True, exist_ok=True)
    raw = pd.read_csv(raw_path / "model1_test_predictions.csv")
    profile = pd.read_csv(raw_path / "station_profile.csv")

    station_ids = {name: f"stn_{i:03d}" for i, name in enumerate(sorted(raw["station"].unique()), start=1)}
    forecasts = _forecasts(raw, station_ids)
    stations = _stations(profile, station_ids)
    periods = _festive_periods(forecasts)
    params = {
        # Shown in /api/meta; each station's own charge time is in stations.parquet.
        "avg_charge_min": round(profile["mean_charge_min"].mean(), 1),
        "rm_per_session": RM_PER_SESSION,
        "max_tolerable_wait_min": MAX_TOLERABLE_WAIT_MIN,
    }

    first_day = forecasts["slot_start"].min().date()
    n_days = (forecasts["slot_start"].max().date() - first_day).days + 1
    faults = {
        f"{station['station_id']}_c1": (status, first_day + timedelta(days=offset), ratio, p_fault, evidence)
        for station, offset, (status, _, ratio, p_fault, evidence)
        in zip(stations, PLACEHOLDER_FAULT_DAYS, FAULTS.values())
    }

    # PLACEHOLDER driver reports until ML delivers them: each fault is reported two days after
    # it starts, and one charger with healthy sensors is reported three times.
    undetected = f"{stations[0]['station_id']}_c2"
    undetected_day = first_day + timedelta(days=PLACEHOLDER_FAULT_DAYS[0])
    reports = {c: [_report_time(fault[1] + timedelta(days=2), "10:00")] for c, fault in faults.items()}
    reports[undetected] = [_report_time(undetected_day + timedelta(days=1), clock) for clock in ("09:00", "13:00", "18:00")]

    forecasts.to_parquet(out / "forecasts.parquet", index=False)
    pd.DataFrame(stations).to_parquet(out / "stations.parquet", index=False)
    health_rows(stations, first_day, n_days, faults, random.Random(42)).to_parquet(out / "health.parquet", index=False)
    fault_labels({**faults, undetected: ("undetected", undetected_day)}).to_parquet(out / "fault_labels.parquet", index=False)
    report_rows(reports).to_parquet(out / "user_reports.parquet", index=False)
    (out / "params.json").write_text(json.dumps(params, indent=2), encoding="utf-8")
    meta = {
        "corridor_name": NETWORK_NAME,
        "currency": CURRENCY,
        "festive_periods": periods,
        "demo_times": _demo_times(forecasts),
    }
    (out / "meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")

    print(f"Stations: {station_ids}")
    print(f"Range: {forecasts['slot_start'].min()} to {forecasts['slot_start'].max()}")
    print(f"Demo times: {meta['demo_times']}")
    print(f"Written to {out.resolve()}")


if __name__ == "__main__":
    convert(sys.argv[1] if len(sys.argv) > 1 else ML_DIR, get_settings().data_dir)
