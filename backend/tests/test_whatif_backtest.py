from datetime import date, datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.services import backtest, whatif
from app.services.data_loader import DataStore

MYT = timezone(timedelta(hours=8))
DAY_BEFORE_RAYA = datetime(2026, 3, 26, 14, 0, tzinfo=MYT)
RAYA_PARAM = "2026-03-26T14:00:00+08:00"


def test_fixing_a_broken_charger_cuts_wait_and_protects_revenue(data: DataStore) -> None:
    result = whatif.simulate_fix(data, "stn_003", "stn_003_c1", DAY_BEFORE_RAYA)
    assert result["after_wait_min"] < result["before_wait_min"]
    assert result["after_revenue_rm"] > result["before_revenue_rm"]
    assert "Fixing Charger 1 at Seremban R&R now" in result["summary"]


def test_fixing_a_healthy_charger_changes_nothing(data: DataStore) -> None:
    result = whatif.simulate_fix(data, "stn_003", "stn_003_c2", DAY_BEFORE_RAYA)
    assert result["after_wait_min"] == result["before_wait_min"]
    assert "does not change" in result["summary"]


def test_adding_chargers_helps_an_overloaded_station(data: DataStore) -> None:
    result = whatif.simulate_add_chargers(data, "stn_004", 2, DAY_BEFORE_RAYA)
    assert result["after_revenue_rm"] > result["before_revenue_rm"]


def test_whatif_endpoint(real_client: TestClient) -> None:
    body = {"scenario": "fix_now", "time": RAYA_PARAM, "station_id": "stn_003", "charger_id": "stn_003_c1"}
    assert real_client.post("/api/whatif", json=body).status_code == 200

    assert real_client.post("/api/whatif", json={**body, "charger_id": None}).status_code == 400
    assert real_client.post("/api/whatif", json={**body, "charger_id": "stn_999_c1"}).status_code == 404
    assert real_client.post("/api/whatif", json={**body, "scenario": "discount"}).status_code == 400


def test_backtest_week_starts_the_day_before_the_first_fault(data: DataStore) -> None:
    days = backtest.backtest_days(data)
    assert days[0] == date(2026, 3, 22)
    assert len(days) == 7


def test_ours_is_better_than_baseline(data: DataStore) -> None:
    result = backtest.run_backtest(data)
    assert result["queue_minutes_saved"] > 0
    assert result["rm_protected"] > 0
    assert result["forecast_mae_ours"] < result["forecast_mae_baseline"]
    # The sensors flag three of the four real faults; the fourth is only reported by drivers.
    assert result["fault_precision"] == 1.0
    assert result["fault_recall"] == 0.75
    assert len(result["daily"]) == 7
    assert all(d["wait_ours_min"] <= d["wait_baseline_min"] for d in result["daily"])


def test_a_fault_is_known_from_the_sensors_or_the_second_driver_report(data: DataStore) -> None:
    faults = {f["charger_id"]: f for f in backtest.real_faults(data, backtest.backtest_days(data))}

    # The sensors flag stn_003_c1 the day it breaks; in the data it was really repaired three days later.
    assert faults["stn_003_c1"]["known_from"] == faults["stn_003_c1"]["start_date"] == date(2026, 3, 23)
    assert faults["stn_003_c1"]["end_date"] == date(2026, 3, 26)
    # stn_002_c4 has healthy sensors: it is known from its second driver report, the day after it broke.
    assert faults["stn_002_c4"]["start_date"] == date(2026, 3, 24)
    assert faults["stn_002_c4"]["known_from"] == date(2026, 3, 25)


def test_baseline_is_what_really_happened_and_ours_repairs_sooner(data: DataStore) -> None:
    days = backtest.backtest_days(data)
    baseline, ours = backtest.run_baseline(data, days), backtest.run_ours(data, days)

    # Same queues until the first fault is repaired, never worse afterwards, and better over the week.
    assert baseline[0] == ours[0]
    assert all(o["queue_minutes"] <= b["queue_minutes"] for b, o in zip(baseline, ours))
    assert sum(o["queue_minutes"] for o in ours) < sum(b["queue_minutes"] for b in baseline)


def test_backtest_endpoint(real_client: TestClient) -> None:
    res = real_client.get("/api/backtest")
    assert res.status_code == 200
    assert res.json()["week_label"] == "Week of 22 Mar 2026"
