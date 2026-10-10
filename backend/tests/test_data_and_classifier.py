from datetime import datetime, timedelta, timezone

import pytest

from app.schemas import ChargerStatus, IssueType
from app.services import data_loader
from app.services.classifier import classify_charger, classify_station, working_chargers
from app.services.data_loader import DataStore

MYT = timezone(timedelta(hours=8))
NORMAL_TUESDAY = datetime(2026, 3, 17, 14, 0, tzinfo=MYT)
DAY_BEFORE_RAYA = datetime(2026, 3, 26, 14, 0, tzinfo=MYT)


def test_loader_reads_contract_columns(data: DataStore) -> None:
    assert list(data.stations.columns) == data_loader.STATION_COLUMNS
    assert list(data.forecasts.columns) == data_loader.FORECAST_COLUMNS
    assert list(data.health.columns) == data_loader.HEALTH_COLUMNS
    assert data.params["avg_charge_min"] == 38


def test_forecasts_are_30_minute_slots_in_malaysia_time(data: DataStore) -> None:
    slots = data.forecasts[data.forecasts["station_id"] == "stn_003"]["slot_start"]
    assert len(slots) == 21 * 48
    assert slots.iloc[0].isoformat() == "2026-03-16T00:00:00+08:00"
    assert slots.iloc[1] - slots.iloc[0] == timedelta(minutes=30)


def test_loader_rejects_missing_column(data: DataStore, tmp_path) -> None:
    data.stations.drop(columns="lat").to_parquet(tmp_path / "stations.parquet")
    with pytest.raises(ValueError, match="lat"):
        data_loader.load_stations(str(tmp_path))


def test_classify_charger_follows_health_over_time(data: DataStore) -> None:
    assert classify_charger(data, "stn_003_c1", NORMAL_TUESDAY) == ChargerStatus.healthy
    assert classify_charger(data, "stn_003_c1", DAY_BEFORE_RAYA) == ChargerStatus.degraded
    assert classify_charger(data, "stn_005_c1", DAY_BEFORE_RAYA) == ChargerStatus.safety_fault
    assert classify_charger(data, "stn_003_c2", DAY_BEFORE_RAYA) == ChargerStatus.healthy


def test_working_chargers_drops_when_one_is_faulty(data: DataStore) -> None:
    assert working_chargers(data, "stn_003", NORMAL_TUESDAY) == 4
    assert working_chargers(data, "stn_003", DAY_BEFORE_RAYA) == 3


def test_classify_station(data: DataStore) -> None:
    assert classify_station(data, "stn_003", NORMAL_TUESDAY) is None
    assert classify_station(data, "stn_003", DAY_BEFORE_RAYA) == IssueType.congestion
    assert classify_station(data, "stn_004", NORMAL_TUESDAY) == IssueType.chronic_undercapacity
    assert classify_station(data, "stn_001", NORMAL_TUESDAY) == IssueType.underused
