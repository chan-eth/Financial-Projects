"""
Coinbase Advanced Trade API client for USDC withdrawals.
Handles sending USDC from Coinbase to a specified Arbitrum wallet address.
"""

import time
import hmac
import hashlib
import json
import requests
from datetime import datetime
from typing import Optional
from ..utils.logger import get_logger

logger = get_logger(__name__)


class CoinbaseClient:
    """Client for interacting with the Coinbase Advanced Trade API."""

    BASE_URL = "https://api.coinbase.com"

    def __init__(self, api_key: str, api_secret: str):
        self.api_key = api_key
        self.api_secret = api_secret

    def _generate_signature(self, timestamp: str, method: str, path: str, body: str = "") -> str:
        message = f"{timestamp}{method.upper()}{path}{body}"
        signature = hmac.new(
            self.api_secret.encode("utf-8"),
            message.encode("utf-8"),
            digestmod=hashlib.sha256,
        ).hexdigest()
        return signature

    def _get_headers(self, method: str, path: str, body: str = "") -> dict:
        timestamp = str(int(time.time()))
        signature = self._generate_signature(timestamp, method, path, body)
        return {
            "CB-ACCESS-KEY": self.api_key,
            "CB-ACCESS-SIGN": signature,
            "CB-ACCESS-TIMESTAMP": timestamp,
            "Content-Type": "application/json",
        }

    def get_usdc_balance(self) -> float:
        """Fetch USDC balance from Coinbase account."""
        path = "/api/v3/brokerage/accounts"
        headers = self._get_headers("GET", path)
        response = requests.get(f"{self.BASE_URL}{path}", headers=headers, timeout=30)
        response.raise_for_status()

        accounts = response.json().get("accounts", [])
        for account in accounts:
            if account.get("currency") == "USDC":
                balance = float(account.get("available_balance", {}).get("value", 0))
                logger.info(f"USDC balance: ${balance:.2f}")
                return balance

        logger.warning("No USDC account found")
        return 0.0

    def send_usdc_to_arbitrum(
        self,
        destination_address: str,
        amount_usd: float,
        network: str = "arbitrum",
    ) -> dict:
        """
        Send USDC from Coinbase to an Arbitrum wallet address.

        Args:
            destination_address: The Arbitrum wallet address to send USDC to.
            amount_usd: Amount in USD to send.
            network: The network to use (default: arbitrum).

        Returns:
            Transaction details dict.
        """
        # First get the account ID for USDC
        account_id = self._get_usdc_account_id()
        if not account_id:
            raise ValueError("Could not find USDC account on Coinbase")

        path = f"/v2/accounts/{account_id}/transactions"
        payload = {
            "type": "send",
            "to": destination_address,
            "amount": str(amount_usd),
            "currency": "USDC",
            "network": network,
            "description": f"DCA Bot: ${amount_usd} USDC to Arbitrum",
        }
        body = json.dumps(payload)
        headers = self._get_headers("POST", path, body)

        logger.info(f"Sending ${amount_usd} USDC to {destination_address} via {network}")
        response = requests.post(
            f"{self.BASE_URL}{path}", headers=headers, data=body, timeout=30
        )
        response.raise_for_status()

        tx_data = response.json().get("data", {})
        tx_id = tx_data.get("id", "unknown")
        logger.info(f"USDC transfer initiated. Transaction ID: {tx_id}")
        return tx_data

    def _get_usdc_account_id(self) -> Optional[str]:
        """Get the Coinbase account ID for USDC."""
        path = "/v2/accounts"
        headers = self._get_headers("GET", path)
        response = requests.get(f"{self.BASE_URL}{path}", headers=headers, timeout=30)
        response.raise_for_status()

        for account in response.json().get("data", []):
            if account.get("currency", {}).get("code") == "USDC":
                return account.get("id")
        return None

    def wait_for_transaction(self, account_id: str, tx_id: str, max_wait: int = 600) -> bool:
        """
        Poll a transaction until it confirms or times out.

        Args:
            account_id: Coinbase account ID.
            tx_id: Transaction ID to monitor.
            max_wait: Maximum seconds to wait (default: 10 minutes).

        Returns:
            True if confirmed, False if timed out or failed.
        """
        path = f"/v2/accounts/{account_id}/transactions/{tx_id}"
        elapsed = 0
        interval = 15

        while elapsed < max_wait:
            headers = self._get_headers("GET", path)
            response = requests.get(f"{self.BASE_URL}{path}", headers=headers, timeout=30)
            response.raise_for_status()

            status = response.json().get("data", {}).get("status", "")
            logger.info(f"Transaction {tx_id} status: {status} (waited {elapsed}s)")

            if status == "completed":
                return True
            if status in ("failed", "canceled", "expired"):
                logger.error(f"Transaction {tx_id} ended with status: {status}")
                return False

            time.sleep(interval)
            elapsed += interval

        logger.error(f"Transaction {tx_id} timed out after {max_wait}s")
        return False
