import pytest

from app.services.queueing import MAX_WAIT_MIN, erlang_c, predict_wait, served_by_occupancy


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


def test_a_car_is_served_only_when_a_charger_is_free() -> None:
    # Two chargers, a 60-minute charge (two slots). Two cars arrive and take both chargers;
    # the car in the next slot finds them busy; in the third slot they are free again.
    assert served_by_occupancy([2, 1, 1], avg_charge_min=60, working_chargers=2) == [2, 0, 1]


def test_a_long_charge_holds_the_charger_for_several_slots() -> None:
    # A 90-minute charge holds the charger for three slots.
    assert served_by_occupancy([2, 1, 1, 1], avg_charge_min=90, working_chargers=2) == [2, 0, 0, 1]


def test_demand_that_fits_the_free_chargers_is_all_served() -> None:
    assert served_by_occupancy([1, 0.5, 1.5], avg_charge_min=30, working_chargers=2) == [1, 0.5, 1.5]
    # A burst into empty chargers is served, however long the charge is: this is where the old
    # per-half-hour rule went wrong.
    assert served_by_occupancy([4], avg_charge_min=240, working_chargers=4) == [4]


def test_one_more_charger_serves_one_more_car_when_the_station_is_full() -> None:
    assert served_by_occupancy([3, 3], avg_charge_min=60, working_chargers=2) == [2, 0]
    assert served_by_occupancy([3, 3], avg_charge_min=60, working_chargers=3) == [3, 0]
    assert served_by_occupancy([3, 3], avg_charge_min=60, working_chargers=4) == [3, 1]


def test_cars_from_before_the_first_slot_still_hold_chargers() -> None:
    # Two cars arrived one slot earlier and are still charging: nothing is free.
    assert served_by_occupancy([2], avg_charge_min=60, working_chargers=2, earlier=[2]) == [0]
    # Two slots earlier: they have finished.
    assert served_by_occupancy([2], avg_charge_min=60, working_chargers=2, earlier=[2, 0]) == [2]


def test_a_charge_shorter_than_a_slot_lets_one_charger_serve_several_cars() -> None:
    # A 15-minute charge: each charger can start two sessions in a 30-minute slot.
    assert served_by_occupancy([3, 5], avg_charge_min=15, working_chargers=2) == [3, 4]


def test_no_chargers_means_nothing_is_served() -> None:
    assert served_by_occupancy([2, 0, 1], avg_charge_min=60, working_chargers=0) == [0, 0, 0]


def test_unserved_does_not_depend_on_the_wait() -> None:
    # 3.9 cars into 2 empty chargers with a 15-minute charge: a long queue is predicted,
    # but every car still gets a charger within the half hour.
    assert predict_wait(arrivals=3.9, avg_charge_min=15, working_chargers=2) > 15
    assert served_by_occupancy([3.9], avg_charge_min=15, working_chargers=2) == [3.9]
