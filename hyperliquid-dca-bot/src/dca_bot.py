"""
Hyperliquid DCA Bot — Main Orchestrator
========================================
Pipeline (runs once per scheduled cycle, default: daily):

  1. Withdraw $25 USDC from Coinbase → Arbitrum wallet (via Coinbase API)
  2. Bridge USDC from Arbitrum → Hyperliquid (via Across Protocol)
  3. Wait for funds to arrive on Hyperliquid
  4. Spot-buy HYPE (40%), SOL (25%), BTC (20%), ZEC (15%)

Schedule is managed by APScheduler (or an external cron). The bot persists
state between runs in a lightweight JSON ledger at logs/state.json.
"""

import json
import time
import traceback
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from .coinbase.coinbase_client import CoinbaseClient
from .bridge.across_bridge import AcrossBridge
from .hyperliquid.hl_trader import HyperliquidTrader
from .utils.logger import get_logger

logger = get_logger(__name__)

STATE_FILE = Path(__file__).parents[1] / "logs" / "state.json"


class DCABot:
    """
    Orchestrates the full DCA pipeline:
    Coinbase → Arbitrum wallet → Across Bridge → Hyperliquid spot buys.
    """

    def __init__(
        self,
        # Coinbase
        coinbase_api_key: str,
        coinbase_api_secret: str,
        # Wallet (used for bridge and Hyperliquid trading)
        wallet_private_key: str,
        arbitrum_wallet_address: str,
        # RPC endpoints
        arbitrum_rpc_url: str,
        hyperliquid_rpc_url: str,
        # DCA settings
        daily_usdc_amount: float = 25.0,
        testnet: bool = False,
    ):
        self.daily_amount = daily_usdc_amount
        self.arbitrum_wallet = arbitrum_wallet_address

        self.coinbase = CoinbaseClient(coinbase_api_key, coinbase_api_secret)
        self.bridge = AcrossBridge(
            private_key=wallet_private_key,
            arbitrum_rpc_url=arbitrum_rpc_url,
            hyperliquid_rpc_url=hyperliquid_rpc_url,
        )
        self.trader = HyperliquidTrader(
            private_key=wallet_private_key,
            testnet=testnet,
        )

        logger.info(
            f"DCABot initialized | Daily: ${daily_usdc_amount} | "
            f"Arbitrum wallet: {arbitrum_wallet_address} | "
            f"Testnet: {testnet}"
        )

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    def run_once(self) -> bool:
        """
        Execute one full DCA cycle.

        Returns:
            True on success, False if any step failed.
        """
        run_id = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        logger.info(f"{'='*60}")
        logger.info(f"DCA cycle started | run_id={run_id}")
        logger.info(f"{'='*60}")

        state = self._load_state()
        state["last_run_id"] = run_id
        state["last_run_time"] = datetime.now(timezone.utc).isoformat()
        state["status"] = "running"
        self._save_state(state)

        try:
            # ── Step 1: Coinbase → Arbitrum ──────────────────────────
            logger.info(f"[1/4] Withdrawing ${self.daily_amount} USDC from Coinbase...")
            cb_balance = self.coinbase.get_usdc_balance()
            if cb_balance < self.daily_amount:
                raise ValueError(
                    f"Insufficient Coinbase USDC balance: ${cb_balance:.2f} "
                    f"(need ${self.daily_amount:.2f})"
                )

            tx_data = self.coinbase.send_usdc_to_arbitrum(
                destination_address=self.arbitrum_wallet,
                amount_usd=self.daily_amount,
            )
            cb_tx_id = tx_data.get("id", "unknown")
            logger.info(f"[1/4] Coinbase withdrawal initiated. CB tx: {cb_tx_id}")

            # Poll for confirmation (Coinbase side)
            cb_account_id = self.coinbase._get_usdc_account_id()
            confirmed = self.coinbase.wait_for_transaction(cb_account_id, cb_tx_id)
            if not confirmed:
                raise RuntimeError(f"Coinbase transaction {cb_tx_id} did not confirm in time")

            logger.info(f"[1/4] Coinbase withdrawal confirmed.")

            # ── Step 2: Wait for funds on Arbitrum ───────────────────
            logger.info(f"[2/4] Waiting for USDC to arrive on Arbitrum...")
            self._wait_for_arb_funds(self.daily_amount)

            # ── Step 3: Across Bridge Arbitrum → Hyperliquid ─────────
            logger.info(f"[3/4] Bridging ${self.daily_amount} USDC via Across Protocol...")
            bridge_tx = self.bridge.bridge_usdc(self.daily_amount)
            logger.info(f"[3/4] Bridge tx submitted: {bridge_tx}")

            arrived = self.bridge.wait_for_funds_on_hyperliquid(
                expected_amount_usdc=self.daily_amount * 0.98  # Allow 2% for bridge fees
            )
            if not arrived:
                raise RuntimeError("USDC did not arrive on Hyperliquid in time")

            logger.info(f"[3/4] USDC confirmed on Hyperliquid.")

            # ── Step 4: Spot buys on Hyperliquid ─────────────────────
            # Use slightly less than daily_amount to account for bridge fees
            hl_balance = self.trader.get_spot_balance_usdc()
            tradeable = min(hl_balance, self.daily_amount)
            logger.info(
                f"[4/4] Executing spot DCA with ${tradeable:.2f} USDC "
                f"(HL balance: ${hl_balance:.2f})..."
            )
            trade_results = self.trader.execute_dca(tradeable)

            # ── Persist success state ─────────────────────────────────
            state["status"] = "success"
            state["last_success_time"] = datetime.now(timezone.utc).isoformat()
            state["last_trade_results"] = trade_results
            state["total_cycles"] = state.get("total_cycles", 0) + 1
            state["total_usdc_deployed"] = (
                state.get("total_usdc_deployed", 0.0) + tradeable
            )
            self._save_state(state)

            logger.info(f"DCA cycle {run_id} completed successfully.")
            return True

        except Exception as e:
            logger.error(f"DCA cycle {run_id} FAILED: {e}")
            logger.debug(traceback.format_exc())
            state["status"] = "failed"
            state["last_error"] = str(e)
            state["last_error_time"] = datetime.now(timezone.utc).isoformat()
            self._save_state(state)
            return False

    # ------------------------------------------------------------------
    # Scheduler helpers
    # ------------------------------------------------------------------

    def start_scheduler(self):
        """
        Start the APScheduler-based daily scheduler.
        Runs run_once() every 24 hours.
        """
        from apscheduler.schedulers.blocking import BlockingScheduler
        from apscheduler.triggers.interval import IntervalTrigger

        scheduler = BlockingScheduler(timezone="UTC")
        scheduler.add_job(
            self.run_once,
            trigger=IntervalTrigger(hours=24),
            id="dca_daily",
            name="Daily DCA Cycle",
            misfire_grace_time=3600,  # Allow 1 hour late start
            max_instances=1,
            replace_existing=True,
        )

        logger.info("Scheduler started — DCA will run every 24 hours.")
        # Run immediately on startup
        logger.info("Running initial DCA cycle on startup...")
        self.run_once()

        try:
            scheduler.start()
        except (KeyboardInterrupt, SystemExit):
            logger.info("Scheduler stopped.")

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _wait_for_arb_funds(
        self,
        expected_usdc: float,
        max_wait: int = 900,
        poll_interval: int = 20,
    ):
        """Poll Arbitrum USDC balance until funds from Coinbase arrive."""
        logger.info(
            f"Polling Arbitrum for ${expected_usdc:.2f} USDC arrival "
            f"(max {max_wait}s)..."
        )
        elapsed = 0
        while elapsed < max_wait:
            balance = self.bridge.get_usdc_balance_arbitrum()
            logger.info(f"Arbitrum USDC balance: ${balance:.2f} (waited {elapsed}s)")
            if balance >= expected_usdc * 0.99:
                logger.info("Funds confirmed on Arbitrum.")
                return
            time.sleep(poll_interval)
            elapsed += poll_interval
        raise TimeoutError(
            f"USDC did not arrive on Arbitrum within {max_wait}s"
        )

    def _load_state(self) -> dict:
        STATE_FILE.parent.mkdir(exist_ok=True)
        if STATE_FILE.exists():
            try:
                return json.loads(STATE_FILE.read_text())
            except json.JSONDecodeError:
                pass
        return {}

    def _save_state(self, state: dict):
        STATE_FILE.write_text(json.dumps(state, indent=2, default=str))
