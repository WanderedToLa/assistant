# Bybit Futures Trading Alert Bot

A Telegram-based alert bot for Bybit USDT perpetual futures.
Monitors BTC, ETH, and SOL for candle closes, volume spikes, breakout attempts, and sends scheduled market summaries.

## Features

- **Candle alerts** — 1H / 4H close notifications with price data
- **Scanner** — Detects volume spikes and previous high/low breakout attempts on 15m / 30m candles
- **Market summary** — Auto-sent 5 times daily via Telegram

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
