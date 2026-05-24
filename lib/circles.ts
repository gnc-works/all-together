// Constants and helpers for the All Together pool.

export const POOL_SAFE = '0xDf6fd807dB116c2dC2036c23858f3c4dcAE98eCd';
export const HUB_V2 = '0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8';

// One entry per wallet per cycle, fixed at this many CRC.
export const ENTRY_AMOUNT_CRC = 40n;
// Atto-CRC (18 decimals) for the on-chain transfer.
export const ENTRY_AMOUNT_ATTO = ENTRY_AMOUNT_CRC * 10n ** 18n;

export const HUB_ABI = [
  {
    name: 'safeTransferFrom',
    type: 'function',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'id', type: 'uint256' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

// Cycle window: Mon 00:00 → next Mon 00:00, both in CET (UTC+2 during summer).
// Returns the start and end of the *current* weekly cycle.
export function getCycleRange(now = new Date()) {
  const CET_OFFSET_MS = 2 * 60 * 60 * 1000;
  const cet = new Date(now.getTime() + CET_OFFSET_MS);
  const day = cet.getUTCDay(); // 0 = Sun
  const daysFromMonday = (day + 6) % 7;
  const monStartUtc = Date.UTC(
    cet.getUTCFullYear(),
    cet.getUTCMonth(),
    cet.getUTCDate() - daysFromMonday,
    0, 0, 0,
  );
  const start = new Date(monStartUtc - CET_OFFSET_MS);
  const end = new Date(monStartUtc + 7 * 24 * 3600 * 1000 - CET_OFFSET_MS);
  // Deadline = Sun 23:59 CET = end - 1 minute, basically the same as end for our purposes.
  const deadline = new Date(end.getTime() - 60_000);
  return { start, end, deadline };
}

export function formatCountdown(target: Date, from = Date.now()): string {
  const diff = target.getTime() - from;
  if (diff <= 0) return 'drawing…';
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / (60 * 60 * 24));
  const hours = Math.floor((totalSeconds % (60 * 60 * 24)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (days > 0) return `${days}d ${hours}h ${pad(minutes)}m`;
  if (hours > 0) return `${hours}h ${pad(minutes)}m ${pad(seconds)}s`;
  return `${minutes}m ${pad(seconds)}s`;
}

export type DepositRow = {
  from: string;
  timestamp: number;
  txHash: string;
  value: string;
};

// Query the Circles indexer for CRC v2 transfers to the pool Safe during the current cycle.
// Returns one row per transfer.
export async function fetchCycleDeposits(): Promise<DepositRow[]> {
  const { start } = getCycleRange();
  const startTs = Math.floor(start.getTime() / 1000);

  const res = await fetch('https://rpc.aboutcircles.com/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'circles_query',
      params: [
        {
          Namespace: 'V_CrcV2',
          Table: 'Transfers',
          Filter: [
            {
              Type: 'FilterPredicate',
              FilterType: 'Equals',
              Column: 'to',
              Value: POOL_SAFE.toLowerCase(),
            },
            {
              Type: 'FilterPredicate',
              FilterType: 'GreaterThanOrEquals',
              Column: 'timestamp',
              Value: startTs,
            },
          ],
          Limit: 1000,
          Order: [{ Column: 'timestamp', SortOrder: 'ASC' }],
        },
      ],
    }),
  });

  if (!res.ok) throw new Error(`Indexer HTTP ${res.status}`);
  const json = await res.json();
  const cols: string[] = json.result?.columns ?? [];
  const rows: unknown[][] = json.result?.rows ?? [];
  const fromIdx = cols.indexOf('from');
  const tsIdx = cols.indexOf('timestamp');
  const txIdx = cols.indexOf('transactionHash');
  const valueIdx = cols.indexOf('value');
  return rows.map((r) => ({
    from: String(r[fromIdx] ?? ''),
    timestamp: Number(r[tsIdx] ?? 0),
    txHash: String(r[txIdx] ?? ''),
    value: String(r[valueIdx] ?? '0'),
  }));
}

// Unique entrants this cycle.
export function uniqueEntrants(rows: DepositRow[]): string[] {
  const set = new Set<string>();
  for (const r of rows) set.add(r.from.toLowerCase());
  return Array.from(set);
}
