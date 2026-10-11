from datetime import date
from pathlib import Path

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_data
from app.main import app
from app.services import data_loader
from app.services.classifier import charge_min
from scripts.check_data import check
from scripts.convert_ml_outputs import convert

STATIONS = ("caltech/S_Wilson_Garage_01", "jpl/Arroyo_Garage_01")


def _write_ml_files(raw_dir) -> None:
    """Small files with the same columns as the ML team's exports in ml/output/."""
    slots = pd.date_range("2019-12-10 08:00", "2019-12-31 07:30", freq="30min", tz="UTC")
    rows = []
    for station in STATIONS:
        for slot in slots:
            local = slot.tz_convert("America/Los_Angeles")
            rows.append({
                "station": station, "slot_utc": str(slot), "slot_local": str(local.tz_localize(None)),
                "arrivals": 2, "pred": 1.5 if local.hour == 7 else 0.5, "baseline_last_week": 1.0,
                "is_holiday": int(str(local.date()) == "2019-12-25"),
                "near_holiday": int(str(local.date()) in ("2019-12-23", "2019-12-24", "2019-12-26")),
                "wait_min_all_up": 3.0, "wait_min_one_down": 9.0,
            })
    pd.DataFrame(rows).to_csv(raw_dir / "model1_test_predictions.csv", index=False)
    pd.DataFrame({
        "station": STATIONS, "sampled": [364, 399], "mean_charge_min": [145.57, 222.39],
        "median_charge_min": [122.65, 200.32], "mean_kwh": [12.27, 15.1], "rated_kw": [6.666, 6.6976],
        "energy_source": ["measured", "estimated"], "n_chargers": [4, 52], "sessions_total": [1794, 22343],
    }).to_csv(raw_dir / "station_profile.csv", index=False)


def _write_synth_files(synth_dir) -> None:
    """Small files with the same columns as ml/output/acn_synth/ (times are UTC, as ML writes them)."""
    synth_dir.mkdir()
    # ML calls each charger a "station". North Wilson has no forecast, so its charger must be left out.
    pd.DataFrame(
        [
            ("SWG1-001", "caltech/S_Wilson_Garage_01", 34.1381, -118.1262, 6.6),
            ("SWG1-002", "caltech/S_Wilson_Garage_01", 34.1383, -118.1244, 6.6),
            ("ARG1-001", "jpl/Arroyo_Garage_01", 34.2003, -118.1720, 6.6),
            ("NWG1-001", "caltech/N_Wilson_Garage_01", 34.1369, -118.1259, 6.6),
        ],
        columns=["id", "site_path", "lat", "lon", "kw"],
    ).to_csv(synth_dir / "stations.csv", index=False)

    # Cable temperature on charger 2: a normal day, then a hot reading eight hours before its fault.
    readings = pd.DataFrame(
        [
            ("2019-12-05T20:00:00+00:00", "SWG1-002", "MeterValues", 3300.0, 22.0),
            ("2019-12-12T10:00:00+00:00", "SWG1-002", "MeterValues", 3300.0, 61.5),
        ],
        columns=["timestamp", "station_id", "action", "power_w", "temperature_c"],
    )
    # The last three columns are ML's answers; the converter must work without reading them.
    messages = pd.DataFrame(
        [
            ("2019-12-01T08:00:00+00:00", "SWG1-001", "StatusNotification", "Available", "NoError", None),
            ("2019-12-09T20:00:00+00:00", "SWG1-001", "MeterValues", None, None, 3300.0),
            ("2019-12-12T20:00:00+00:00", "SWG1-001", "MeterValues", None, None, 9900.0),  # above the rated 6.6 kW
            # Charger 2: a short network fault, then a high-temperature fault from 12 Dec 10:00 to 13 Dec 12:00.
            ("2019-12-12T16:00:00+00:00", "SWG1-002", "StatusNotification", "Faulted", "WeakSignal", None),
            ("2019-12-12T17:00:00+00:00", "SWG1-002", "StatusNotification", "Available", "NoError", None),
            ("2019-12-12T18:00:00+00:00", "SWG1-002", "StatusNotification", "Faulted", "HighTemperature", None),
            ("2019-12-13T20:00:00+00:00", "SWG1-002", "StatusNotification", "Available", "NoError", None),
            ("2019-12-12T18:00:00+00:00", "NWG1-001", "StatusNotification", "Faulted", "GroundFailure", None),
        ],
        columns=["timestamp", "station_id", "action", "status", "error_code", "power_w"],
    )
    pd.concat([messages, readings]).assign(
        voltage_v=None, current_a=None, rssi_dbm=None, fault_id="F0001", fault_type="HighTemperature", phase="fault"
    ).to_csv(synth_dir / "ocpp_events.csv", index=False)

    pd.DataFrame(
        [
            ("F0001", "SWG1-002", "HighTemperature", "ocpp", "2019-12-12T18:00:00+00:00", "2019-12-13T20:00:00+00:00"),
            ("S0001", "ARG1-001", "DamagedCable", "feedback_only", "2019-12-15T10:00:00+00:00", "2019-12-17T10:00:00+00:00"),
            ("F0002", "SWG1-001", "OverVoltage", "ocpp", "2019-06-01T10:00:00+00:00", "2019-06-01T12:00:00+00:00"),
            ("F0003", "NWG1-001", "GroundFailure", "ocpp", "2019-12-12T18:00:00+00:00", "2019-12-12T20:00:00+00:00"),
        ],
        columns=["fault_id", "station_id", "fault_type", "source", "onset", "end"],
    ).to_csv(synth_dir / "fault_ground_truth.csv", index=False)

    # Energy per 30-minute slot and charging sessions (times in UTC; 15:00 UTC is 07:00 in California).
    pd.DataFrame(
        [
            ("2019-12-12T20:00:00+00:00", "jpl/Arroyo_Garage_01", 10.0),  # 12 Dec, noon
            ("2019-12-13T14:30:00+00:00", "caltech/S_Wilson_Garage_01", 2.5),  # 13 Dec, 06:30 to 07:00
            ("2019-12-13T15:00:00+00:00", "caltech/S_Wilson_Garage_01", 4.0),  # 13 Dec, 07:00 to 07:30
            ("2019-12-13T15:00:00+00:00", "caltech/N_Wilson_Garage_01", 99.0),  # site with no forecast
            ("2019-11-01T15:00:00+00:00", "caltech/S_Wilson_Garage_01", 50.0),  # long before the forecast days
        ],
        columns=["timestamp", "site", "energy_kwh"],
    ).assign(power_kw=0.0, split="test").to_csv(synth_dir / "site_load_30min.csv", index=False)
    pd.DataFrame(
        [
            ("caltech/S_Wilson_Garage_01", "2019-12-13T14:00:00+00:00", "2019-12-13T18:00:00+00:00"),  # 06:00 to 10:00
            ("jpl/Arroyo_Garage_01", "2019-12-13T16:00:00+00:00", "2019-12-13T20:00:00+00:00"),  # starts at 08:00
            ("jpl/Arroyo_Garage_01", "2019-12-12T15:00:00+00:00", "2019-12-12T23:00:00+00:00"),  # the day before
            ("caltech/N_Wilson_Garage_01", "2019-12-13T14:00:00+00:00", "2019-12-13T18:00:00+00:00"),  # no forecast
        ],
        columns=["site_path", "connectionTime", "disconnectTime"],
    ).assign(kWhDelivered=5.0).to_csv(synth_dir / "acn_sessions.csv", index=False)

    # ML's cleaned feedback: keep = the comment is negative and not spam, whatever the star rating says.
    pd.DataFrame(
        [
            ("2019-12-15T18:00:00+00:00", "ARG1-001", "Won't start", 1, "negative", False, True),
            ("2019-12-16T18:00:00+00:00", "ARG1-001", "Other", 5, "negative", False, True),  # a complaint with 5 stars
            ("2019-12-16T19:00:00+00:00", "ARG1-001", "Other", 5, "positive", False, False),  # praise
            ("2019-12-14T18:00:00+00:00", "SWG1-001", "Blocked by non-EV", 1, "negative", False, True),
            ("2019-12-15T18:00:00+00:00", "SWG1-001", "Cleanliness", 2, "negative", False, True),
            ("2019-12-15T19:00:00+00:00", "SWG1-001", "Other", 1, None, True, False),  # spam
            ("2019-12-15T20:00:00+00:00", "SWG1-001", "Payment issue", 1, "negative", False, True),
            ("2019-12-15T21:00:00+00:00", "NWG1-001", "Won't start", 1, "negative", False, True),  # no forecast here
            ("2019-11-01T18:00:00+00:00", "SWG1-002", "Won't start", 1, "negative", False, True),  # long before
        ],
        columns=["timestamp", "station_id", "category", "rating", "sentiment", "is_spam", "keep"],
    ).assign(free_text="text", ground_truth_origin="baseline", noise=None).to_csv(
        synth_dir / "feedback_clean.csv", index=False
    )


@pytest.fixture(scope="module")
def data_dir(tmp_path_factory: pytest.TempPathFactory) -> str:
    """ML's files (small copies), converted once for the tests below."""
    raw_dir = tmp_path_factory.mktemp("raw")
    out_dir = tmp_path_factory.mktemp("data")
    _write_ml_files(raw_dir)
    _write_synth_files(raw_dir / "acn_synth")
    convert(str(raw_dir), str(out_dir))
    return str(out_dir)


def test_convert_ml_outputs(data_dir: str) -> None:
    assert check(data_dir) == []
    data = data_loader.load_all(data_dir)

    # Station details come from ML's station_profile.csv; the position is the average of its chargers.
    assert list(data.stations["station_id"]) == ["stn_001", "stn_002"]
    assert list(data.stations["name"]) == ["Caltech South Wilson Garage", "JPL Arroyo Garage"]
    assert list(data.stations["n_chargers"]) == [4, 52]
    assert list(data.stations["power_kw"]) == [6.7, 6.7]
    assert list(data.stations["lat"]) == [34.1382, 34.2003]
    assert charge_min(data, "stn_001") == 145.6
    assert charge_min(data, "stn_002") == 222.4

    assert data.forecasts["slot_start"].iloc[0].isoformat() == "2019-12-10T00:00:00-08:00"

    # ML's prediction is used as it is; holidays are labelled but not multiplied.
    assert set(data.forecasts["arrivals"]) == {0.5, 1.5}

    assert data.meta["currency"] == "USD"
    # near_holiday days are not festive: the period is the holiday itself.
    assert data.meta["festive_periods"][0] == {
        "name": "Christmas", "start": "2019-12-25T00:00:00-08:00", "end": "2019-12-25T23:30:00-08:00",
    }
    # Demo times, most interesting first, all at the busiest hour (7am in this file): the day with
    # the safety fault, the busiest day and the Sunday before it. "Most chargers down" would be the
    # same day as the safety fault here, so it is not listed twice.
    assert data.meta["demo_times"][0] == {"label": "Safety faults", "time": "2019-12-13T07:00:00-08:00"}
    assert [d["label"] for d in data.meta["demo_times"]] == ["Safety faults", "Weekday morning rush", "Quiet Sunday"]
    assert all(d["time"].endswith("T07:00:00-08:00") for d in data.meta["demo_times"])


def test_convert_sensor_log_faults_and_feedback(data_dir: str) -> None:
    data = data_loader.load_all(data_dir)

    # ML's charger ids become ours; the charger at the site with no forecast is gone.
    assert set(data.health["charger_id"]) == {"stn_001_c1", "stn_001_c2", "stn_002_c1"}

    # Charger 2 is faulty on the days its "Faulted" status covers, with the worse of its two faults, then recovers.
    charger = data.health_by_charger["stn_001_c2"].set_index("date")
    assert list(charger.loc[date(2019, 12, 11):date(2019, 12, 14), "status"]) == [
        "healthy", "safety_fault", "safety_fault", "healthy",
    ]
    assert charger.loc[date(2019, 12, 12), "evidence"] == ["Charger reported HighTemperature on 12 Dec"]
    assert list(charger.loc[date(2019, 12, 12):date(2019, 12, 14), "p_fault"]) == [1.0, 1.0, 0.0]

    # Power ratio: 3.3 kW of 6.6 kW, then a reading above rated power is capped, then carried forward.
    ratio = data.health_by_charger["stn_001_c1"].set_index("date")["power_ratio"]
    assert list(ratio.loc[date(2019, 12, 11):date(2019, 12, 13)]) == [0.5, 1.0, 1.0]

    # Real faults: only the ones inside the forecast days, on chargers we kept, with ML's own fault names.
    assert data.fault_labels.to_dict("records") == [
        {"charger_id": "stn_001_c2", "fault_type": "HighTemperature",
         "start_date": date(2019, 12, 12), "end_date": date(2019, 12, 13)},
        {"charger_id": "stn_002_c1", "fault_type": "DamagedCable",
         "start_date": date(2019, 12, 15), "end_date": date(2019, 12, 17)},
    ]

    # Driver feedback: only complaints about the charger itself become reports. The blocked-bay,
    # cleanliness and payment complaints on stn_001_c1 do not.
    assert list(data.user_reports["charger_id"]) == ["stn_002_c1", "stn_002_c1"]
    assert list(data.user_reports.columns) == ["charger_id", "reported_at"]
    assert data.user_reports["reported_at"].iloc[0].isoformat() == "2019-12-15T10:00:00-08:00"

    # Charger log: its fault messages, the reading that goes with the fault, and when it came back.
    log = data.events_by_charger["stn_001_c2"]
    assert list(zip(log["time"].dt.strftime("%d %H:%M"), log["source"], log["message"])) == [
        ("12 02:00", "sensor", "Cable temperature reached 61.5 °C (usual 22.0 °C)"),
        ("12 08:00", "sensor", "Charger reported WeakSignal"),
        ("12 09:00", "sensor", "Charger back to Available after WeakSignal"),
        ("12 10:00", "sensor", "Charger reported HighTemperature"),
        ("13 12:00", "sensor", "Charger back to Available after HighTemperature"),
    ]
    # Driver reports about a charger carry the driver's own category and words.
    assert list(data.events_by_charger["stn_002_c1"]["message"]) == [
        "Driver report (Won't start): text", "Driver report (Other): text",
    ]
    assert "stn_001_c1" not in data.events_by_charger  # bay and payment complaints are not charger events

    # Energy and sessions: ML's sites become our stations, times become California time,
    # and the site without a forecast and the rows long before the forecast days are gone.
    assert data.energy.to_dict("records") == [
        {"station_id": "stn_002", "slot_start": pd.Timestamp("2019-12-12T12:00:00-08:00"), "energy_kwh": 10.0},
        {"station_id": "stn_001", "slot_start": pd.Timestamp("2019-12-13T06:30:00-08:00"), "energy_kwh": 2.5},
        {"station_id": "stn_001", "slot_start": pd.Timestamp("2019-12-13T07:00:00-08:00"), "energy_kwh": 4.0},
    ]
    assert list(data.sessions["station_id"]) == ["stn_001", "stn_002", "stn_002"]
    assert data.sessions["started_at"].iloc[0].isoformat() == "2019-12-13T06:00:00-08:00"

    # Pie chart data: every row ML kept (all chargers, all dates); praise and spam are gone, "Other" stays.
    assert data.report_categories == [
        {"category": "Won't start", "count": 3, "percentage": 42.9},
        {"category": "Other", "count": 1, "percentage": 14.3},
        {"category": "Blocked by non-EV", "count": 1, "percentage": 14.3},
        {"category": "Cleanliness", "count": 1, "percentage": 14.3},
        {"category": "Payment issue", "count": 1, "percentage": 14.3},
    ]


def test_app_answers_on_converted_files(data_dir: str) -> None:
    data = data_loader.load_all(data_dir)

    app.dependency_overrides[get_data] = lambda: data
    try:
        client = TestClient(app)
        demo_time = data.meta["demo_times"][0]["time"]
        assert client.get("/api/meta").json()["currency"] == "USD"
        assert client.get("/api/stations", params={"time": demo_time}).status_code == 200
        assert client.get("/api/actions", params={"time": demo_time}).status_code == 200
        assert client.get("/api/reports/categories").json()[0]["category"] == "Won't start"

        # Backtest: the fault on 12 Dec was really repaired on 13 Dec; we repair it the day the sensors flag it.
        result = client.get("/api/backtest").json()
        assert result["week_label"] == "Week of 11 Dec 2019"
        by_day = {d["date"]: d for d in result["daily"]}
        assert by_day["2019-12-12"]["wait_ours_min"] == by_day["2019-12-12"]["wait_baseline_min"]
        assert by_day["2019-12-13"]["wait_ours_min"] < by_day["2019-12-13"]["wait_baseline_min"]
        assert result["queue_minutes_saved"] > 0

        # While the sensor fault is on, it is the first action and the station has one charger fewer.
        during = "2019-12-13T07:00:00-08:00"
        actions = client.get("/api/actions", params={"time": during}).json()
        assert actions[0]["id"] == "safety_fault:stn_001:stn_001_c2"
        assert "Charger reported HighTemperature on 12 Dec" in actions[0]["reason"]
        stations = {s["id"]: s for s in client.get("/api/stations", params={"time": during}).json()}
        assert stations["stn_001"]["n_working"] == 3
        health = client.get("/api/chargers/stn_001_c2/health", params={"time": during}).json()
        assert (health["status"], health["degraded_since"]) == ("safety_fault", "2019-12-12")

        # The station's charger list comes from the sensor data: two of its four chargers, with their status.
        chargers = client.get("/api/stations/stn_001/chargers", params={"time": during}).json()
        assert [(c["charger_id"], c["status"]) for c in chargers] == [
            ("stn_001_c1", "healthy"), ("stn_001_c2", "safety_fault"),
        ]
        assert chargers[0]["power_kw"] == 6.7

        # The charger's log at 07:00 on 13 Dec, newest first. Its recovery at noon has not happened yet.
        events = client.get("/api/chargers/stn_001_c2/events", params={"time": during}).json()
        assert [e["message"] for e in events] == [
            "Charger reported HighTemperature",
            "Charger back to Available after WeakSignal",
            "Charger reported WeakSignal",
            "Cable temperature reached 61.5 °C (usual 22.0 °C)",
        ]
        assert events[0] == {
            "time": "2019-12-12T10:00:00-08:00", "source": "sensor", "message": "Charger reported HighTemperature",
        }
        assert client.get("/api/chargers/stn_001_c1/events", params={"time": during}).json() == []
        assert client.get("/api/chargers/stn_999_c1/events", params={"time": during}).status_code == 404

        # Overview at 07:00 on 13 Dec: only what has happened by then is counted.
        overview = client.get("/api/overview", params={"time": during}).json()
        assert overview["data_source"] == "api"
        assert overview["energy_delivered_kwh"] == 2.5  # the 06:30 slot has ended, the 07:00 slot has not
        assert [point["kwh"] for point in overview["energy_trend"][-2:]] == [10.0, 2.5]
        assert overview["energy_delivered_week_kwh"] == 12.5
        assert overview["live_sessions"] == 1  # plugged in since 06:00; the 08:00 session has not started
        assert overview["network_uptime_pct"] == 83.3  # 12 charger-days this week, 2 with a fault
        half_an_hour_later = client.get("/api/overview", params={"time": "2019-12-13T07:30:00-08:00"}).json()
        assert half_an_hour_later["energy_delivered_kwh"] == 6.5

        # Backtest weeks: the default first, then the Mondays inside the data.
        weeks = [w["value"] for w in client.get("/api/meta").json()["backtest_weeks"]]
        assert weeks == ["2019-12-11", "2019-12-16", "2019-12-23"]
        assert client.get("/api/backtest", params={"week": "2019-12-16"}).json()["week_label"] == "Week of 16 Dec 2019"

        # Afterwards the charger is healthy again; the reports about a charger give one more action.
        after = "2019-12-16T12:00:00-08:00"
        health = client.get("/api/chargers/stn_001_c2/health", params={"time": after}).json()
        assert (health["status"], health["degraded_since"]) == ("healthy", None)
        actions = {a["id"]: a for a in client.get("/api/actions", params={"time": after}).json()}
        assert actions["user_reported:stn_002:stn_002_c1"]["report_count"] == 2
        # Complaints about the bay (blocked, dirty) no longer create an action.
        assert not any(a["charger_id"] == "stn_001_c1" for a in actions.values())
        assert not any(a["issue_type"] == "site_issue" for a in actions.values())
    finally:
        app.dependency_overrides.clear()


def test_converted_params_have_no_tolerable_wait(data_dir: str) -> None:
    assert data_loader.load_params(data_dir) == {"avg_charge_min": 184.0, "rm_per_session": 10.0}


def test_committed_real_data_matches_the_contract() -> None:
    """backend/data holds ML's real converted files; they must stay loadable."""
    real_dir = str(Path(__file__).resolve().parents[1] / "data")
    assert check(real_dir) == []
    assert "max_tolerable_wait_min" not in data_loader.load_params(real_dir)
    assert list(data_loader.load_user_reports(real_dir).columns) == ["charger_id", "reported_at"]
    assert len(data_loader.load_energy(real_dir)) > 0 and len(data_loader.load_sessions(real_dir)) > 0
