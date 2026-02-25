"""Unit tests for allocation configuration."""

import pytest
from config.allocations import ALLOCATIONS, validate_allocations


def test_allocations_sum_to_one():
    total = sum(ALLOCATIONS.values())
    assert abs(total - 1.0) < 1e-9, f"Allocations sum to {total}, expected 1.0"


def test_all_expected_assets_present():
    expected = {"HYPE", "SOL", "BTC", "ZEC"}
    assert set(ALLOCATIONS.keys()) == expected


def test_all_weights_positive():
    for symbol, weight in ALLOCATIONS.items():
        assert weight > 0, f"{symbol} weight must be positive"


def test_validate_allocations_raises_on_bad_sum():
    with pytest.raises(ValueError, match="must sum to 1.0"):
        validate_allocations({"BTC": 0.5, "SOL": 0.3})  # sums to 0.8


def test_validate_allocations_passes_on_valid():
    validate_allocations({"BTC": 0.5, "SOL": 0.5})
