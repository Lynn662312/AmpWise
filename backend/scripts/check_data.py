"""Checks a folder of ML files against docs/api_contract.md section 5.

Run from backend/ on the files exported from Colab, before using them:
    python -m scripts.check_data ../ml/outputs
"""

import sys
from datetime import timedelta

import pandas as pd

from app.core.config import get_settings
from app.schemas import ChargerStatus
from app.services import data_loader


def check(data_dir: str) -> list[str]:
    """Returns a list of problems; empty means the files are usable."""
    try:
        data = data_loader.load_all(data_dir)
    except (FileNotFoundError, ValueError) as exc:
        return [str(exc)]

    problems: list[str] = []
    station_ids = set(data.stations["station_id"])

    for name, df in (("forecasts", data.forecasts), ("health", data.health)):
        unknown = set(df["station_id"]) - station_ids
        if unknown:
            problems.append(f"{name}.parquet has station ids missing from stations.parquet: {sorted(unknown)}")
        missing = station_ids - set(df["station_id"])
        if missing:
            problems.append(f"{name}.parquet has no rows for stations: {sorted(missing)}")

    slots = data.forecasts["slot_start"]
    for demo in data.meta["demo_times"]:
        if not slots.min() <= pd.Timestamp(demo["time"]) <= slots.max():
            problems.append(f"meta.json demo time {demo['time']} is outside the forecast range")
    for station_id, group in data.forecasts.groupby("station_id"):
        if not (group["slot_start"].diff().dropna() == timedelta(minutes=30)).all():
            problems.append(f"forecasts.parquet has gaps or non-30-minute slots for {station_id}")

    valid = {status.value for status in ChargerStatus}
    bad_status = set(data.health["status"]) - valid
    if bad_status:
        problems.append(f"health.parquet has unknown status values {sorted(bad_status)}; allowed: {sorted(valid)}")
    if not data.health["p_fault"].between(0, 1).all():
        problems.append("health.parquet p_fault must be between 0 and 1")
    wrong_ids = [c for c, s in zip(data.health["charger_id"], data.health["station_id"]) if not c.startswith(f"{s}_c")]
    if wrong_ids:
        problems.append(f"health.parquet charger ids must look like stn_001_c1, e.g. got {wrong_ids[0]}")

    for station in data.stations.itertuples():
        found = data.health.loc[data.health["station_id"] == station.station_id, "charger_id"].nunique()
        if found != station.n_chargers:
            problems.append(f"{station.station_id}: n_chargers is {station.n_chargers} but health.parquet has {found} chargers")

    print(f"Stations: {len(station_ids)} | forecast range: {slots.min()} to {slots.max()}")
    return problems


if __name__ == "__main__":
    folder = sys.argv[1] if len(sys.argv) > 1 else get_settings().data_dir
    found = check(folder)
    for problem in found:
        print(f"PROBLEM: {problem}")
    print("OK: files match the contract" if not found else f"{len(found)} problem(s) found")
    sys.exit(1 if found else 0)
