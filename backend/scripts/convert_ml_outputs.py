"""Turns ML's exports into the files the backend reads.

ML's files live in ml/output/ (pushed to main by the ML team):
    model1_test_predictions.csv, station_profile.csv     the forecast model
    acn_synth/stations.csv                               the chargers
    acn_synth/ocpp_events.csv                            the sensor log (too large for git: get it from the ML team)
    acn_synth/fault_ground_truth.csv                     the real faults
    acn_synth/feedback_clean.csv                         driver feedback (each row is one report), cleaned by
                                                         ml/src/preprocessing/clean_feedback.py
1. Run from backend/:   python -m scripts.convert_ml_outputs
2. Check the result:    python -m scripts.check_data

ML's own column names are read as they are; the renaming to the contract's names happens here.
Everything marked PLACEHOLDER is a guess to be replaced when the team decides.
"""

import json
import sys
from datetime import date, timedelta
from pathlib import Path

import pandas as pd

from app.core.config import get_settings

ML_DIR = "../ml/output"  # where the ML team keeps its exports
SYNTH_FILES = ("stations.csv", "ocpp_events.csv", "fault_ground_truth.csv", "feedback_clean.csv")
LOCAL_TZ = "America/Los_Angeles"  # the ACN stations are in California
CURRENCY = "USD"
NETWORK_NAME = "ACN California (Caltech / JPL)"

# PLACEHOLDER: team assumptions. Charge time comes from ML's station_profile.csv instead.
RM_PER_SESSION = 10.0
MAX_TOLERABLE_WAIT_MIN = 45

# Display names, keyed by ML's "station" value. A station not listed here keeps its raw name.
STATION_NAMES = {
    "caltech/California_Garage_01": "Caltech California Garage 01",
    "caltech/California_Garage_02": "Caltech California Garage 02",
    "caltech/S_Wilson_Garage_01": "Caltech South Wilson Garage",
    "jpl/Arroyo_Garage_01": "JPL Arroyo Garage",
}

US_HOLIDAYS = {
    date(2019, 12, 25): "Christmas",
    date(2020, 1, 1): "New Year",
    date(2020, 1, 20): "Martin Luther King Jr. Day",
    date(2020, 2, 15): "Presidents' Day weekend",
    date(2020, 2, 17): "Presidents' Day",
}

# The error_code a charger sends with a "Faulted" status -> the contract's charger status.
WORST_FIRST = ["safety_fault", "connector_fault", "degraded"]
FAULT_STATUS = {
    "HighTemperature": "safety_fault",
    "GroundFailure": "safety_fault",
    "OverCurrentFailure": "safety_fault",
    "OverVoltage": "safety_fault",
    "ConnectorLockFailure": "connector_fault",
    "PowerMeterFailure": "degraded",
    "WeakSignal": "degraded",
}
HEALTHY_EVIDENCE = "No fault reported by the charger"

# Which complaints reach the action list, and as which issue type. Only rows the ML cleaning step marked
# keep (negative comment, not spam) are counted. Payment issue is left out here: it is not about the
# charger, so it only shows in the pie chart.
REPORT_CATEGORIES = {
    "Won't start": "user_reported",
    "Slow charging": "user_reported",
    "Cable stuck": "user_reported",
    "Connector damaged": "user_reported",
    "Screen broken": "user_reported",
    "Other": "user_reported",  # what is left after cleaning is about the charger ("keeps flashing red")
    "Blocked by non-EV": "site_issue",  # a technician cannot fix these
    "Cleanliness": "site_issue",
}


def _local_time(column: pd.Series) -> pd.Series:
    """ML's UTC timestamps as California time."""
    return pd.to_datetime(column, utc=True).dt.tz_convert(LOCAL_TZ)


def _forecasts(raw: pd.DataFrame, station_ids: dict[str, str]) -> pd.DataFrame:
    """ML's predictions as they are. Holidays are only labelled; no festive multiplier is applied."""
    return pd.DataFrame({
        "station_id": raw["station"].map(station_ids),
        "slot_start": _local_time(raw["slot_utc"]),
        "arrivals": raw["pred"].clip(lower=0).round(2),
        "arrivals_baseline": raw["baseline_last_week"].fillna(0).round(2),
        "is_festive": raw["is_holiday"].astype(bool),  # ML's near_holiday column is not used
        "arrivals_actual": raw["arrivals"],  # what really happened, kept for the backtest
    })


def _stations(profile: pd.DataFrame, chargers: pd.DataFrame, station_ids: dict[str, str]) -> list[dict]:
    """Charger count, power and charge time come from station_profile.csv; the position from its chargers."""
    position = chargers.groupby("site_path")[["lat", "lon"]].mean().round(4)
    stations = []
    for row in profile.itertuples():
        stations.append({
            "station_id": station_ids[row.station],
            "name": STATION_NAMES.get(row.station, row.station),
            "lat": position.loc[row.station, "lat"],
            "lon": position.loc[row.station, "lon"],
            "n_chargers": int(row.n_chargers),
            "power_kw": round(row.rated_kw, 1),
            "avg_charge_min": round(row.mean_charge_min, 1),
        })
    return sorted(stations, key=lambda s: s["station_id"])


def _charger_ids(chargers: pd.DataFrame, station_ids: dict[str, str]) -> dict[str, str]:
    """ML's charger id -> ours: CAG1-003 at the site that is stn_001 becomes stn_001_c3.

    Chargers at a site the forecast model does not cover are left out.
    """
    known = chargers[chargers["site_path"].isin(station_ids)]
    return {row.id: f"{station_ids[row.site_path]}_c{int(row.id.split('-')[1])}" for row in known.itertuples()}


def _fault_days(events: pd.DataFrame) -> pd.DataFrame:
    """One row per charger per day it was faulted, read from the charger's own status messages."""
    status = events[events["action"] == "StatusNotification"].sort_values(["station_id", "timestamp"])
    # A fault lasts until the charger's next status message (or the end of the log).
    until = status.groupby("station_id")["timestamp"].shift(-1).fillna(events["timestamp"].max())
    rows = []
    for fault, end in zip(status.itertuples(), until):
        if fault.status != "Faulted":
            continue
        for day in pd.date_range(fault.timestamp.date(), end.date()):
            rows.append({
                "ml_id": fault.station_id,
                "date": day.date(),
                "status": FAULT_STATUS[fault.error_code],
                # Health is per day, so the evidence gives the day, not the minute.
                "evidence": f"Charger reported {fault.error_code} on {fault.timestamp.day} {fault.timestamp:%b}",
            })
    faults = pd.DataFrame(rows, columns=["ml_id", "date", "status", "evidence"])
    # Two faults on the same day: keep the worst one.
    faults = faults.sort_values("status", key=lambda s: s.map(WORST_FIRST.index), kind="stable")
    return faults.drop_duplicates(["ml_id", "date"])


def _health(events: pd.DataFrame, chargers: pd.DataFrame, charger_ids: dict[str, str], days: list[date]) -> pd.DataFrame:
    """health.parquet: one row per charger per day."""
    # Power ratio = the day's median power / rated power, capped at 1.
    meter = events[events["action"] == "MeterValues"]
    rated_w = meter["station_id"].map(chargers.set_index("id")["kw"]) * 1000
    ratio = (meter["power_w"] / rated_w).clip(upper=1.0)
    daily = ratio.groupby([meter["station_id"], meter["timestamp"].dt.date]).median().unstack("station_id")
    # A day with no car plugged in has no reading: carry the last one forward.
    first_day = min(events["timestamp"].min().date(), days[0])
    all_days = [d.date() for d in pd.date_range(first_day, days[-1])]
    daily = daily.reindex(index=all_days, columns=list(charger_ids)).ffill().bfill().fillna(0.0)
    baseline = daily.rolling(7, min_periods=1).median()

    health = pd.DataFrame({
        "power_ratio": daily.loc[days].stack().round(2),
        "baseline": baseline.loc[days].stack().round(2),
    }).rename_axis(["date", "ml_id"]).reset_index()
    health = health.merge(_fault_days(events), on=["ml_id", "date"], how="left")
    health["charger_id"] = health["ml_id"].map(charger_ids)
    health["station_id"] = health["charger_id"].str.rsplit("_c", n=1).str[0]
    health["status"] = health["status"].fillna("healthy")
    health["p_fault"] = (health["status"] != "healthy").astype(float)  # the charger itself says so
    health["evidence"] = [[e if isinstance(e, str) else HEALTHY_EVIDENCE] for e in health["evidence"]]
    return health[["charger_id", "station_id", "date", "power_ratio", "baseline", "status", "p_fault", "evidence"]]


def _fault_labels(truth: pd.DataFrame, charger_ids: dict[str, str], days: list[date]) -> pd.DataFrame:
    """fault_labels.parquet: ML's list of real faults, for the ones that touch the forecast days."""
    labels = pd.DataFrame({
        "charger_id": truth["station_id"].map(charger_ids),
        "fault_type": truth["fault_type"],
        "start_date": _local_time(truth["onset"]).dt.date,
        "end_date": _local_time(truth["end"]).dt.date,
    })
    in_range = (labels["end_date"] >= days[0]) & (labels["start_date"] <= days[-1])
    return labels[labels["charger_id"].notna() & in_range]


def _user_reports(feedback: pd.DataFrame, charger_ids: dict[str, str], days: list[date]) -> pd.DataFrame:
    """user_reports.parquet: the driver feedback that counts as a report (see REPORT_CATEGORIES)."""
    reports = pd.DataFrame({
        "charger_id": feedback["station_id"].map(charger_ids),
        "reported_at": _local_time(feedback["timestamp"]),
        "issue_type": feedback["category"].map(REPORT_CATEGORIES),
    })
    # Reports up to a week before the first day still count on that day.
    in_range = reports["reported_at"].dt.date >= days[0] - timedelta(days=7)
    return reports[feedback["keep"] & in_range].dropna()


def _report_categories(feedback: pd.DataFrame) -> list[dict]:
    """report_categories.json: each category's share of all the complaints ML kept (for the pie chart)."""
    complaints = feedback[feedback["keep"]]
    return [
        {"category": category, "count": int(count), "percentage": round(count / len(complaints) * 100, 1)}
        for category, count in complaints["category"].value_counts().items()
    ]


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
    synth = raw_path / "acn_synth"
    if not (raw_path / "model1_test_predictions.csv").exists():
        sys.exit(f"ML's files were not found in {raw_path.resolve()}. Merge main to get ml/output/.")
    missing = [name for name in SYNTH_FILES if not (synth / name).exists()]
    if missing:
        sys.exit(
            f"Missing in {synth.resolve()}: {missing}. ocpp_events.csv is not in git (get it from the ML team); "
            "feedback_clean.csv is written by ml/src/preprocessing/clean_feedback.py."
        )
    out.mkdir(parents=True, exist_ok=True)

    raw = pd.read_csv(raw_path / "model1_test_predictions.csv")
    profile = pd.read_csv(raw_path / "station_profile.csv")
    chargers = pd.read_csv(synth / "stations.csv")
    truth = pd.read_csv(synth / "fault_ground_truth.csv")
    feedback = pd.read_csv(synth / "feedback_clean.csv")
    # Only the sensor columns: ML's label columns (fault_id, fault_type, phase) are the answers, so they are not read.
    events = pd.read_csv(
        synth / "ocpp_events.csv", usecols=["timestamp", "station_id", "action", "status", "error_code", "power_w"]
    )
    events["timestamp"] = _local_time(events["timestamp"])

    station_ids = {name: f"stn_{i:03d}" for i, name in enumerate(sorted(raw["station"].unique()), start=1)}
    charger_ids = _charger_ids(chargers, station_ids)
    forecasts = _forecasts(raw, station_ids)
    days = sorted(set(forecasts["slot_start"].dt.date))
    stations = _stations(profile, chargers, station_ids)
    health = _health(events, chargers, charger_ids, days)
    labels = _fault_labels(truth, charger_ids, days)
    reports = _user_reports(feedback, charger_ids, days)
    params = {
        # Shown in /api/meta; each station's own charge time is in stations.parquet.
        "avg_charge_min": round(profile["mean_charge_min"].mean(), 1),
        "rm_per_session": RM_PER_SESSION,
        "max_tolerable_wait_min": MAX_TOLERABLE_WAIT_MIN,
    }
    meta = {
        "corridor_name": NETWORK_NAME,
        "currency": CURRENCY,
        "festive_periods": _festive_periods(forecasts),
        "demo_times": _demo_times(forecasts),
    }

    forecasts.to_parquet(out / "forecasts.parquet", index=False)
    pd.DataFrame(stations).to_parquet(out / "stations.parquet", index=False)
    health.to_parquet(out / "health.parquet", index=False)
    labels.to_parquet(out / "fault_labels.parquet", index=False)
    reports.to_parquet(out / "user_reports.parquet", index=False)
    (out / "params.json").write_text(json.dumps(params, indent=2), encoding="utf-8")
    (out / "report_categories.json").write_text(json.dumps(_report_categories(feedback), indent=2), encoding="utf-8")
    (out / "meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")

    print(f"Stations: {station_ids}")
    print(f"Range: {forecasts['slot_start'].min()} to {forecasts['slot_start'].max()}")
    print(f"Chargers with sensors: {len(charger_ids)} | faulty charger-days: {(health['status'] != 'healthy').sum()}")
    print(f"Real faults: {len(labels)} | driver reports: {reports['issue_type'].value_counts().to_dict()}")
    print(f"Demo times: {meta['demo_times']}")
    print(f"Written to {out.resolve()}")


if __name__ == "__main__":
    convert(sys.argv[1] if len(sys.argv) > 1 else ML_DIR, get_settings().data_dir)
