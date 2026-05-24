'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { encodeFunctionData } from 'viem';

import { useWallet } from '@/hooks/use-wallet';
import {
  ENTRY_AMOUNT_ATTO,
  ENTRY_AMOUNT_CRC,
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
    const tick = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(tick);
  }, [refresh]);

  const entrants = useMemo(() => uniqueEntrants(deposits), [deposits]);
  const youEntered = address
    ? entrants.includes(address.toLowerCase())
    : false;
  const potCrc = BigInt(entrants.length) * ENTRY_AMOUNT_CRC;
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
          ENTRY_AMOUNT_ATTO,
          '0x',
        ],
      });
      await sendTransactions([{ to: HUB_V2, data, value: '0' }]);
      await new Promise((r) => setTimeout(r, 2500));
      await refresh();
    } catch (e) {
      setTxError(e instanceof Error ? e.message : 'Transfer failed');
    } finally {
      setSending(false);
    }
  }

  // ---- Render branches -------------------------------------------------------

  return (
    <Frame>
      <Eyebrow>All Together</Eyebrow>

      <Pot
        crc={potCrc.toString()}
        entrants={entrants.length}
        youEntered={youEntered}
        loading={load === 'loading'}
      />

      <Action
        connected={isConnected}
        miniappHost={isMiniappHost}
        loading={load === 'loading'}
        youEntered={youEntered}
        sending={sending}
        onEnter={handleEnter}
      />

      {txError && (
        <p className="mt-3 text-center text-xs text-red-400">{txError}</p>
      )}

      <HowItWorks />

      <Countdown label="entries close in" value={countdown} />
    </Frame>
  );
}

// ---- UI primitives ----------------------------------------------------------

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-start bg-black px-6 pt-12 pb-16 text-white">
      <div className="flex w-full max-w-md flex-1 flex-col items-center text-center">
        {children}
      </div>
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="text-xl font-semibold uppercase tracking-[0.32em] text-white">
      {children}
    </h1>
  );
}

function Pot({
  crc,
  entrants,
  youEntered,
  loading,
}: {
  crc: string;
  entrants: number;
  youEntered: boolean;
  loading: boolean;
}) {
  return (
    <div className="mt-10 flex flex-col items-center">
      <span className="text-[10px] uppercase tracking-[0.32em] text-white/40">
        {youEntered ? 'you’re in · pot' : 'this week’s pot'}
      </span>
      <span className="mt-3 font-mono text-7xl font-medium leading-none text-lime-300 tabular-nums">
        {loading ? '…' : crc}
      </span>
      <span className="mt-3 text-[11px] uppercase tracking-[0.28em] text-white/50">
        CRC
      </span>
      <span className="mt-6 text-xs uppercase tracking-[0.24em] text-white/60">
        {loading
          ? 'reading the chain…'
          : `${entrants} ${entrants === 1 ? 'human' : 'humans'} in`}
      </span>
    </div>
  );
}

function Action({
  connected,
  miniappHost,
  loading,
  youEntered,
  sending,
  onEnter,
}: {
  connected: boolean;
  miniappHost: boolean;
  loading: boolean;
  youEntered: boolean;
  sending: boolean;
  onEnter: () => void;
}) {
  if (!connected) {
    return (
      <p className="mt-8 max-w-xs text-center text-xs uppercase tracking-[0.24em] text-white/50">
        {miniappHost ? 'waiting for wallet…' : 'open inside circles to enter'}
      </p>
    );
  }

  if (loading) {
    return null;
  }

  if (youEntered) {
    return (
      <div className="mt-8 w-full rounded-2xl border border-lime-400/40 px-6 py-5 text-center text-sm uppercase tracking-[0.24em] text-lime-300">
        you&rsquo;re in for this week
      </div>
    );
  }

  return (
    <button
      onClick={onEnter}
      disabled={sending}
      className="mt-8 w-full rounded-2xl border border-lime-400/40 bg-lime-400 px-6 py-5 text-base font-semibold uppercase tracking-[0.22em] text-black transition hover:bg-lime-300 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {sending ? 'confirming…' : `${ENTRY_AMOUNT_CRC} CRC to enter`}
    </button>
  );
}

function HowItWorks() {
  return (
    <section className="mt-10 w-full rounded-2xl border border-white/10 px-6 py-5 text-left">
      <h2 className="text-[10px] uppercase tracking-[0.32em] text-white/40">
        how it works
      </h2>
      <ul className="mt-3 space-y-2 text-sm leading-relaxed text-white/75">
        <li>
          <span className="text-lime-300">·</span> drop {ENTRY_AMOUNT_CRC.toString()} CRC to enter — once per wallet per week
        </li>
        <li>
          <span className="text-lime-300">·</span> sunday 23:59 cet, one human is picked at random
        </li>
        <li>
          <span className="text-lime-300">·</span> they take the full pot home
        </li>
      </ul>
    </section>
  );
}

function Countdown({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-10 flex flex-col items-center">
      <span className="text-[10px] uppercase tracking-[0.32em] text-white/40">
        {label}
      </span>
      <span className="mt-2 font-mono text-3xl font-medium tabular-nums text-white">
        {value}
      </span>
      <span className="mt-1 text-[10px] uppercase tracking-[0.24em] text-white/40">
        sun 23:59 cet
      </span>
    </div>
  );
}
