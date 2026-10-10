import pytest

from app.services.queueing import MAX_WAIT_MIN, erlang_c, lost_sessions, predict_wait


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


def test_lost_sessions() -> None:
    assert lost_sessions(arrivals=10, wait_min=30, max_tolerable_min=45) == 0.0
    assert lost_sessions(arrivals=10, wait_min=90, max_tolerable_min=45) == 5.0
