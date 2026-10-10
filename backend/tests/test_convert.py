import json

import pandas as pd
from fastapi.testclient import TestClient

from app.api.deps import get_data
from app.main import app
from app.services import data_loader
from scripts.check_data import check
from scripts.convert_ml_outputs import convert


def _write_ml_files(raw_dir) -> None:
    """A small file shaped like ML's model1_test_predictions.csv (US data, UTC slots)."""
    slots = pd.date_range("2019-12-10 08:00", "2019-12-31 07:30", freq="30min", tz="UTC")
    rows = []
    for station in ("caltech", "jpl"):
        for slot in slots:
            local_day = slot.tz_convert("America/Los_Angeles").date()
            rows.append({
                "station": station, "slot_utc": str(slot), "slot_local": str(slot.tz_convert("America/Los_Angeles")),
                "arrivals": 2, "pred": 1.5, "baseline_last_week": 1.0,
                "is_holiday": int(str(local_day) == "2019-12-25"),
                "near_holiday": int(str(local_day) in ("2019-12-23", "2019-12-24", "2019-12-26")),
                "wait_min_all_up": 3.0, "wait_min_one_down": 9.0,
            })
    pd.DataFrame(rows).to_csv(raw_dir / "model1_test_predictions.csv", index=False)
    (raw_dir / "model1_metrics.json").write_text(json.dumps({"festive_multiplier_assumed": 2.0}))


def test_convert_ml_outputs(tmp_path) -> None:
    raw_dir = tmp_path / "raw"
    raw_dir.mkdir()
    _write_ml_files(raw_dir)
    convert(str(raw_dir), str(tmp_path))

    assert check(str(tmp_path)) == []
    data = data_loader.load_all(str(tmp_path))

    assert list(data.stations["station_id"]) == ["stn_001", "stn_002"]
    assert list(data.stations["name"]) == ["Caltech", "JPL"]
    assert data.forecasts["slot_start"].iloc[0].isoformat() == "2019-12-10T00:00:00-08:00"

    # Festive slots get the assumed multiplier; normal slots keep ML's prediction.
    festive = data.forecasts[data.forecasts["is_festive"]]
    assert set(festive["arrivals"]) == {3.0}
    assert set(data.forecasts[~data.forecasts["is_festive"]]["arrivals"]) == {1.5}

    assert data.meta["currency"] == "USD"
    assert data.meta["festive_periods"][0]["name"] == "Christmas"
    assert data.meta["festive_periods"][0]["start"] == "2019-12-23T00:00:00-08:00"
    assert [d["label"] for d in data.meta["demo_times"]] == ["Normal Tuesday", "Day before Christmas"]

    # The app answers on the converted files at a demo time.
    app.dependency_overrides[get_data] = lambda: data
    try:
        client = TestClient(app)
        demo_time = data.meta["demo_times"][1]["time"]
        assert client.get("/api/meta").json()["currency"] == "USD"
        assert client.get("/api/stations", params={"time": demo_time}).status_code == 200
        assert client.get("/api/actions", params={"time": demo_time}).status_code == 200
    finally:
        app.dependency_overrides.clear()
