#!/usr/bin/env python3
"""
Entry point for the Hyperliquid DCA Bot.

Usage:
    python main.py              # Start scheduler (runs every 24 hours)
    python main.py --once       # Run a single DCA cycle and exit
    python main.py --dry-run    # Validate config without executing trades
"""

import argparse
import os
import sys
from dotenv import load_dotenv

load_dotenv()


def load_config() -> dict:
    """Load and validate all configuration from environment variables."""
    required = {
        "COINBASE_API_KEY":       "Coinbase Advanced Trade API key",
        "COINBASE_API_SECRET":    "Coinbase Advanced Trade API secret",
        "WALLET_PRIVATE_KEY":     "EVM wallet private key (hex, with 0x prefix)",
        "ARBITRUM_WALLET_ADDRESS":"Arbitrum wallet address (0x...)",
        "ARBITRUM_RPC_URL":       "Arbitrum JSON-RPC URL (e.g. Alchemy/Infura)",
        "HYPERLIQUID_RPC_URL":    "Hyperliquid EVM JSON-RPC URL",
    }

    missing = [k for k in required if not os.getenv(k)]
    if missing:
        print("ERROR: Missing required environment variables:")
        for key in missing:
            print(f"  {key}: {required[key]}")
        print("\nCopy .env.example to .env and fill in your values.")
        sys.exit(1)

    return {
        "coinbase_api_key":        os.environ["COINBASE_API_KEY"],
        "coinbase_api_secret":     os.environ["COINBASE_API_SECRET"],
        "wallet_private_key":      os.environ["WALLET_PRIVATE_KEY"],
        "arbitrum_wallet_address": os.environ["ARBITRUM_WALLET_ADDRESS"],
        "arbitrum_rpc_url":        os.environ["ARBITRUM_RPC_URL"],
        "hyperliquid_rpc_url":     os.environ["HYPERLIQUID_RPC_URL"],
        "daily_usdc_amount":       float(os.getenv("DAILY_USDC_AMOUNT", "25.0")),
        "testnet":                 os.getenv("TESTNET", "false").lower() == "true",
    }


def main():
    parser = argparse.ArgumentParser(description="Hyperliquid DCA Bot")
    parser.add_argument(
        "--once",
        action="store_true",
        help="Run a single DCA cycle then exit",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate config and print settings without executing",
    )
    args = parser.parse_args()

    config = load_config()

    if args.dry_run:
        from eth_account import Account
        wallet = Account.from_key(config["wallet_private_key"])
        print("=" * 60)
        print("Hyperliquid DCA Bot — Dry Run")
        print("=" * 60)
        print(f"  Daily DCA amount  : ${config['daily_usdc_amount']:.2f} USDC")
        print(f"  Arbitrum wallet   : {config['arbitrum_wallet_address']}")
        print(f"  Signing wallet    : {wallet.address}")
        print(f"  Testnet mode      : {config['testnet']}")
        print(f"  Arbitrum RPC      : {config['arbitrum_rpc_url'][:40]}...")
        print(f"  Hyperliquid RPC   : {config['hyperliquid_rpc_url'][:40]}...")
        print("\nDCA Allocations:")
        from src.hyperliquid import DCA_ALLOCATIONS
        for symbol, weight in DCA_ALLOCATIONS.items():
            alloc = config["daily_usdc_amount"] * weight
            print(f"  {symbol:6s}: {weight*100:.0f}%  → ${alloc:.2f}/day")
        print("\nConfig OK. Run without --dry-run to start the bot.")
        return

    # Import bot after config validation to surface import errors clearly
    from src.dca_bot import DCABot

    bot = DCABot(**config)

    if args.once:
        success = bot.run_once()
        sys.exit(0 if success else 1)
    else:
        bot.start_scheduler()


if __name__ == "__main__":
    main()
