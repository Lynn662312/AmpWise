import dataclasses
import time as clock
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.services.data_loader import DataStore
from app.schemas import IssueType
from app.services.priority import HORIZON_HOURS, build_action_list, earlier_arrivals, score_issue, upcoming_slots
from app.services.queueing import expected_unserved

MYT = timezone(timedelta(hours=8))
NORMAL_TUESDAY = datetime(2026, 3, 17, 14, 0, tzinfo=MYT)
RM_PER_SESSION, CHARGE_MIN = 35.0, 38  # the dummy data's assumptions
DAY_BEFORE_RAYA = datetime(2026, 3, 26, 14, 0, tzinfo=MYT)
RAYA_PARAM = "2026-03-26T14:00:00+08:00"


def test_safety_fault_is_first_then_rm_descending(data: DataStore) -> None:
    actions = build_action_list(data, DAY_BEFORE_RAYA)
    assert actions[0]["issue_type"] == "safety_fault"
    assert actions[0]["urgency"] == "critical"
    assert [a["rank"] for a in actions] == list(range(1, len(actions) + 1))


def test_order_is_safety_then_money_at_risk_then_underused(data: DataStore) -> None:
    actions = build_action_list(data, DAY_BEFORE_RAYA)
    types = [a["issue_type"] for a in actions]
    assert types[0] == "safety_fault" and types[-1] == "underused"
    # The three stations with a long queue at the festive peak are listed as congestion: with cars
    # arriving in bunches, some find every charger busy even when all of them work.
    assert sorted(types[1:-1]) == [
        "chronic_undercapacity", "congestion", "congestion", "congestion", "connector_fault", "degraded", "user_reported",
    ]
    # After the safety fault, chargers and stations are one list: most money at risk first.
    money = [a["rm_at_risk"] for a in actions[1:-1]]
    assert money == sorted(money, reverse=True)
    assert money[-1] > 0
    # The safety fault is first although other items have more money at risk.
    assert actions[0]["rm_at_risk"] < money[0]
    assert actions[-1]["rm_at_risk"] == 0.0


def _unserved(data: DataStore, station_id: str, chargers: int) -> float:
    """Estimated unserved sessions over the next 72 hours, worked out here from the forecast."""
    slots = upcoming_slots(data, station_id, DAY_BEFORE_RAYA, HORIZON_HOURS)
    earlier = earlier_arrivals(data, station_id, slots["slot_start"].iloc[0])
    return sum(expected_unserved(list(slots["arrivals"]), CHARGE_MIN, chargers, earlier))


def test_rm_at_risk_follows_the_occupancy_rule(data: DataStore) -> None:
    actions = {a["id"]: a for a in build_action_list(data, DAY_BEFORE_RAYA)}

    # Sensor fault (p_fault 0.86, 3 of 4 working): what one more working charger would serve.
    at_risk = _unserved(data, "stn_003", 3) - _unserved(data, "stn_003", 4)
    assert actions["degraded:stn_003:stn_003_c1"]["rm_at_risk"] == round(0.86 * at_risk * RM_PER_SESSION, 2)

    # Driver-reported charger with healthy sensors (3 working): what is lost if it is really down.
    at_risk = _unserved(data, "stn_002", 2) - _unserved(data, "stn_002", 3)
    assert actions["user_reported:stn_002:stn_002_c4"]["rm_at_risk"] == round(at_risk * RM_PER_SESSION, 2)

    # Station short of chargers: what is not served even with both installed chargers working.
    at_risk = _unserved(data, "stn_004", 2)
    assert actions["chronic_undercapacity:stn_004:-"]["rm_at_risk"] == round(at_risk * RM_PER_SESSION, 2)
    assert f"estimated {at_risk:.1f} sessions are at risk" in actions["chronic_undercapacity:stn_004:-"]["reason"]

    assert actions["underused:stn_001:-"]["rm_at_risk"] == 0.0


def test_broken_charger_has_no_money_at_risk_when_the_others_can_serve_everyone(data: DataStore) -> None:
    # Break one of the six chargers at Dengkil, a quiet station: the other five still serve every car.
    health = data.health.copy()
    health.loc[health["charger_id"] == "stn_001_c1", ["status", "p_fault"]] = ["degraded", 0.9]
    quiet = dataclasses.replace(data, health=health)
    assert _unserved(quiet, "stn_001", 5) < 0.1  # under a tenth of a session counts as nothing

    broken = next(a for a in build_action_list(quiet, DAY_BEFORE_RAYA) if a["id"] == "degraded:stn_001:stn_001_c1")
    assert broken["rm_at_risk"] == 0.0
    assert broken["deadline"] is None
    assert "sessions are at risk" not in broken["reason"]

    # At Seremban demand is above what three chargers can serve, so the same kind of fault costs money.
    assert _unserved(data, "stn_003", 3) > _unserved(data, "stn_003", 4)
    degraded = next(a for a in build_action_list(data, DAY_BEFORE_RAYA) if a["id"] == "degraded:stn_003:stn_003_c1")
    assert degraded["rm_at_risk"] > 0


def test_a_station_queue_with_every_car_served_is_not_listed(data: DataStore) -> None:
    # Every station issue on the list has sessions at risk, except "underused", which never has.
    for action in build_action_list(data, DAY_BEFORE_RAYA):
        if action["issue_type"] in ("congestion", "chronic_undercapacity"):
            assert action["rm_at_risk"] > 0


def test_site_issue_no_longer_exists() -> None:
    assert "site_issue" not in {issue_type.value for issue_type in IssueType}


def test_charger_reported_by_drivers_but_not_by_sensors_gets_an_action(data: DataStore) -> None:
    actions = build_action_list(data, DAY_BEFORE_RAYA)
    reported = [a for a in actions if a["issue_type"] == "user_reported"]

    # stn_002_c4 has three reports and healthy sensors; stn_001_c3 has one report, which is not enough.
    assert [a["id"] for a in reported] == ["user_reported:stn_002:stn_002_c4"]
    assert reported[0]["recommended_action"] == "Inspect charger"
    assert "3 drivers have reported it since Wednesday 9am" in reported[0]["reason"]


def test_money_at_risk_ranks_above_driver_reports() -> None:
    charger = {"charger_id": "stn_001_c1"}
    safety = {**charger, "issue_type": "safety_fault", "report_count": 0, "rm_at_risk": 1.0}
    costly = {**charger, "issue_type": "degraded", "report_count": 1, "rm_at_risk": 900.0}
    station = {"charger_id": None, "issue_type": "congestion", "report_count": 0, "rm_at_risk": 500.0}
    reported = {**charger, "issue_type": "user_reported", "report_count": 9, "rm_at_risk": 0.0}
    quiet = {**charger, "issue_type": "connector_fault", "report_count": 2, "rm_at_risk": 0.0}
    underused = {"charger_id": None, "issue_type": "underused", "report_count": 0, "rm_at_risk": 0.0}

    # Safety first; then money at risk, whatever the number of reports; reports only break ties;
    # underused stations after everything that can cost revenue.
    ranked = sorted([underused, quiet, reported, station, costly, safety], key=score_issue)
    assert ranked == [safety, costly, station, reported, quiet, underused]


def test_driver_reports_support_a_sensor_fault(data: DataStore) -> None:
    degraded = next(a for a in build_action_list(data, DAY_BEFORE_RAYA) if a["id"] == "degraded:stn_003:stn_003_c1")
    assert "Drivers have also reported it (3 reports)" in degraded["reason"]


def test_action_ids_follow_the_contract(data: DataStore) -> None:
    ids = {a["id"] for a in build_action_list(data, DAY_BEFORE_RAYA)}
    assert "degraded:stn_003:stn_003_c1" in ids
    assert "chronic_undercapacity:stn_004:-" in ids


def test_broken_charger_costs_more_before_the_festive_peak(data: DataStore) -> None:
    # No charger is faulty yet on the normal Tuesday.
    normal = build_action_list(data, NORMAL_TUESDAY)
    assert all(a["charger_id"] is None for a in normal)

    degraded = next(a for a in build_action_list(data, DAY_BEFORE_RAYA) if a["id"] == "degraded:stn_003:stn_003_c1")
    assert degraded["rm_at_risk"] > 0
    assert degraded["deadline"] is not None
    assert "Charger 1 at Seremban R&R" in degraded["reason"]
    assert "Power at 41% of 7-day median" in degraded["reason"]


def test_limit(data: DataStore) -> None:
    assert len(build_action_list(data, DAY_BEFORE_RAYA, limit=2)) == 2


def test_actions_endpoint_is_fast(real_client: TestClient) -> None:
    started = clock.perf_counter()
    res = real_client.get("/api/actions", params={"time": RAYA_PARAM})
    assert res.status_code == 200
    assert res.json()[0]["issue_type"] == "safety_fault"
    assert clock.perf_counter() - started < 1.0


def test_stations_endpoint_uses_data(real_client: TestClient) -> None:
    stations = {s["id"]: s for s in real_client.get("/api/stations", params={"time": RAYA_PARAM}).json()}
    assert len(stations) == 5
    assert stations["stn_003"]["n_working"] == 3
    assert stations["stn_003"]["open_issue_count"] >= 1
    assert stations["stn_001"]["level"] == "green"


def test_forecast_endpoint_uses_data(real_client: TestClient) -> None:
    res = real_client.get("/api/stations/stn_003/forecast", params={"start": RAYA_PARAM, "hours": 24})
    slots = res.json()
    assert len(slots) == 48
    assert slots[0]["slot_start"] == RAYA_PARAM
    assert any(s["is_festive"] for s in slots)


def test_charger_health_endpoint_uses_data(real_client: TestClient) -> None:
    body = real_client.get("/api/chargers/stn_003_c1/health", params={"time": RAYA_PARAM, "days": 7}).json()
    assert body["status"] == "degraded"
    assert body["degraded_since"] == "2026-03-23"
    assert len(body["series"]) == 7
    assert body["series"][-1]["date"] == "2026-03-26"


def test_meta_endpoint_uses_data(real_client: TestClient) -> None:
    body = real_client.get("/api/meta").json()
    assert body["time_range"] == {"start": "2026-03-16T00:00:00+08:00", "end": "2026-04-05T23:30:00+08:00"}
    # The wait-tolerance assumption is gone.
    assert body["assumptions"] == {"rm_per_session": 35.0, "avg_charge_min": 38.0}


def test_report_categories_endpoint_uses_data(real_client: TestClient, data: DataStore) -> None:
    assert real_client.get("/api/reports/categories").json() == data.report_categories
    assert len(data.report_categories) == 9


def test_station_chargers_endpoint_lists_the_sensor_chargers_in_order(real_client: TestClient) -> None:
    chargers = real_client.get("/api/stations/stn_003/chargers", params={"time": RAYA_PARAM}).json()
    assert [c["charger_id"] for c in chargers] == ["stn_003_c1", "stn_003_c2", "stn_003_c3", "stn_003_c4"]
    assert [c["status"] for c in chargers] == ["degraded", "healthy", "healthy", "healthy"]
    assert chargers[0] == {"charger_id": "stn_003_c1", "station_id": "stn_003", "power_kw": 60.0, "status": "degraded"}

    # Every id it returns is accepted by the charger health endpoint.
    for charger in chargers:
        health = real_client.get(f"/api/chargers/{charger['charger_id']}/health", params={"time": RAYA_PARAM})
        assert health.status_code == 200
    assert real_client.get("/api/stations/stn_999/chargers", params={"time": RAYA_PARAM}).status_code == 404


def test_overview_without_session_files_is_empty_not_invented(real_client: TestClient) -> None:
    # The dummy data has no energy or session files: the totals are zero, never sample numbers.
    body = real_client.get("/api/overview", params={"time": RAYA_PARAM}).json()
    assert body["data_source"] == "api"
    assert (body["energy_delivered_kwh"], body["energy_delivered_week_kwh"], body["live_sessions"]) == (0.0, 0.0, 0)
    assert [point["date"] for point in body["energy_trend"]] == [f"2026-03-{day}" for day in range(20, 27)]
    # Uptime is real: 20 chargers over 7 days is 140 charger-days, 9 of them with a fault.
    assert body["network_uptime_pct"] == 93.6
    assert real_client.get("/api/overview").status_code == 400  # `time` is required


def test_charger_events_endpoint_without_a_log_file_is_empty(real_client: TestClient) -> None:
    # The dummy data has no charger log: a known charger gives an empty list, an unknown one a 404.
    assert real_client.get("/api/chargers/stn_003_c1/events", params={"time": RAYA_PARAM}).json() == []
    assert real_client.get("/api/chargers/stn_999_c1/events", params={"time": RAYA_PARAM}).status_code == 404


def test_unknown_ids_are_not_found(real_client: TestClient) -> None:
    assert real_client.get("/api/chargers/stn_999_c1/health", params={"time": RAYA_PARAM}).status_code == 404
    assert real_client.get("/api/stations/stn_999/forecast", params={"start": RAYA_PARAM}).status_code == 404
