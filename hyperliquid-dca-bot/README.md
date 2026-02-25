# Hyperliquid DCA Bot

Automated Dollar Cost Averaging bot that:

1. **Withdraws** $25 USDC/day from Coinbase → Arbitrum wallet
2. **Bridges** USDC from Arbitrum → Hyperliquid via [Across Protocol](https://across.to)
3. **Spot-buys** HYPE, SOL, BTC, and ZEC on Hyperliquid

## Default Allocation

| Asset | Weight | $/day |
|-------|--------|-------|
| HYPE  | 40%    | $10.00 |
| SOL   | 25%    | $6.25  |
| BTC   | 20%    | $5.00  |
| ZEC   | 15%    | $3.75  |

Weights are configurable in `config/allocations.py`.

## Project Structure

```
hyperliquid-dca-bot/
├── main.py                        # Entry point
├── requirements.txt
├── .env.example                   # Config template
├── config/
│   └── allocations.py             # Asset weight configuration
├── src/
│   ├── dca_bot.py                 # Main orchestrator
│   ├── coinbase/
│   │   └── coinbase_client.py     # Coinbase API (withdrawal)
│   ├── bridge/
│   │   └── across_bridge.py       # Across Protocol bridge
│   ├── hyperliquid/
│   │   └── hl_trader.py           # Hyperliquid spot trading
│   └── utils/
│       └── logger.py              # Logging
└── tests/
    ├── test_allocations.py
    └── test_dca_bot.py
```

## Setup

### 1. Install dependencies

```bash
cd hyperliquid-dca-bot
pip install -r requirements.txt
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your keys
```

Required environment variables:

| Variable | Description |
|---|---|
| `COINBASE_API_KEY` | Coinbase Advanced Trade API key |
| `COINBASE_API_SECRET` | Coinbase Advanced Trade API secret |
| `WALLET_PRIVATE_KEY` | EVM wallet private key (hex) |
| `ARBITRUM_WALLET_ADDRESS` | Arbitrum wallet address |
| `ARBITRUM_RPC_URL` | Arbitrum JSON-RPC URL (Alchemy/Infura) |
| `HYPERLIQUID_RPC_URL` | Hyperliquid EVM RPC URL |
| `DAILY_USDC_AMOUNT` | Daily DCA amount in USD (default: 25.0) |
| `TESTNET` | Set `true` for testnet (default: false) |

### 3. Validate configuration

```bash
python main.py --dry-run
```

### 4. Run

```bash
# Run once (for testing or manual execution)
python main.py --once

# Start the 24-hour scheduler (runs indefinitely)
python main.py
```

## Pipeline

```
Coinbase (USDC)
      │
      │  Coinbase API withdrawal → Arbitrum
      ▼
Arbitrum Wallet (USDC)
      │
      │  Across Protocol SpokePool depositV3
      ▼
Hyperliquid EVM (USDC)
      │
      │  Hyperliquid SDK spot market buys
      ▼
 HYPE  SOL  BTC  ZEC
```

## Across Bridge Details

- **Route**: Arbitrum (chain 42161) → Hyperliquid (chain 999)
- **Token**: Native USDC on Arbitrum (`0xaf88d065e77c8cC2239327C5EDb3A432268e5831`)
- **Fee**: ~0.1–0.3% relay fee (deducted from output amount)
- **Fill time**: Typically 1–5 minutes

## Running as a Service

Use `systemd` or Docker for production deployment:

```bash
# Example systemd service (save to /etc/systemd/system/dca-bot.service)
[Unit]
Description=Hyperliquid DCA Bot
After=network.target

[Service]
WorkingDirectory=/path/to/hyperliquid-dca-bot
ExecStart=/usr/bin/python3 main.py
Restart=always
EnvironmentFile=/path/to/hyperliquid-dca-bot/.env

[Install]
WantedBy=multi-user.target
```

## Security Notes

- Store `WALLET_PRIVATE_KEY` in a secrets manager (AWS Secrets Manager, HashiCorp Vault) for production
- The Coinbase API key only needs `view` + `transfer` permissions — **do not enable trade permissions**
- Use a dedicated wallet with only enough funds for DCA operations
- Run on a VPS or cloud instance with restricted network access

## Tests

```bash
pytest tests/ -v
```
