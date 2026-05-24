# All Together

> A weekly Circles ritual. Drop 1 CRC by Sunday 23:59 CET — one human takes the pot home.

**Live:** [all-together-gamma.vercel.app](https://all-together-gamma.vercel.app)
**Inside Circles:** [open in the playground](https://circles.gnosis.io/playground?url=https://all-together-gamma.vercel.app)
**Cycle:** Circles Garage Cycle 01

---

## What it is

A communal weekly lottery built natively on Circles. Every human drops **1 CRC** — the price of one human-hour of CRC mint — into a shared pool that lives on Gnosis Chain. At the end of the week, one human takes it home.

The point isn't gambling — it's the smallest, cheapest, most Circles-coded version of *a thing humans do together once a week*.

## How it works

- **Pool:** a Safe on Gnosis Chain at [`0xDf6f…8eCd`](https://gnosisscan.io/address/0xDf6fd807dB116c2dC2036c23858f3c4dcAE98eCd) holds all deposits for the week
- **Entry:** one tap → `safeTransferFrom` on Hub V2 sends your personal CRC to the pool
- **Week:** Monday 00:00 CET → Sunday 23:59 CET
- **Draw:** random among entrants, executed Sunday night
- **Payout:** Safe owner transfers the pot to the winner

## What ships (v0 — Cycle 01)

| Real | Manual / next cycle |
| --- | --- |
| Wallet from Circles host | Random draw (manual button) |
| 1 CRC deposit via Hub V2 | Payout (manual Safe transfer) |
| Pot balance + entrant count from indexer | Winner-announcement state |
| Per-wallet "already entered this week" check | Shareable result cards |

## Why it's Circles-coded

A pool that only makes sense if "money is issued by people":
- Every entry costs the equivalent of one human-hour of CRC mint
- The pot is humans' personal tokens, not synthetic stablecoins
- The mechanic rewards the daily/weekly Circles habit the program is trying to build

## Tech

- **Next.js 16 + TypeScript** (Turbopack)
- **`@aboutcircles/miniapp-sdk`** for the host bridge (wallet, `sendTransactions`)
- **`@aboutcircles/sdk` + `circles_query` RPC** for reading pool state from the indexer
- **viem** for ABI encoding
- **Tailwind v4**, dark theme, lime accent

Forked from the official [embedded-miniapp-boilerplate](https://github.com/aboutcircles/embedded-miniapp-boilerplate).

## Run locally

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

Outside the Circles host the wallet is null by design — open the deployed URL inside [the playground](https://circles.gnosis.io/playground) to see the connected state.

## Roadmap

- **Cycle 02:** automated draw + on-chain payout, winner-announcement state, shareable share card
- **Cycle 03+:** convert pool from raw personal-CRC bag to a Circles Group so winnings are liquid

## Author

Built by [Gonçalo](https://github.com/gnc-works) for Circles Garage 2026.

---

*Submission for [Circles Garage](https://garage.aboutcircles.com) — a six-week builder program for Circles mini-apps.*
