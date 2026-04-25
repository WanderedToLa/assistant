# Bybit Futures Trading Alert Bot

A Telegram-based alert bot and data collector for Bybit USDT perpetual futures.

## Features

### Phase 1 — Alerts
- **Candle alerts** — 4H close notifications for BTC, ETH, SOL (batched into one message)
- **Volume spike scanner** — Monitors BTC 5m candles; alerts when volume exceeds 2× the 20-candle average
- **Market summary** — Auto-sent 5× daily (KST: 3am / 6am / 9am / 6pm / 11pm); 9am and 6pm include Fear & Greed Index and BTC dominance with AI commentary

### Phase 2 — Data Collection
- **Candle history** — 15m / 1H / 4H / 1D OHLCV saved to JSON at each candle close
- **Open interest** — OI snapshots saved alongside candle closes (15m / 1H / 4H)
- **Funding rate history** — Saved daily at candle close
- **Trade history** — Personal closed positions fetched daily (entry/exit price, side, leverage, PnL)

## Setup

```bash
npm install
npm run dev
```

## Backfill historical data

Run once before starting the bot to populate initial history:

```bash
npm run collect
```

## Required env vars

```
TELEGRAM_TOKEN
TELEGRAM_CHAT_ID
ANTHROPIC_API_KEY
BYBIT_API_KEY
BYBIT_PRIVATE_KEY_PATH   # path to RSA private key (.pem)
```
