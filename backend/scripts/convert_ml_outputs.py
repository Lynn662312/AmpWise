"""Turns ML's exports into the files the backend reads.

ML's files live in ml/output/ (pushed to main by the ML team):
    model1_test_predictions.csv, station_profile.csv     the forecast model
    acn_synth/stations.csv                               the chargers
    acn_synth/ocpp_events.csv                            the sensor log (too large for git: get it from the ML team)
    acn_synth/fault_ground_truth.csv                     the real faults
    acn_synth/feedback_clean.csv                         driver feedback (each row is one report), cleaned by
                                                         ml/src/preprocessing/clean_feedback.py
    acn_synth/site_load_30min.csv, acn_sessions.csv      energy delivered and charging sessions
1. Run from backend/:   python -m scripts.convert_ml_outputs
2. Check the result:    python -m scripts.check_data

ML's own column names are read as they are; the renaming to the contract's names happens here.
"""

import json
import sys
from datetime import date, timedelta
from pathlib import Path

import pandas as pd

from app.core.config import get_settings

ML_DIR = "../ml/output"  # where the ML team keeps its exports
SYNTH_FILES = (
    "stations.csv",
    "ocpp_events.csv",
    "fault_ground_truth.csv",
    "feedback_clean.csv",
    "site_load_30min.csv",
    "acn_sessions.csv",
)
LOCAL_TZ = "America/Los_Angeles"  # the ACN stations are in California
CURRENCY = "USD"
NETWORK_NAME = "ACN California (Caltech / JPL)"

# Team decision: revenue per charging session, in CURRENCY. Charge time comes from ML's
# station_profile.csv instead.
RM_PER_SESSION = 10.0

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

# The measurement that belongs to a fault type, shown in the charger's log as proof:
# sensor column, what to call it, unit, and whether a high or a low value is the bad one.
FAULT_READINGS = {
    "HighTemperature": ("temperature_c", "Cable temperature", "°C", "max"),
    "OverVoltage": ("voltage_v", "Voltage", "V", "max"),
    "OverCurrentFailure": ("current_a", "Current", "A", "max"),
    "WeakSignal": ("rssi_dbm", "Signal strength", "dBm", "min"),
}
READING_WINDOW = pd.Timedelta(hours=24)  # how far before a fault to look for that reading
SENSOR_READINGS = [column for column, *_ in FAULT_READINGS.values()]

# The complaint categories that count as a driver report on the charger and can reach the action list.
# Only rows the ML cleaning step marked keep (negative comment, not spam) are counted.
# Left out: Payment issue, Blocked by non-EV and Cleanliness. They are not about the charger itself,
# so they only show in the pie chart.
CHARGER_REPORT_CATEGORIES = [
    "Won't start",
    "Slow charging",
    "Cable stuck",
    "Connector damaged",
    "Screen broken",
    "Other",  # what is left after cleaning is about the charger ("keeps flashing red")
]


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


def _reading_before(log: pd.DataFrame, fault) -> tuple | None:
    """The most extreme matching reading in the day before a fault, next to the charger's usual value."""
    if fault.error_code not in FAULT_READINGS:
        return None
    column, name, unit, bad = FAULT_READINGS[fault.error_code]
    readings = log[log[column].notna() & (log["timestamp"] < fault.timestamp)]
    recent = readings[readings["timestamp"] >= fault.timestamp - READING_WINDOW]
    if recent.empty:
        return None
    worst = recent.loc[recent[column].idxmax() if bad == "max" else recent[column].idxmin()]
    usual = readings[readings["timestamp"] < fault.timestamp - READING_WINDOW][column].median()
    usual_text = f" (usual {usual:.1f} {unit})" if pd.notna(usual) else ""
    verb = "reached" if bad == "max" else "fell to"
    return (fault.station_id, worst["timestamp"], "sensor", f"{name} {verb} {worst[column]:.1f} {unit}{usual_text}")


def _charger_events(
    events: pd.DataFrame, feedback: pd.DataFrame, charger_ids: dict[str, str], days: list[date]
) -> pd.DataFrame:
    """charger_events.parquet: each charger's log: its fault messages, the reading behind them, driver reports."""
    rows = []
    for ml_id, log in events[events["station_id"].isin(charger_ids)].groupby("station_id"):
        status = log[log["action"] == "StatusNotification"].sort_values("timestamp")
        after = status[["timestamp", "status"]].shift(-1)  # the charger's next status message
        for fault, back_time, back_status in zip(status.itertuples(), after["timestamp"], after["status"]):
            if fault.status != "Faulted":
                continue
            rows.append((ml_id, fault.timestamp, "sensor", f"Charger reported {fault.error_code}"))
            if pd.notna(back_time):
                rows.append((ml_id, back_time, "sensor", f"Charger back to {back_status} after {fault.error_code}"))
            reading = _reading_before(log, fault)
            if reading:
                rows.append(reading)

    reports = feedback[feedback["keep"] & feedback["category"].isin(CHARGER_REPORT_CATEGORIES)]
    for report, when in zip(reports.itertuples(), _local_time(reports["timestamp"])):
        rows.append((report.station_id, when, "driver", f"Driver report ({report.category}): {report.free_text}"))

    log = pd.DataFrame(rows, columns=["ml_id", "time", "source", "message"])
    log["charger_id"] = log["ml_id"].map(charger_ids)
    in_range = log["time"].dt.date.between(days[0] - timedelta(days=7), days[-1])
    return log[log["charger_id"].notna() & in_range].sort_values("time")[["charger_id", "time", "source", "message"]]


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
    """user_reports.parquet: the kept complaints about a charger (see CHARGER_REPORT_CATEGORIES)."""
    reports = pd.DataFrame({
        "charger_id": feedback["station_id"].map(charger_ids),
        "reported_at": _local_time(feedback["timestamp"]),
    })
    about_charger = feedback["keep"] & feedback["category"].isin(CHARGER_REPORT_CATEGORIES)
    # Reports up to a week before the first day still count on that day.
    in_range = reports["reported_at"].dt.date >= days[0] - timedelta(days=7)
    return reports[about_charger & in_range].dropna()


def _energy(load: pd.DataFrame, station_ids: dict[str, str], days: list[date]) -> pd.DataFrame:
    """energy.parquet: energy delivered per 30-minute slot, at the sites that have a forecast."""
    energy = pd.DataFrame({
        "station_id": load["site"].map(station_ids),
        "slot_start": _local_time(load["timestamp"]),
        "energy_kwh": load["energy_kwh"].round(3),
    }).dropna()
    # A week before the first day is kept, so the first days have a full week behind them.
    return energy[energy["slot_start"].dt.date.between(days[0] - timedelta(days=7), days[-1])]


def _sessions(sessions: pd.DataFrame, station_ids: dict[str, str], days: list[date]) -> pd.DataFrame:
    """sessions.parquet: when each charging session started and ended, at the sites that have a forecast."""
    rows = pd.DataFrame({
        "station_id": sessions["site_path"].map(station_ids),
        "started_at": _local_time(sessions["connectionTime"]),
        "ended_at": _local_time(sessions["disconnectTime"]),
    }).dropna()
    return rows[(rows["ended_at"].dt.date >= days[0]) & (rows["started_at"].dt.date <= days[-1])]


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


def _most_faults_day(faulty: pd.DataFrame) -> date | None:
    """The day with the most faulty chargers. On a tie the later day, when drivers have had time to report."""
    chargers_per_day = faulty.groupby("date")["charger_id"].nunique()
    if chargers_per_day.empty:
        return None
    return max(chargers_per_day[chargers_per_day == chargers_per_day.max()].index)


def _demo_times(forecasts: pd.DataFrame, health: pd.DataFrame) -> list[dict]:
    """The preset times for the demo, most interesting first: the frontend opens on the first one.

    All at the busiest hour of the day: the day with the most safety faults, the day with the most
    chargers down, the busiest day, and the Sunday before it for contrast.
    """
    busiest_hour = forecasts.groupby(forecasts["slot_start"].dt.hour)["arrivals"].mean().idxmax()
    clock = f"{busiest_hour:02d}:00"
    first_full_day = forecasts["slot_start"].min().date() + timedelta(days=1)
    busiest_day = forecasts.groupby(forecasts["slot_start"].dt.date)["arrivals"].sum().idxmax()
    sunday = busiest_day - timedelta(days=(busiest_day.weekday() + 1) % 7 or 7)
    faulty = health[(health["status"] != "healthy") & (health["date"] >= first_full_day)]

    picks = [
        ("Safety faults", _most_faults_day(faulty[faulty["status"] == "safety_fault"])),
        ("Most chargers down", _most_faults_day(faulty)),
        ("Weekday morning rush", busiest_day),
        ("Quiet Sunday", max(sunday, first_full_day)),
    ]
    times: dict[date, str] = {}  # one preset per day: the first label wins
    for label, day in picks:
        if day is not None:
            times.setdefault(day, label)
    return [{"label": label, "time": _local(day, clock)} for day, label in times.items()]


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
    load = pd.read_csv(synth / "site_load_30min.csv", usecols=["timestamp", "site", "energy_kwh"])
    sessions = pd.read_csv(synth / "acn_sessions.csv", usecols=["site_path", "connectionTime", "disconnectTime"])
    # Only the sensor columns: ML's label columns (fault_id, fault_type, phase) are the answers, so they are not read.
    events = pd.read_csv(
        synth / "ocpp_events.csv",
        usecols=["timestamp", "station_id", "action", "status", "error_code", "power_w", *SENSOR_READINGS],
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
    }
    meta = {
        "corridor_name": NETWORK_NAME,
        "currency": CURRENCY,
        "festive_periods": _festive_periods(forecasts),
        "demo_times": _demo_times(forecasts, health),
    }

    forecasts.to_parquet(out / "forecasts.parquet", index=False)
    pd.DataFrame(stations).to_parquet(out / "stations.parquet", index=False)
    health.to_parquet(out / "health.parquet", index=False)
    labels.to_parquet(out / "fault_labels.parquet", index=False)
    reports.to_parquet(out / "user_reports.parquet", index=False)
    _energy(load, station_ids, days).to_parquet(out / "energy.parquet", index=False)
    _charger_events(events, feedback, charger_ids, days).to_parquet(out / "charger_events.parquet", index=False)
    _sessions(sessions, station_ids, days).to_parquet(out / "sessions.parquet", index=False)
    (out / "params.json").write_text(json.dumps(params, indent=2), encoding="utf-8")
    (out / "report_categories.json").write_text(json.dumps(_report_categories(feedback), indent=2), encoding="utf-8")
    (out / "meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")

    print(f"Stations: {station_ids}")
    print(f"Range: {forecasts['slot_start'].min()} to {forecasts['slot_start'].max()}")
    print(f"Chargers with sensors: {len(charger_ids)} | faulty charger-days: {(health['status'] != 'healthy').sum()}")
    print(f"Real faults: {len(labels)} | driver reports on chargers: {len(reports)}")
    print(f"Demo times: {meta['demo_times']}")
    print(f"Written to {out.resolve()}")


if __name__ == "__main__":
    convert(sys.argv[1] if len(sys.argv) > 1 else ML_DIR, get_settings().data_dir)
