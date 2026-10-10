"""Turns ML's Colab exports into the files the backend reads.

1. Download from Colab into ml/outputs/raw/:
       model1_test_predictions.csv, model1_metrics.json
2. Run from backend/:   python -m scripts.convert_ml_outputs
3. Check the result:    python -m scripts.check_data

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

LOCAL_TZ = "America/Los_Angeles"  # the ACN stations are in California
CURRENCY = "USD"
NETWORK_NAME = "ACN California (Caltech / JPL)"

# PLACEHOLDER: team assumptions. The backend calculates its own waits from avg_charge_min;
# ML's wait_min columns are not used.
PARAMS = {"avg_charge_min": 38, "rm_per_session": 10.0, "max_tolerable_wait_min": 45}

# PLACEHOLDER station details, keyed by the value in ML's "station" column.
# A station not listed here gets DEFAULT_STATION and its raw name.
DEFAULT_STATION = {"lat": 34.1377, "lon": -118.1253, "n_chargers": 4, "power_kw": 7}
STATION_INFO = {
    "caltech": {"name": "Caltech", "lat": 34.1377, "lon": -118.1253},
    "jpl": {"name": "JPL", "lat": 34.2013, "lon": -118.1714},
    "office_01": {"name": "Office 01", "lat": 37.39, "lon": -122.08},
}

US_HOLIDAYS = {
    date(2019, 12, 25): "Christmas",
    date(2020, 1, 1): "New Year",
    date(2020, 1, 20): "Martin Luther King Jr. Day",
    date(2020, 2, 17): "Presidents' Day",
}

# PLACEHOLDER until ML 2 delivers health.parquet: the dummy faults, starting this many days in.
PLACEHOLDER_FAULT_DAYS = (20, 22, 21)


def _forecasts(raw: pd.DataFrame, station_ids: dict[str, str], multiplier: float) -> pd.DataFrame:
    # Only the public holiday itself is festive; ML's near_holiday column is not used.
    is_festive = raw["is_holiday"].astype(bool)
    # ML's "pred" has no festive effect; the demo multiplies festive slots by the assumed factor.
    forecast = raw["pred"].clip(lower=0) * is_festive.map({True: multiplier, False: 1.0})
    return pd.DataFrame({
        "station_id": raw["station"].map(station_ids),
        "slot_start": pd.to_datetime(raw["slot_utc"], utc=True).dt.tz_convert(LOCAL_TZ),
        "arrivals": forecast.round(2),
        "arrivals_baseline": raw["baseline_last_week"].fillna(0).round(2),
        "is_festive": is_festive,
        # Kept for the backtest: what really happened, and ML's prediction before the multiplier.
        "arrivals_actual": raw["arrivals"],
        "arrivals_model": raw["pred"].clip(lower=0).round(2),
    })


def _stations(station_ids: dict[str, str]) -> list[dict]:
    stations = []
    for raw_name, station_id in station_ids.items():
        info = {"name": raw_name, **DEFAULT_STATION, **STATION_INFO.get(raw_name, {})}
        stations.append({"station_id": station_id, **info})
    return stations


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


def _demo_times(forecasts: pd.DataFrame, periods: list[dict]) -> list[dict]:
    """A normal Tuesday morning, and the morning before the first festive period."""
    first_day = forecasts["slot_start"].min().date() + timedelta(days=1)
    festive_days = set(forecasts.loc[forecasts["is_festive"], "slot_start"].dt.date)
    tuesday = next(
        first_day + timedelta(days=d)
        for d in range(60)
        if (first_day + timedelta(days=d)).weekday() == 1 and first_day + timedelta(days=d) not in festive_days
    )
    demo = [{"label": "Normal Tuesday", "time": _local(tuesday, "09:00")}]
    if periods:
        before = max(pd.Timestamp(periods[0]["start"]).date() - timedelta(days=1), first_day)
        demo.append({"label": f"Day before {periods[0]['name']}", "time": _local(before, "09:00")})
    return demo


def convert(raw_dir: str, out_dir: str) -> None:
    raw_path, out = Path(raw_dir), Path(out_dir)
    if not (raw_path / "model1_test_predictions.csv").exists():
        sys.exit(f"Put model1_test_predictions.csv and model1_metrics.json in {raw_path.resolve()} first")
    raw = pd.read_csv(raw_path / "model1_test_predictions.csv")
    metrics = json.loads((raw_path / "model1_metrics.json").read_text(encoding="utf-8"))

    station_ids = {name: f"stn_{i:03d}" for i, name in enumerate(sorted(raw["station"].unique()), start=1)}
    forecasts = _forecasts(raw, station_ids, metrics.get("festive_multiplier_assumed", 1.0))
    stations = _stations(station_ids)
    periods = _festive_periods(forecasts)

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
    (out / "params.json").write_text(json.dumps(PARAMS, indent=2), encoding="utf-8")
    meta = {
        "corridor_name": NETWORK_NAME,
        "currency": CURRENCY,
        "festive_periods": periods,
        "demo_times": _demo_times(forecasts, periods),
    }
    (out / "meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")

    print(f"Stations: {station_ids}")
    print(f"Range: {forecasts['slot_start'].min()} to {forecasts['slot_start'].max()}")
    print(f"Festive periods: {[p['name'] for p in periods]}")
    print(f"Written to {out.resolve()}")


if __name__ == "__main__":
    target = get_settings().data_dir
    convert(sys.argv[1] if len(sys.argv) > 1 else f"{target}/raw", target)
