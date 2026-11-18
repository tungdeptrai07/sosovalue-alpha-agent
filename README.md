# SoSoPulse Desk — One-Person On-Chain Finance Business with SoSoValue & SoDEX

Submission for **Build Your One-Person On-Chain Finance Business with SoSoValue (3rd Wave)** on AKINDO.

## Overview
**SoSoPulse Desk** turns a single operator into a disciplined, institutional-grade on-chain finance business by connecting **SoSoValue SSI Baskets (`MAG7.ssi`, `DEFI.ssi`, `MEME.ssi`, `USSO.ssi`) & ETF Net Inflow Telemetry** to an **AI Signal Engine**, a **5-Point Pre-Trade Risk Control Gate**, and **Human-in-the-Loop SoDEX Order Confirmation**.

## Core Workflow (Insight-to-Action)
1. **Data & API Integration (`SoSoValueClient`)**: Pulls SoSoValue Open API (`X-SoSo-Api-Key`) SSI index NAV, 24h momentum, ETF net inflows, and perpetual funding rates.
2. **Opportunity Discovery (`analyze_opportunity`)**: Classifies market regimes (`BULL_EXPANSION`, `OVERHEATED_FUNDING`, `BREAKOUT_ACCUMULATION`, `LOW_VOL_CARRY`) and computes directional or delta-neutral hedging signals with explicit stop-loss and take-profit targets.
3. **5-Point Risk Control Gate (`evaluate_risk_gate`)**: Enforces single-order notional caps, total portfolio exposure bounds, slippage limits (`bps`), minimum confidence thresholds, and daily drawdown circuit breakers.
4. **Human Confirmation & SoDEX Dispatch (`confirm_order`)**: Staging generates a deterministic order digest (`0x...`) that requires explicit operator approval before dispatching to SoDEX (`MAG7-USDC-PERP`, `MEME-USDC-PERP`, etc.).

## Run & Test Locally
```bash
python -m unittest discover -s tests -v
python backend/server.py
# Open http://127.0.0.1:8091
```
