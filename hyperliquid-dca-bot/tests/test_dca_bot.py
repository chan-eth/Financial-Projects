"""
Unit tests for DCABot orchestrator logic.
Uses mocks so no real API calls are made.
"""

import pytest
from unittest.mock import MagicMock, patch, PropertyMock


@pytest.fixture
def mock_env(monkeypatch):
    monkeypatch.setenv("COINBASE_API_KEY", "test_key")
    monkeypatch.setenv("COINBASE_API_SECRET", "test_secret")
    monkeypatch.setenv("WALLET_PRIVATE_KEY", "0x" + "a" * 64)
    monkeypatch.setenv("ARBITRUM_WALLET_ADDRESS", "0x" + "b" * 40)
    monkeypatch.setenv("ARBITRUM_RPC_URL", "http://localhost:8545")
    monkeypatch.setenv("HYPERLIQUID_RPC_URL", "http://localhost:8546")


def make_bot(mock_env):
    """Create a DCABot with all external clients mocked."""
    with (
        patch("src.dca_bot.CoinbaseClient") as MockCB,
        patch("src.dca_bot.AcrossBridge") as MockBridge,
        patch("src.dca_bot.HyperliquidTrader") as MockTrader,
    ):
        from src.dca_bot import DCABot

        bot = DCABot(
            coinbase_api_key="key",
            coinbase_api_secret="secret",
            wallet_private_key="0x" + "a" * 64,
            arbitrum_wallet_address="0x" + "b" * 40,
            arbitrum_rpc_url="http://localhost:8545",
            hyperliquid_rpc_url="http://localhost:8546",
            daily_usdc_amount=25.0,
            testnet=True,
        )
        return bot, MockCB, MockBridge, MockTrader


def test_run_once_success(mock_env):
    with (
        patch("src.dca_bot.CoinbaseClient") as MockCB,
        patch("src.dca_bot.AcrossBridge") as MockBridge,
        patch("src.dca_bot.HyperliquidTrader") as MockTrader,
    ):
        from src.dca_bot import DCABot

        # Configure mocks
        cb_instance = MockCB.return_value
        cb_instance.get_usdc_balance.return_value = 100.0
        cb_instance.send_usdc_to_arbitrum.return_value = {"id": "cb_tx_123"}
        cb_instance._get_usdc_account_id.return_value = "acct_abc"
        cb_instance.wait_for_transaction.return_value = True

        bridge_instance = MockBridge.return_value
        bridge_instance.get_usdc_balance_arbitrum.return_value = 25.0
        bridge_instance.bridge_usdc.return_value = "0xarbtxhash"
        bridge_instance.wait_for_funds_on_hyperliquid.return_value = True

        trader_instance = MockTrader.return_value
        trader_instance.get_spot_balance_usdc.return_value = 24.5
        trader_instance.execute_dca.return_value = {
            "HYPE": {"status": "ok"},
            "SOL": {"status": "ok"},
            "BTC": {"status": "ok"},
            "ZEC": {"status": "ok"},
        }

        bot = DCABot(
            coinbase_api_key="key",
            coinbase_api_secret="secret",
            wallet_private_key="0x" + "a" * 64,
            arbitrum_wallet_address="0x" + "b" * 40,
            arbitrum_rpc_url="http://localhost:8545",
            hyperliquid_rpc_url="http://localhost:8546",
            daily_usdc_amount=25.0,
            testnet=True,
        )

        result = bot.run_once()
        assert result is True
        cb_instance.send_usdc_to_arbitrum.assert_called_once_with(
            destination_address="0x" + "b" * 40,
            amount_usd=25.0,
        )
        bridge_instance.bridge_usdc.assert_called_once_with(25.0)
        trader_instance.execute_dca.assert_called_once()


def test_run_once_fails_on_insufficient_balance(mock_env):
    with (
        patch("src.dca_bot.CoinbaseClient") as MockCB,
        patch("src.dca_bot.AcrossBridge"),
        patch("src.dca_bot.HyperliquidTrader"),
    ):
        from src.dca_bot import DCABot

        MockCB.return_value.get_usdc_balance.return_value = 10.0  # less than $25

        bot = DCABot(
            coinbase_api_key="key",
            coinbase_api_secret="secret",
            wallet_private_key="0x" + "a" * 64,
            arbitrum_wallet_address="0x" + "b" * 40,
            arbitrum_rpc_url="http://localhost:8545",
            hyperliquid_rpc_url="http://localhost:8546",
            daily_usdc_amount=25.0,
            testnet=True,
        )

        result = bot.run_once()
        assert result is False
