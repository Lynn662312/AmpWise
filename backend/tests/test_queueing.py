import pytest

from app.services.queueing import (
    MAX_WAIT_MIN,
    erlang_c,
    predict_wait,
    served_sessions,
    service_capacity,
    unserved_sessions,
)


def test_erlang_c_one_charger_equals_utilisation() -> None:
    # M/M/1: probability of waiting is lam / mu.
    assert erlang_c(lam=2, mu=3, c=1) == pytest.approx(2 / 3)


def test_erlang_c_two_chargers_textbook_value() -> None:
    assert erlang_c(lam=1, mu=1, c=2) == pytest.approx(1 / 3)


def test_erlang_c_edge_cases() -> None:
    assert erlang_c(lam=0, mu=1, c=2) == 0.0
    assert erlang_c(lam=1, mu=1, c=0) == 1.0
    assert erlang_c(lam=5, mu=1, c=2) == 1.0  # demand above capacity


def test_predict_wait_known_value() -> None:
    # 10 cars per 30 min, 2-minute charge, 1 charger: M/M/1 wait = rho / (mu - lam) = 4 min.
    assert predict_wait(arrivals=10, avg_charge_min=2, working_chargers=1) == 4.0


def test_predict_wait_no_arrivals() -> None:
    assert predict_wait(arrivals=0, avg_charge_min=38, working_chargers=4) == 0.0


def test_predict_wait_capped_when_over_capacity_or_no_chargers() -> None:
    assert predict_wait(arrivals=20, avg_charge_min=38, working_chargers=4) == MAX_WAIT_MIN
    assert predict_wait(arrivals=1, avg_charge_min=38, working_chargers=0) == MAX_WAIT_MIN


def test_predict_wait_grows_with_arrivals_and_broken_chargers() -> None:
    assert predict_wait(2.5, 38, 4) > predict_wait(1.5, 38, 4)
    assert predict_wait(2.0, 38, 3) > predict_wait(2.0, 38, 4)


def test_service_capacity_is_chargers_times_slot_over_charge_time() -> None:
    # A 30-minute charge: each charger serves one session per 30-minute slot.
    assert service_capacity(avg_charge_min=30, working_chargers=2) == 2.0
    # A 60-minute charge: each charger serves half a session per slot.
    assert service_capacity(avg_charge_min=60, working_chargers=3) == 1.5
    assert service_capacity(avg_charge_min=30, working_chargers=2, slot_minutes=60) == 4.0
    assert service_capacity(avg_charge_min=38, working_chargers=0) == 0.0


def test_demand_within_capacity_is_all_served() -> None:
    assert served_sessions(arrivals=1.5, avg_charge_min=30, working_chargers=2) == 1.5
    assert unserved_sessions(arrivals=1.5, avg_charge_min=30, working_chargers=2) == 0.0
    assert unserved_sessions(arrivals=2.0, avg_charge_min=30, working_chargers=2) == 0.0  # exactly at capacity


def test_demand_above_capacity_is_partly_unserved() -> None:
    # Capacity is 2 sessions; 3.5 are forecast, so 1.5 cannot be served. Fractions are fine.
    assert served_sessions(arrivals=3.5, avg_charge_min=30, working_chargers=2) == 2.0
    assert unserved_sessions(arrivals=3.5, avg_charge_min=30, working_chargers=2) == 1.5
    # One more charger serves one more session.
    assert unserved_sessions(arrivals=3.5, avg_charge_min=30, working_chargers=3) == 0.5


def test_no_chargers_means_nothing_is_served() -> None:
    assert served_sessions(arrivals=2.0, avg_charge_min=30, working_chargers=0) == 0.0
    assert unserved_sessions(arrivals=2.0, avg_charge_min=30, working_chargers=0) == 2.0
    assert unserved_sessions(arrivals=0.0, avg_charge_min=30, working_chargers=0) == 0.0


def test_unserved_does_not_depend_on_the_wait() -> None:
    # Demand just under capacity: a very long queue, but every session is still served.
    assert predict_wait(arrivals=1.99, avg_charge_min=30, working_chargers=2) > 45
    assert unserved_sessions(arrivals=1.99, avg_charge_min=30, working_chargers=2) == 0.0
