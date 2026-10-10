"""M/M/c queueing: arrivals per 30-minute slot -> expected wait and lost sessions."""

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


def lost_sessions(arrivals: float, wait_min: float, max_tolerable_min: float) -> float:
    """Cars that give up because the wait is longer than they tolerate.

    Assumption: the share that leaves grows with how far the wait exceeds the limit.
    """
    if wait_min <= max_tolerable_min:
        return 0.0
    return round(arrivals * (1 - max_tolerable_min / wait_min), 1)
