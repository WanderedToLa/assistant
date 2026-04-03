# Bybit Futures Trading Alert Bot

A Telegram-based alert bot for Bybit USDT perpetual futures.

## Features

- **Candle alerts** — 4H close notifications for BTC, ETH, SOL (batched into one message)
- **Volume spike scanner** — Monitors BTC 5m candles; alerts when volume exceeds 2× average AND 2,000 BTC absolute threshold
- **Market summary** — Auto-sent 5× daily (KST: 3am / 6am / 9am / 6pm / 11pm); 9am and 6pm include Fear & Greed Index and BTC dominance

## Setup

```bash
npm install
npm run dev
```

## Required env vars

```
TELEGRAM_TOKEN
TELEGRAM_CHAT_ID
ANTHROPIC_API_KEY
```
