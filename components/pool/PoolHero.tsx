'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { encodeFunctionData } from 'viem';

import { useWallet } from '@/hooks/use-wallet';
import {
  HUB_ABI,
  HUB_V2,
  POOL_SAFE,
  fetchCycleDeposits,
  formatCountdown,
  getCycleRange,
  uniqueEntrants,
  type DepositRow,
} from '@/lib/circles';

type LoadState = 'loading' | 'ready' | 'error';

export function PoolHero() {
  const { address, isConnected, isMiniappHost } = useWallet();
  const cycle = useMemo(() => getCycleRange(), []);

  const [deposits, setDeposits] = useState<DepositRow[]>([]);
  const [load, setLoad] = useState<LoadState>('loading');
  const [now, setNow] = useState(Date.now());
  const [sending, setSending] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const rows = await fetchCycleDeposits();
      setDeposits(rows);
      setLoad('ready');
    } catch {
      setLoad('error');
    }
  }, []);

  useEffect(() => {
    refresh();
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(tick);
  }, [refresh]);

  const entrants = useMemo(() => uniqueEntrants(deposits), [deposits]);
  const youEntered = address
    ? entrants.includes(address.toLowerCase())
    : false;
  const countdown = formatCountdown(cycle.deadline, now);

  async function handleEnter() {
    if (!address) return;
    setSending(true);
    setTxError(null);
    try {
      const { sendTransactions } = await import('@aboutcircles/miniapp-sdk');
      const tokenId = BigInt(address);
      const data = encodeFunctionData({
        abi: HUB_ABI,
        functionName: 'safeTransferFrom',
        args: [
          address as `0x${string}`,
          POOL_SAFE as `0x${string}`,
          tokenId,
          10n ** 18n,
          '0x',
        ],
      });
      await sendTransactions([{ to: HUB_V2, data, value: '0' }]);
      // Give the indexer a beat to catch up.
      await new Promise((r) => setTimeout(r, 2500));
      await refresh();
    } catch (e) {
      setTxError(e instanceof Error ? e.message : 'Transfer failed');
    } finally {
      setSending(false);
    }
  }

  // ---- Render branches -------------------------------------------------------

  if (!isConnected) {
    return (
      <Frame>
        <Eyebrow>All Together</Eyebrow>
        <Stat label="this week's pot" value={`${entrants.length} CRC`} />
        <Hint>
          Open this miniapp inside the Circles host to enter.
          <br />
          {isMiniappHost ? 'Waiting for wallet…' : 'You are not inside the Circles iframe.'}
        </Hint>
        <Foot>draws sun 23:59 cet · in {countdown}</Foot>
      </Frame>
    );
  }

  if (load === 'loading') {
    return (
      <Frame>
        <Eyebrow>All Together</Eyebrow>
        <Stat label="this week's pot" value="…" />
        <Hint>reading the chain…</Hint>
        <Foot>draws sun 23:59 cet · in {countdown}</Foot>
      </Frame>
    );
  }

  return (
    <Frame>
      <Eyebrow>All Together</Eyebrow>

      <Stat
        label={youEntered ? 'you’re in' : 'this week’s pot'}
        value={`${entrants.length} CRC`}
        sub={`${entrants.length} ${entrants.length === 1 ? 'human' : 'humans'} in`}
      />

      {!youEntered && (
        <button
          onClick={handleEnter}
          disabled={sending}
          className="mt-4 w-full rounded-2xl border border-lime-400/40 bg-lime-400 px-6 py-5 text-base font-semibold uppercase tracking-[0.18em] text-black transition hover:bg-lime-300 disabled:opacity-50"
        >
          {sending ? 'confirming…' : '1 CRC to enter'}
        </button>
      )}

      {youEntered && (
        <div className="mt-4 w-full rounded-2xl border border-lime-400/40 px-6 py-5 text-center text-base uppercase tracking-[0.18em] text-lime-300">
          you&rsquo;re in for this week
        </div>
      )}

      {txError && (
        <p className="mt-3 text-center text-xs text-red-400">{txError}</p>
      )}

      <Foot>draws sun 23:59 cet · in {countdown}</Foot>
    </Frame>
  );
}

// ---- Layout primitives -------------------------------------------------------

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-black px-6 py-12 text-white">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        {children}
      </div>
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="font-heading text-2xl font-semibold uppercase tracking-[0.22em] text-white">
      {children}
    </h1>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="mt-10 flex flex-col items-center">
      <span className="text-xs uppercase tracking-[0.28em] text-white/40">
        {label}
      </span>
      <span className="mt-3 font-mono text-6xl font-medium text-lime-300 tabular-nums">
        {value}
      </span>
      {sub && (
        <span className="mt-2 text-xs uppercase tracking-[0.22em] text-white/50">
          {sub}
        </span>
      )}
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-6 text-center text-sm leading-relaxed text-white/60">
      {children}
    </p>
  );
}

function Foot({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-12 text-center text-xs uppercase tracking-[0.22em] text-white/40">
      {children}
    </p>
  );
}
