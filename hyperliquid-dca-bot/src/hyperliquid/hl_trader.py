"""
Hyperliquid spot trading module.
Executes DCA spot buys of HYPE, ZEC, SOL, and BTC on Hyperliquid.

Uses the Hyperliquid Python SDK: https://github.com/hyperliquid-dex/hyperliquid-python-sdk
"""

import time
from decimal import Decimal, ROUND_DOWN
from typing import Optional
from eth_account import Account
from ..utils.logger import get_logger

logger = get_logger(__name__)

# DCA allocation weights (must sum to 1.0)
DCA_ALLOCATIONS = {
    "HYPE": 0.40,   # 40% — native token, highest conviction
    "SOL":  0.25,   # 25%
    "BTC":  0.20,   # 20%
    "ZEC":  0.15,   # 15%
}

# Minimum order sizes on Hyperliquid spot (USD notional)
MIN_ORDER_USD = {
    "HYPE": 1.0,
    "SOL":  1.0,
    "BTC":  1.0,
    "ZEC":  1.0,
}

# Slippage tolerance: accept fills up to 1% worse than mid price
SLIPPAGE_BPS = 100  # 1%


class HyperliquidTrader:
    """
    Executes spot market buys on Hyperliquid using the official SDK.
    """

    def __init__(self, private_key: str, testnet: bool = False):
        """
        Initialize the Hyperliquid trader.

        Args:
            private_key: EVM private key (same wallet bridged to).
            testnet: If True, connect to Hyperliquid testnet.
        """
        # Import here so SDK errors are caught at runtime, not import time
        from hyperliquid.exchange import Exchange
        from hyperliquid.info import Info
        from hyperliquid.utils import constants

        self.account = Account.from_key(private_key)
        self.wallet_address = self.account.address

        base_url = constants.TESTNET_API_URL if testnet else constants.MAINNET_API_URL

        self.info = Info(base_url, skip_ws=True)
        self.exchange = Exchange(self.account, base_url)

        logger.info(
            f"HyperliquidTrader initialized. Wallet: {self.wallet_address} "
            f"({'testnet' if testnet else 'mainnet'})"
        )

    def get_spot_balance_usdc(self) -> float:
        """Return the spot USDC balance available for trading."""
        user_state = self.info.spot_user_state(self.wallet_address)
        for balance in user_state.get("balances", []):
            if balance.get("coin") == "USDC":
                return float(balance.get("hold", 0)) + float(balance.get("total", 0))
        return 0.0

    def get_mid_price(self, symbol: str) -> Optional[float]:
        """
        Fetch the current mid price for a spot asset.

        Args:
            symbol: Ticker symbol (e.g., 'BTC', 'SOL').

        Returns:
            Mid price in USDC, or None if unavailable.
        """
        try:
            metas = self.info.spot_meta_and_asset_ctxs()
            universe = metas[0].get("universe", [])
            asset_ctxs = metas[1]

            for i, asset in enumerate(universe):
                if asset.get("name") == symbol and i < len(asset_ctxs):
                    ctx = asset_ctxs[i]
                    mid = ctx.get("midPx")
                    if mid:
                        return float(mid)
            logger.warning(f"Could not find mid price for {symbol}")
            return None
        except Exception as e:
            logger.error(f"Error fetching mid price for {symbol}: {e}")
            return None

    def get_asset_index(self, symbol: str) -> Optional[int]:
        """Get the spot asset index for a given symbol."""
        metas = self.info.spot_meta_and_asset_ctxs()
        universe = metas[0].get("universe", [])
        for i, asset in enumerate(universe):
            if asset.get("name") == symbol:
                return i
        return None

    def buy_spot(self, symbol: str, usdc_amount: float) -> dict:
        """
        Execute a spot market buy on Hyperliquid.

        Args:
            symbol: Coin symbol to buy (e.g., 'BTC').
            usdc_amount: USDC amount to spend.

        Returns:
            Order response dict.
        """
        if usdc_amount < MIN_ORDER_USD.get(symbol, 1.0):
            raise ValueError(
                f"Order size ${usdc_amount:.2f} is below minimum for {symbol}"
            )

        mid_price = self.get_mid_price(symbol)
        if mid_price is None:
            raise RuntimeError(f"Cannot get price for {symbol}, aborting buy")

        # Calculate quantity with slippage-adjusted limit price
        slippage_factor = 1 + SLIPPAGE_BPS / 10_000
        limit_price = mid_price * slippage_factor

        # Determine decimal precision from asset metadata
        sz_decimals = self._get_size_decimals(symbol)
        quantity = Decimal(str(usdc_amount / limit_price)).quantize(
            Decimal(10) ** -sz_decimals, rounding=ROUND_DOWN
        )

        logger.info(
            f"Buying {float(quantity):.{sz_decimals}f} {symbol} "
            f"@ limit ${limit_price:.4f} (mid: ${mid_price:.4f}, "
            f"notional: ${usdc_amount:.2f})"
        )

        # Place IOC (Immediate-or-Cancel) market-like order
        order_result = self.exchange.order(
            symbol,
            is_buy=True,
            sz=float(quantity),
            limit_px=round(limit_price, 6),
            order_type={"limit": {"tif": "Ioc"}},
            reduce_only=False,
        )

        status = order_result.get("status", "unknown")
        if status == "ok":
            filled = order_result.get("response", {}).get("data", {}).get("statuses", [{}])[0]
            logger.info(f"Buy order for {symbol} filled: {filled}")
        else:
            logger.error(f"Buy order for {symbol} failed: {order_result}")

        return order_result

    def execute_dca(self, total_usdc: float) -> dict:
        """
        Execute a full DCA cycle across all configured assets.

        Allocates the total USDC amount according to DCA_ALLOCATIONS weights
        and places spot market buys for HYPE, ZEC, SOL, and BTC.

        Args:
            total_usdc: Total USDC to distribute across all assets.

        Returns:
            Dict mapping symbol -> order result.
        """
        logger.info(
            f"Starting DCA execution. Total: ${total_usdc:.2f} USDC across "
            f"{list(DCA_ALLOCATIONS.keys())}"
        )

        results = {}
        for symbol, weight in DCA_ALLOCATIONS.items():
            allocation = total_usdc * weight
            logger.info(f"  {symbol}: ${allocation:.2f} ({weight*100:.0f}%)")

            if allocation < MIN_ORDER_USD.get(symbol, 1.0):
                logger.warning(f"  Skipping {symbol}: allocation ${allocation:.2f} below minimum")
                results[symbol] = {"status": "skipped", "reason": "below_minimum"}
                continue

            try:
                result = self.buy_spot(symbol, allocation)
                results[symbol] = result
                # Small delay between orders to avoid rate limits
                time.sleep(0.5)
            except Exception as e:
                logger.error(f"  Failed to buy {symbol}: {e}")
                results[symbol] = {"status": "error", "error": str(e)}

        logger.info("DCA execution complete.")
        self._log_summary(results, total_usdc)
        return results

    def _get_size_decimals(self, symbol: str) -> int:
        """Get the number of decimal places for sizing an asset."""
        try:
            metas = self.info.spot_meta_and_asset_ctxs()
            for asset in metas[0].get("universe", []):
                if asset.get("name") == symbol:
                    return int(asset.get("szDecimals", 4))
        except Exception:
            pass
        return 4  # safe default

    def _log_summary(self, results: dict, total_usdc: float):
        """Log a summary of the DCA execution."""
        logger.info("=" * 50)
        logger.info(f"DCA Summary — Total deployed: ${total_usdc:.2f} USDC")
        for symbol, result in results.items():
            status = result.get("status", "ok")
            if status == "ok":
                statuses = (
                    result.get("response", {})
                    .get("data", {})
                    .get("statuses", [{}])
                )
                filled_sz = statuses[0].get("filled", {}).get("totalSz", "?")
                avg_px = statuses[0].get("filled", {}).get("avgPx", "?")
                logger.info(f"  {symbol}: filled {filled_sz} @ avg ${avg_px}")
            else:
                logger.info(f"  {symbol}: {status} — {result.get('reason', result.get('error', ''))}")
        logger.info("=" * 50)
