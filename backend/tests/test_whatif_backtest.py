from datetime import date, datetime, timedelta, timezone

from fastapi.testclient import TestClient

import pytest

from app.services import backtest, whatif
from app.services.data_loader import DataStore
from app.services.priority import HORIZON_HOURS, outlook, upcoming_slots
from app.services.queueing import predict_wait

MYT = timezone(timedelta(hours=8))
DAY_BEFORE_RAYA = datetime(2026, 3, 26, 14, 0, tzinfo=MYT)
RAYA_PARAM = "2026-03-26T14:00:00+08:00"


def test_fixing_a_broken_charger_cuts_wait_and_protects_revenue(data: DataStore) -> None:
    result = whatif.simulate_fix(data, "stn_003", "stn_003_c1", DAY_BEFORE_RAYA)
    assert result["after_wait_min"] < result["before_wait_min"]
    assert result["after_revenue_rm"] > result["before_revenue_rm"]
    assert "Fixing Charger 1 at Seremban R&R now" in result["summary"]


def test_fix_revenue_is_served_sessions_times_revenue_per_session(data: DataStore) -> None:
    slots = upcoming_slots(data, "stn_003", DAY_BEFORE_RAYA, HORIZON_HOURS)
    broken, repaired = outlook(data, slots, 3), outlook(data, slots, 4)
    result = whatif.simulate_fix(data, "stn_003", "stn_003_c1", DAY_BEFORE_RAYA)

    # Repairing the charger means fewer unserved sessions, and each one served is revenue.
    assert repaired["unserved"] < broken["unserved"]
    assert result["before_revenue_rm"] == round(broken["served"] * 35.0, 2)
    assert result["after_revenue_rm"] == round(repaired["served"] * 35.0, 2)
    gained = result["after_revenue_rm"] - result["before_revenue_rm"]
    assert gained == pytest.approx((broken["unserved"] - repaired["unserved"]) * 35.0, abs=0.01)
    assert "estimated" in result["summary"]
    # The money at risk (unserved sessions x price) is what the page charts: it drops after the repair.
    assert result["before_at_risk_rm"] == round(broken["unserved"] * 35.0, 2)
    assert result["after_at_risk_rm"] == round(repaired["unserved"] * 35.0, 2)
    assert result["after_at_risk_rm"] < result["before_at_risk_rm"]


def test_whatif_wait_is_the_average_wait_not_the_capped_peak(data: DataStore) -> None:
    slots = upcoming_slots(data, "stn_004", DAY_BEFORE_RAYA, HORIZON_HOURS)

    def average_wait(chargers: int) -> float:
        queue_minutes = sum(arrivals * predict_wait(arrivals, 38, chargers) for arrivals in slots["arrivals"])
        return round(queue_minutes / slots["arrivals"].sum(), 1)

    # Tapah has 2 chargers and is over capacity at the peak with 2 and still with 3:
    # the peak wait is the 120-minute cap both times, but the average wait drops.
    assert outlook(data, slots, 2)["peak_wait_min"] == outlook(data, slots, 3)["peak_wait_min"] == 120.0
    result = whatif.simulate_add_chargers(data, "stn_004", 1, DAY_BEFORE_RAYA)
    assert (result["before_wait_min"], result["after_wait_min"]) == (average_wait(2), average_wait(3))
    assert result["after_wait_min"] < result["before_wait_min"]
    assert "cuts the average wait" in result["summary"]


def test_fixing_a_healthy_charger_changes_nothing(data: DataStore) -> None:
    result = whatif.simulate_fix(data, "stn_003", "stn_003_c2", DAY_BEFORE_RAYA)
    assert result["after_wait_min"] == result["before_wait_min"]
    assert "does not change" in result["summary"]


def test_adding_chargers_helps_an_overloaded_station(data: DataStore) -> None:
    slots = upcoming_slots(data, "stn_004", DAY_BEFORE_RAYA, HORIZON_HOURS)
    now, with_two_more = outlook(data, slots, 2), outlook(data, slots, 4)
    assert 0 <= with_two_more["unserved"] < now["unserved"]

    result = whatif.simulate_add_chargers(data, "stn_004", 2, DAY_BEFORE_RAYA)
    assert result["after_revenue_rm"] > result["before_revenue_rm"]
    assert result["after_revenue_rm"] == round(with_two_more["served"] * 35.0, 2)


def test_whatif_endpoint(real_client: TestClient) -> None:
    body = {"scenario": "fix_now", "time": RAYA_PARAM, "station_id": "stn_003", "charger_id": "stn_003_c1"}
    assert real_client.post("/api/whatif", json=body).status_code == 200

    assert real_client.post("/api/whatif", json={**body, "charger_id": None}).status_code == 400
    assert real_client.post("/api/whatif", json={**body, "charger_id": "stn_999_c1"}).status_code == 404
    assert real_client.post("/api/whatif", json={**body, "scenario": "discount"}).status_code == 400


def test_backtest_week_is_the_one_with_the_most_chargers_down(data: DataStore) -> None:
    # The four dummy faults run from 23 to 28 March; the earliest week that holds all of them starts on the 22nd.
    days = backtest.backtest_days(data)
    assert days[0] == date(2026, 3, 22)
    assert len(days) == 7
    assert all(days[0] <= fault["start_date"] and fault["end_date"] <= days[-1] for fault in backtest.real_faults(data, days))
    assert len(backtest.real_faults(data, days)) == 4


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


def test_rm_protected_is_unserved_sessions_avoided(data: DataStore) -> None:
    days = backtest.backtest_days(data)
    baseline, ours = backtest.run_baseline(data, days), backtest.run_ours(data, days)
    avoided = sum(b["unserved"] - o["unserved"] for b, o in zip(baseline, ours))

    assert avoided > 0
    assert backtest.run_backtest(data)["rm_protected"] == round(avoided * 35.0, 2)


def test_backtest_endpoint(real_client: TestClient) -> None:
    res = real_client.get("/api/backtest")
    assert res.status_code == 200
    assert res.json()["week_label"] == "Week of 22 Mar 2026"


def test_backtest_weeks_are_published_and_selectable(real_client: TestClient, data: DataStore) -> None:
    weeks = real_client.get("/api/meta").json()["backtest_weeks"]
    # The default week first (most chargers down), then every Monday-to-Sunday week inside the data.
    assert weeks[0] == {"value": "2026-03-22", "label": "Week of 22 Mar 2026 (most chargers down)"}
    assert [w["value"] for w in weeks[1:]] == ["2026-03-16", "2026-03-23", "2026-03-30"]

    # Each published week gives its own result; the default is the first one.
    monday = real_client.get("/api/backtest", params={"week": "2026-03-16"}).json()
    assert monday["week_label"] == "Week of 16 Mar 2026"
    assert monday["daily"][0]["date"] == "2026-03-16"
    assert real_client.get("/api/backtest", params={"week": weeks[0]["value"]}).json() == real_client.get("/api/backtest").json()
    assert backtest.backtest_days(data, "2026-03-30")[-1] == date(2026, 4, 5)

    # Anything else is refused, in the contract's error format.
    res = real_client.get("/api/backtest", params={"week": "raya_2026"})
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "bad_request"
