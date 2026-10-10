"""Arrivals per 30-minute slot -> expected wait (M/M/c queue) and sessions the chargers can serve.

Two separate questions, answered separately:
- How long is the queue?         predict_wait, shown on the dashboard and used to spot congestion.
- How many sessions get served?  service_capacity, served_sessions, unserved_sessions: used for money.
Money is never worked out from how long drivers wait.
"""

from math import factorial

SLOT_MIN = 30
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


def service_capacity(avg_charge_min: float, working_chargers: int, slot_minutes: int = SLOT_MIN) -> float:
    """Sessions the working chargers can serve in one slot: chargers x slot length / charge time."""
    if working_chargers <= 0 or avg_charge_min <= 0:
        return 0.0
    return working_chargers * slot_minutes / avg_charge_min


def served_sessions(arrivals: float, avg_charge_min: float, working_chargers: int) -> float:
    """Forecast arrivals the chargers can serve in one slot. A fraction is fine: it is a forecast."""
    return min(max(arrivals, 0.0), service_capacity(avg_charge_min, working_chargers))


def unserved_sessions(arrivals: float, avg_charge_min: float, working_chargers: int) -> float:
    """Forecast arrivals above capacity in one slot: an estimate, not observed customers who left."""
    return max(0.0, arrivals - service_capacity(avg_charge_min, working_chargers))
