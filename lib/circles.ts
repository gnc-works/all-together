// Constants and helpers for the All Together pool.

export const POOL_SAFE = '0xDf6fd807dB116c2dC2036c23858f3c4dcAE98eCd';
export const HUB_V2 = '0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8';

// One entry per wallet per cycle, fixed at this many CRC.
export const ENTRY_AMOUNT_CRC = 40n;
// Atto-CRC (18 decimals) for the on-chain transfer.
export const ENTRY_AMOUNT_ATTO = ENTRY_AMOUNT_CRC * 10n ** 18n;

// Excluded from entrant counts (e.g. pre-launch test deposits the v0 UI shouldn't render).
const BLACKLIST = new Set<string>([
  '0x4d9145def1647eff0136205ab3034f5297b524ac',
]);

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

// Unique entrants this cycle (skipping blacklisted addresses).
export function uniqueEntrants(rows: DepositRow[]): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    const from = r.from.toLowerCase();
    if (BLACKLIST.has(from)) continue;
    set.add(from);
  }
  return Array.from(set);
}

// ----------------------------------------------------------------------------
// Profile helpers (avatars, names, balances) via the Circles RPC
// ----------------------------------------------------------------------------

export type ProfileLite = {
  address: string;
  name?: string;
  avatar?: string; // base64 data URL or external URL
  v2Balance?: string; // decimal CRC string, not atto
};

type GetProfileViewResult = {
  address?: string;
  avatarInfo?: {
    cidV0?: string;
  };
  profile?: {
    name?: string;
    previewImageUrl?: string;
    imageUrl?: string;
  };
  v2Balance?: string;
};

export async function fetchProfile(address: string): Promise<ProfileLite> {
  const res = await fetch('https://rpc.aboutcircles.com/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'circles_getProfileView',
      params: [address.toLowerCase()],
    }),
  });
  if (!res.ok) return { address };
  const json = await res.json();
  const r: GetProfileViewResult = json.result ?? {};
  return {
    address,
    name: r.profile?.name,
    avatar: r.profile?.previewImageUrl ?? r.profile?.imageUrl,
    v2Balance: r.v2Balance,
  };
}

export async function fetchProfiles(addresses: string[]): Promise<ProfileLite[]> {
  // Fire all requests in parallel; tolerate individual failures.
  const results = await Promise.allSettled(addresses.map((a) => fetchProfile(a)));
  return results.map((r, i) =>
    r.status === 'fulfilled' ? r.value : { address: addresses[i] },
  );
}

export function shortAddress(addr: string): string {
  if (!addr) return '';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ----------------------------------------------------------------------------
// Trust graph
// ----------------------------------------------------------------------------

// Returns the set of addresses the given truster currently trusts (active edges).
export async function fetchOutgoingTrusts(truster: string): Promise<Set<string>> {
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
          Table: 'TrustRelations',
          Filter: [
            {
              Type: 'FilterPredicate',
              FilterType: 'Equals',
              Column: 'truster',
              Value: truster.toLowerCase(),
            },
          ],
          Limit: 1000,
          Order: [{ Column: 'timestamp', SortOrder: 'DESC' }],
        },
      ],
    }),
  });
  if (!res.ok) return new Set();
  const json = await res.json();
  const cols: string[] = json.result?.columns ?? [];
  const rows: unknown[][] = json.result?.rows ?? [];
  const trusteeIdx = cols.indexOf('trustee');
  const expiryIdx = cols.indexOf('expiryTime');
  const nowSec = BigInt(Math.floor(Date.now() / 1000));
  const set = new Set<string>();
  for (const row of rows) {
    const trustee = String(row[trusteeIdx] ?? '').toLowerCase();
    if (!trustee) continue;
    // expiryTime is an unbounded uint96 string; only include active trusts.
    try {
      const expiry = BigInt(String(row[expiryIdx] ?? '0'));
      if (expiry <= nowSec) continue;
    } catch {
      // if parse fails, treat as active
    }
    set.add(trustee);
  }
  return set;
}

export function intersect(a: Set<string>, b: string[]): string[] {
  return b.filter((x) => a.has(x.toLowerCase()));
}

// Pretty relative time like "12s ago", "3m ago", "2h ago".
export function timeAgo(tsSeconds: number, nowMs = Date.now()): string {
  const diffSec = Math.max(0, Math.floor(nowMs / 1000) - tsSeconds);
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

// True when within the last `windowMin` minutes before the deadline.
export function isUrgent(deadline: Date, windowMin = 30, nowMs = Date.now()): boolean {
  const ms = deadline.getTime() - nowMs;
  return ms > 0 && ms <= windowMin * 60_000;
}
