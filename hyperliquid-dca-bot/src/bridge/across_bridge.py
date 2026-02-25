"""
Across Protocol bridge integration.
Bridges USDC from Arbitrum to Hyperliquid using the Across Protocol API.

Across Protocol docs: https://docs.across.to/
Supported route: Arbitrum (42161) -> Hyperliquid (999)
"""

import time
import json
import requests
from web3 import Web3
from eth_account import Account
from typing import Optional
from ..utils.logger import get_logger

logger = get_logger(__name__)

# Chain IDs
ARBITRUM_CHAIN_ID = 42161
HYPERLIQUID_CHAIN_ID = 999  # Hyperliquid EVM chain ID

# Contract addresses
USDC_ARBITRUM = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"  # Native USDC on Arbitrum
ACROSS_SPOKE_POOL_ARBITRUM = "0xe35e9842fceaCA96570B734083f4a58e8F7C5f2A"  # Across SpokePool on Arbitrum

# Across API
ACROSS_API_URL = "https://app.across.to/api"

# ABI fragments for USDC approve + SpokePool deposit
USDC_ABI = [
    {
        "name": "approve",
        "type": "function",
        "inputs": [
            {"name": "spender", "type": "address"},
            {"name": "amount", "type": "uint256"},
        ],
        "outputs": [{"name": "", "type": "bool"}],
        "stateMutability": "nonpayable",
    },
    {
        "name": "allowance",
        "type": "function",
        "inputs": [
            {"name": "owner", "type": "address"},
            {"name": "spender", "type": "address"},
        ],
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
    },
    {
        "name": "balanceOf",
        "type": "function",
        "inputs": [{"name": "account", "type": "address"}],
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
    },
]

SPOKE_POOL_ABI = [
    {
        "name": "depositV3",
        "type": "function",
        "inputs": [
            {"name": "depositor", "type": "address"},
            {"name": "recipient", "type": "address"},
            {"name": "inputToken", "type": "address"},
            {"name": "outputToken", "type": "address"},
            {"name": "inputAmount", "type": "uint256"},
            {"name": "outputAmount", "type": "uint256"},
            {"name": "destinationChainId", "type": "uint256"},
            {"name": "exclusiveRelayer", "type": "address"},
            {"name": "quoteTimestamp", "type": "uint32"},
            {"name": "fillDeadline", "type": "uint32"},
            {"name": "exclusivityDeadline", "type": "uint32"},
            {"name": "message", "type": "bytes"},
        ],
        "outputs": [],
        "stateMutability": "payable",
    }
]


class AcrossBridge:
    """
    Bridge USDC from Arbitrum to Hyperliquid using Across Protocol.
    """

    def __init__(
        self,
        private_key: str,
        arbitrum_rpc_url: str,
        hyperliquid_rpc_url: str,
    ):
        self.private_key = private_key
        self.account = Account.from_key(private_key)
        self.wallet_address = self.account.address

        self.arb_w3 = Web3(Web3.HTTPProvider(arbitrum_rpc_url))
        self.hl_w3 = Web3(Web3.HTTPProvider(hyperliquid_rpc_url))

        self.usdc_contract = self.arb_w3.eth.contract(
            address=Web3.to_checksum_address(USDC_ARBITRUM), abi=USDC_ABI
        )
        self.spoke_pool = self.arb_w3.eth.contract(
            address=Web3.to_checksum_address(ACROSS_SPOKE_POOL_ARBITRUM),
            abi=SPOKE_POOL_ABI,
        )

        logger.info(f"AcrossBridge initialized for wallet: {self.wallet_address}")

    def get_usdc_balance_arbitrum(self) -> float:
        """Return the USDC balance on Arbitrum (human-readable)."""
        raw = self.usdc_contract.functions.balanceOf(self.wallet_address).call()
        return raw / 1e6  # USDC has 6 decimals

    def get_quote(self, amount_usdc: float) -> dict:
        """
        Fetch a bridge quote from the Across API.

        Args:
            amount_usdc: Amount of USDC to bridge.

        Returns:
            Quote dict from Across API.
        """
        amount_raw = int(amount_usdc * 1e6)
        params = {
            "inputToken": USDC_ARBITRUM,
            "outputToken": "0x0000000000000000000000000000000000000000",  # native/USDC on dest
            "originChainId": ARBITRUM_CHAIN_ID,
            "destinationChainId": HYPERLIQUID_CHAIN_ID,
            "amount": amount_raw,
            "recipient": self.wallet_address,
        }
        logger.info(f"Fetching Across quote for ${amount_usdc} USDC...")
        response = requests.get(f"{ACROSS_API_URL}/suggested-fees", params=params, timeout=30)
        response.raise_for_status()
        quote = response.json()
        fee_usdc = int(quote.get("totalRelayFee", {}).get("total", 0)) / 1e6
        logger.info(f"Across quote received. Relay fee: ${fee_usdc:.4f} USDC")
        return quote

    def approve_usdc(self, amount_raw: int) -> str:
        """Approve Across SpokePool to spend USDC."""
        current_allowance = self.usdc_contract.functions.allowance(
            self.wallet_address, ACROSS_SPOKE_POOL_ARBITRUM
        ).call()

        if current_allowance >= amount_raw:
            logger.info("USDC allowance already sufficient, skipping approval")
            return "skipped"

        nonce = self.arb_w3.eth.get_transaction_count(self.wallet_address)
        gas_price = self.arb_w3.eth.gas_price

        tx = self.usdc_contract.functions.approve(
            ACROSS_SPOKE_POOL_ARBITRUM, amount_raw
        ).build_transaction(
            {
                "from": self.wallet_address,
                "nonce": nonce,
                "gasPrice": gas_price,
                "gas": 100_000,
                "chainId": ARBITRUM_CHAIN_ID,
            }
        )
        signed = self.account.sign_transaction(tx)
        tx_hash = self.arb_w3.eth.send_raw_transaction(signed.rawTransaction)
        receipt = self.arb_w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

        if receipt["status"] != 1:
            raise RuntimeError("USDC approval transaction failed")

        logger.info(f"USDC approved. Tx: {tx_hash.hex()}")
        return tx_hash.hex()

    def bridge_usdc(self, amount_usdc: float) -> str:
        """
        Bridge USDC from Arbitrum to Hyperliquid via Across Protocol.

        Args:
            amount_usdc: Amount of USDC to bridge.

        Returns:
            Transaction hash of the deposit on Arbitrum.
        """
        amount_raw = int(amount_usdc * 1e6)

        # 1. Fetch quote
        quote = self.get_quote(amount_usdc)
        output_amount = int(quote.get("outputAmount", amount_raw))
        quote_timestamp = int(quote.get("timestamp", int(time.time())))
        fill_deadline = int(time.time()) + 3600  # 1 hour fill deadline
        exclusivity_deadline = 0
        exclusive_relayer = "0x0000000000000000000000000000000000000000"

        # 2. Approve USDC spend
        self.approve_usdc(amount_raw)

        # 3. Execute deposit on SpokePool
        nonce = self.arb_w3.eth.get_transaction_count(self.wallet_address)
        gas_price = self.arb_w3.eth.gas_price

        # Determine output token (USDC on Hyperliquid EVM)
        output_token = quote.get("outputToken", "0x0000000000000000000000000000000000000000")

        tx = self.spoke_pool.functions.depositV3(
            self.wallet_address,       # depositor
            self.wallet_address,       # recipient (same wallet on Hyperliquid)
            USDC_ARBITRUM,             # inputToken
            output_token,              # outputToken
            amount_raw,                # inputAmount
            output_amount,             # outputAmount (after fees)
            HYPERLIQUID_CHAIN_ID,      # destinationChainId
            exclusive_relayer,         # exclusiveRelayer
            quote_timestamp,           # quoteTimestamp
            fill_deadline,             # fillDeadline
            exclusivity_deadline,      # exclusivityDeadline
            b"",                       # message
        ).build_transaction(
            {
                "from": self.wallet_address,
                "nonce": nonce,
                "gasPrice": gas_price,
                "gas": 300_000,
                "chainId": ARBITRUM_CHAIN_ID,
                "value": 0,
            }
        )

        signed = self.account.sign_transaction(tx)
        tx_hash = self.arb_w3.eth.send_raw_transaction(signed.rawTransaction)
        receipt = self.arb_w3.eth.wait_for_transaction_receipt(tx_hash, timeout=180)

        if receipt["status"] != 1:
            raise RuntimeError("Across bridge deposit transaction failed")

        logger.info(
            f"Bridge deposit submitted. Arbitrum tx: {tx_hash.hex()}. "
            f"Bridging ${amount_usdc} USDC to Hyperliquid..."
        )
        return tx_hash.hex()

    def wait_for_funds_on_hyperliquid(
        self,
        expected_amount_usdc: float,
        max_wait: int = 1800,
        poll_interval: int = 30,
    ) -> bool:
        """
        Poll Hyperliquid EVM for USDC arrival after bridging.

        Args:
            expected_amount_usdc: Minimum USDC amount expected to arrive.
            max_wait: Max seconds to wait (default: 30 minutes).
            poll_interval: Seconds between polls.

        Returns:
            True if funds arrived, False if timed out.
        """
        logger.info(
            f"Waiting for ${expected_amount_usdc} USDC to arrive on Hyperliquid "
            f"(timeout: {max_wait}s)..."
        )
        # USDC contract address on Hyperliquid EVM (update if different)
        USDC_HYPERLIQUID = "0x6d1e7cDE53ba764838B5F71bE5f71b5B1E1A4c2A"
        hl_usdc = self.hl_w3.eth.contract(
            address=Web3.to_checksum_address(USDC_HYPERLIQUID), abi=USDC_ABI
        )

        elapsed = 0
        while elapsed < max_wait:
            try:
                balance = hl_usdc.functions.balanceOf(self.wallet_address).call() / 1e6
                logger.info(f"Hyperliquid USDC balance: ${balance:.2f} (waited {elapsed}s)")
                if balance >= expected_amount_usdc * 0.95:  # Allow 5% for fees
                    logger.info("Funds confirmed on Hyperliquid!")
                    return True
            except Exception as e:
                logger.warning(f"Error checking Hyperliquid balance: {e}")

            time.sleep(poll_interval)
            elapsed += poll_interval

        logger.error(f"Funds did not arrive on Hyperliquid within {max_wait}s")
        return False
