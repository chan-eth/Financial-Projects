"""
DCA allocation configuration.
Modify weights here to change how the daily USDC is split across assets.
Weights must sum to exactly 1.0.
"""

from typing import Dict


# Spot asset allocation weights (must sum to 1.0)
ALLOCATIONS: Dict[str, float] = {
    "HYPE": 0.40,   # Hyperliquid native token
    "SOL":  0.25,   # Solana
    "BTC":  0.20,   # Bitcoin
    "ZEC":  0.15,   # Zcash
}


def validate_allocations(allocs: Dict[str, float]) -> None:
    """Raise ValueError if allocations do not sum to 1.0."""
    total = sum(allocs.values())
    if abs(total - 1.0) > 1e-9:
        raise ValueError(
            f"Allocations must sum to 1.0, got {total:.10f}. "
            f"Difference: {total - 1.0:+.10f}"
        )


validate_allocations(ALLOCATIONS)
