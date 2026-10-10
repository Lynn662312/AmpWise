"""Reads the ML files from DATA_DIR once (docs/api_contract.md section 5)."""

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pandas as pd

STATION_COLUMNS = ["station_id", "name", "lat", "lon", "n_chargers", "power_kw"]
FORECAST_COLUMNS = ["station_id", "slot_start", "arrivals", "arrivals_baseline", "is_festive"]
HEALTH_COLUMNS = ["charger_id", "station_id", "date", "power_ratio", "baseline", "status", "p_fault", "evidence"]
FAULT_LABEL_COLUMNS = ["charger_id", "fault_type", "start_date"]
USER_REPORT_COLUMNS = ["charger_id", "reported_at"]
ENERGY_COLUMNS = ["station_id", "slot_start", "energy_kwh"]
SESSION_COLUMNS = ["station_id", "started_at", "ended_at"]
CHARGER_EVENT_COLUMNS = ["charger_id", "time", "source", "message"]
PARAM_KEYS = ["avg_charge_min", "rm_per_session"]
META_KEYS = ["corridor_name", "currency", "festive_periods", "demo_times"]


@dataclass
class DataStore:
    meta: dict[str, Any]
    stations: pd.DataFrame
    forecasts: pd.DataFrame
    health: pd.DataFrame
    fault_labels: pd.DataFrame
    user_reports: pd.DataFrame
    report_categories: list[dict[str, Any]]  # share of driver complaints per category, for the pie chart
    energy: pd.DataFrame  # energy delivered per 30-minute slot, for the overview
    sessions: pd.DataFrame  # when each charging session started and ended, for the overview
    charger_events: pd.DataFrame  # each charger's log: fault messages, readings, driver reports
    params: dict[str, float]

    def __post_init__(self) -> None:
        # Per-charger lookups, so a request does not scan the whole table once per charger.
        self.health_by_charger: dict[str, pd.DataFrame] = dict(tuple(self.health.groupby("charger_id")))
        self.reports_by_charger: dict[str, pd.DataFrame] = dict(tuple(self.user_reports.groupby("charger_id")))
        self.events_by_charger: dict[str, pd.DataFrame] = dict(tuple(self.charger_events.groupby("charger_id")))
        self.chargers_by_station: dict[str, list[str]] = (
            self.health.groupby("station_id")["charger_id"].unique().apply(list).to_dict()
        )


def _read(data_dir: str, filename: str, columns: list[str]) -> pd.DataFrame:
    df = pd.read_parquet(Path(data_dir) / filename)
    missing = [c for c in columns if c not in df.columns]
    if missing:
        raise ValueError(f"{filename} is missing columns: {missing}")
    return df


def load_stations(data_dir: str) -> pd.DataFrame:
    return _read(data_dir, "stations.parquet", STATION_COLUMNS)


def load_forecasts(data_dir: str) -> pd.DataFrame:
    df = _read(data_dir, "forecasts.parquet", FORECAST_COLUMNS)
    df["slot_start"] = pd.to_datetime(df["slot_start"])
    if df["slot_start"].dt.tz is None:
        raise ValueError("forecasts.parquet slot_start must include a UTC offset (station local time)")
    return df.sort_values(["station_id", "slot_start"]).reset_index(drop=True)


def load_health(data_dir: str) -> pd.DataFrame:
    df = _read(data_dir, "health.parquet", HEALTH_COLUMNS)
    df["date"] = pd.to_datetime(df["date"]).dt.date
    df["evidence"] = df["evidence"].apply(list)
    return df.sort_values(["charger_id", "date"]).reset_index(drop=True)


def load_fault_labels(data_dir: str) -> pd.DataFrame:
    df = _read(data_dir, "fault_labels.parquet", FAULT_LABEL_COLUMNS)
    df["start_date"] = pd.to_datetime(df["start_date"]).dt.date
    if "end_date" in df.columns:  # optional: the day the fault ended
        df["end_date"] = pd.to_datetime(df["end_date"]).dt.date
    return df


def load_params(data_dir: str) -> dict[str, float]:
    params = json.loads((Path(data_dir) / "params.json").read_text(encoding="utf-8"))
    missing = [k for k in PARAM_KEYS if k not in params]
    if missing:
        raise ValueError(f"params.json is missing keys: {missing}")
    return params


def load_user_reports(data_dir: str) -> pd.DataFrame:
    """Driver fault reports. The file is optional: without it there are simply no reports."""
    if not (Path(data_dir) / "user_reports.parquet").exists():
        return pd.DataFrame({"charger_id": pd.Series(dtype=str), "reported_at": pd.Series(dtype="datetime64[ns, UTC]")})
    df = _read(data_dir, "user_reports.parquet", USER_REPORT_COLUMNS)
    df["reported_at"] = pd.to_datetime(df["reported_at"])
    if df["reported_at"].dt.tz is None:
        raise ValueError("user_reports.parquet reported_at must include a UTC offset")
    return df.sort_values("reported_at").reset_index(drop=True)


def _load_optional(data_dir: str, filename: str, columns: list[str], time_columns: list[str]) -> pd.DataFrame:
    """A file with timestamps that may be missing: without it the table is simply empty."""
    if not (Path(data_dir) / filename).exists():
        empty_times = {c: pd.Series(dtype="datetime64[ns, UTC]") for c in time_columns}
        return pd.DataFrame({c: empty_times.get(c, pd.Series(dtype=object)) for c in columns})
    df = _read(data_dir, filename, columns)
    for column in time_columns:
        df[column] = pd.to_datetime(df[column])
        if df[column].dt.tz is None:
            raise ValueError(f"{filename} {column} must include a UTC offset")
    return df


def load_energy(data_dir: str) -> pd.DataFrame:
    return _load_optional(data_dir, "energy.parquet", ENERGY_COLUMNS, ["slot_start"])


def load_sessions(data_dir: str) -> pd.DataFrame:
    return _load_optional(data_dir, "sessions.parquet", SESSION_COLUMNS, ["started_at", "ended_at"])


def load_charger_events(data_dir: str) -> pd.DataFrame:
    return _load_optional(data_dir, "charger_events.parquet", CHARGER_EVENT_COLUMNS, ["time"])


def load_report_categories(data_dir: str) -> list[dict[str, Any]]:
    """Share of driver complaints per category. The file is optional: without it the list is empty."""
    path = Path(data_dir) / "report_categories.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else []


def load_meta(data_dir: str) -> dict[str, Any]:
    meta = json.loads((Path(data_dir) / "meta.json").read_text(encoding="utf-8"))
    missing = [k for k in META_KEYS if k not in meta]
    if missing:
        raise ValueError(f"meta.json is missing keys: {missing}")
    return meta


def load_all(data_dir: str) -> DataStore:
    return DataStore(
        meta=load_meta(data_dir),
        stations=load_stations(data_dir),
        forecasts=load_forecasts(data_dir),
        health=load_health(data_dir),
        fault_labels=load_fault_labels(data_dir),
        user_reports=load_user_reports(data_dir),
        report_categories=load_report_categories(data_dir),
        energy=load_energy(data_dir),
        sessions=load_sessions(data_dir),
        charger_events=load_charger_events(data_dir),
        params=load_params(data_dir),
    )
