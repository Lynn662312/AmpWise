"""Arrivals per 30-minute slot -> expected wait (M/M/c queue) and sessions the chargers can serve.

Two separate questions, answered separately:
- How long is the queue?         predict_wait, shown on the dashboard and used to spot congestion.
- How many sessions get served?  served_by_occupancy, used for money: a car is served when a charger
                                 is free, and then holds it for the charge time.
Money is never worked out from how long drivers wait.

The forecast gives averages (0.4 cars in a half hour). Real cars come in ones and twos, and it is the
bunches that fill a station. So expected_unserved replays the coming hours many times with whole cars
arriving at random around the forecast, and averages what is not served.
"""

from collections.abc import Sequence
from math import factorial

import numpy as np

SLOT_MIN = 30
RUNS = 500  # how many random versions of the coming hours are averaged
SEED = 0  # fixed, so the same forecast always gives the same answer
# Assumption: when demand is at or above capacity the queue never settles,
# so the wait is reported as this cap instead of infinity.
MAX_WAIT_MIN = 120.0


def erlang_c(lam: float, mu: float, c: int) -> float:
    """Probability that an arriving car has to wait.

    lam = arrival rate, mu = service rate of one charger (same time unit), c = chargers.
    """
    if lam <= 0:
        return 0.0
    if c <= 0 or mu <= 0:
        return 1.0
    a = lam / mu
    rho = a / c
    if rho >= 1:
        return 1.0
    below = sum(a**k / factorial(k) for k in range(c))
    top = a**c / factorial(c) / (1 - rho)
    return top / (below + top)


def predict_wait(arrivals: float, avg_charge_min: float, working_chargers: int) -> float:
    """Expected wait in minutes for one 30-minute slot."""
    if arrivals <= 0:
        return 0.0
    lam = arrivals / SLOT_MIN  # cars per minute
    mu = 1 / avg_charge_min  # cars per minute per charger
    spare = working_chargers * mu - lam
    if spare <= 0:
        return MAX_WAIT_MIN
    wait = erlang_c(lam, mu, working_chargers) / spare
    return round(min(wait, MAX_WAIT_MIN), 1)


def served_by_occupancy(
    arrivals: Sequence[float], avg_charge_min: float, working_chargers: int, earlier: Sequence[float] = ()
) -> list[float]:
    """Sessions served in each slot. A car is served when a charger is free, then holds it for the charge time.

    What is not served (arrivals minus this) is an estimate, not observed customers who left.
    `earlier` are the arrivals in the slots just before the first one: those cars may still be charging.
    A session counts from the start of the slot it arrives in. Fractions are fine: these are forecasts.
    """
    cars = np.array([*earlier, *arrivals], dtype=float)
    return _walk(cars, avg_charge_min, working_chargers)[len(earlier):].tolist()


def expected_unserved(
    arrivals: Sequence[float], avg_charge_min: float, working_chargers: int, earlier: Sequence[float] = ()
) -> list[float]:
    """Sessions expected not to be served in each slot, when the cars arrive at random around the forecast.

    Each of the RUNS versions draws whole cars per slot (Poisson, the same assumption the queue model
    makes) and is walked through like served_by_occupancy; the result is the average over the versions.
    The draws depend only on the forecast, so two charger counts are compared on the very same cars.
    """
    forecast = np.clip(np.array([*earlier, *arrivals], dtype=float), 0.0, None)
    cars = np.random.default_rng(SEED).poisson(forecast[:, None], size=(len(forecast), RUNS)).astype(float)
    missed = cars - _walk(cars, avg_charge_min, working_chargers)
    return missed[len(earlier):].mean(axis=1).tolist()


def _walk(cars: np.ndarray, avg_charge_min: float, working_chargers: int) -> np.ndarray:
    """Sessions served per slot. `cars` has one row per slot (and, optionally, one column per version)."""
    cars = np.clip(cars, 0.0, None)
    if avg_charge_min <= 0:
        return cars if working_chargers > 0 else np.zeros_like(cars)
    length = avg_charge_min / SLOT_MIN  # slots one session holds a charger, the slot it starts in included
    held = max(length - 1, 0.0)  # slots it still holds the charger after that first slot
    whole, part = int(held), held - int(held)
    turnover = max(1.0, 1 / length)  # a charge shorter than a slot lets one charger start several sessions in it
    served = np.zeros_like(cars)
    for i in range(len(cars)):
        # Chargers still held by the cars served in the slots before this one.
        busy = served[max(0, i - whole):i].sum(axis=0) + (part * served[i - whole - 1] if i > whole else 0.0)
        served[i] = np.minimum(cars[i], np.maximum(0.0, working_chargers - busy) * turnover)
    return served
