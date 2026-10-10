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
PARAM_KEYS = ["avg_charge_min", "rm_per_session", "max_tolerable_wait_min"]
META_KEYS = ["corridor_name", "currency", "festive_periods", "demo_times"]


@dataclass
class DataStore:
    meta: dict[str, Any]
    stations: pd.DataFrame
    forecasts: pd.DataFrame
    health: pd.DataFrame
    fault_labels: pd.DataFrame
    params: dict[str, float]


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
    return df


def load_params(data_dir: str) -> dict[str, float]:
    params = json.loads((Path(data_dir) / "params.json").read_text(encoding="utf-8"))
    missing = [k for k in PARAM_KEYS if k not in params]
    if missing:
        raise ValueError(f"params.json is missing keys: {missing}")
    return params


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
        params=load_params(data_dir),
    )
