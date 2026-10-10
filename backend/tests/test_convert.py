import pandas as pd
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


def test_convert_ml_outputs(tmp_path) -> None:
    raw_dir = tmp_path / "raw"
    raw_dir.mkdir()
    _write_ml_files(raw_dir)
    convert(str(raw_dir), str(tmp_path))

    assert check(str(tmp_path)) == []
    data = data_loader.load_all(str(tmp_path))

    # Station details come from ML's station_profile.csv.
    assert list(data.stations["station_id"]) == ["stn_001", "stn_002"]
    assert list(data.stations["name"]) == ["Caltech South Wilson Garage", "JPL Arroyo Garage"]
    assert list(data.stations["n_chargers"]) == [4, 52]
    assert list(data.stations["power_kw"]) == [6.7, 6.7]
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
    # Demo times: the busiest day and the Sunday before it, at the busiest hour (7am in this file).
    assert [d["label"] for d in data.meta["demo_times"]] == ["Quiet Sunday", "Weekday morning rush"]
    assert all(d["time"].endswith("T07:00:00-08:00") for d in data.meta["demo_times"])

    # The app answers on the converted files at a demo time.
    app.dependency_overrides[get_data] = lambda: data
    try:
        client = TestClient(app)
        demo_time = data.meta["demo_times"][0]["time"]
        assert client.get("/api/meta").json()["currency"] == "USD"
        assert client.get("/api/stations", params={"time": demo_time}).status_code == 200
        assert client.get("/api/actions", params={"time": demo_time}).status_code == 200
        assert client.get("/api/backtest").status_code == 200
    finally:
        app.dependency_overrides.clear()
