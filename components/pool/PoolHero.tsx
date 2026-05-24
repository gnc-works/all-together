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
  const potCrc = (BigInt(entrants.length) * ENTRY_AMOUNT_CRC).toString();
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

  return (
    <main className="relative flex min-h-[100dvh] w-full flex-col items-center bg-black text-white">
      {/* Subtle radial glow behind the pot */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[60%] opacity-50"
        style={{
          background:
            'radial-gradient(ellipse at 50% 20%, rgba(190, 242, 100, 0.18), transparent 65%)',
        }}
      />

      <div className="relative z-10 flex w-full max-w-md flex-1 flex-col px-5 pt-8 pb-10 sm:px-6">
        <Header />

        <Hero
          potCrc={potCrc}
          entrants={entrants}
          youEntered={youEntered}
          loading={load === 'loading'}
        />

        <CTA
          connected={isConnected}
          miniappHost={isMiniappHost}
          loading={load === 'loading'}
          youEntered={youEntered}
          sending={sending}
          onEnter={handleEnter}
        />

        {txError && (
          <p className="mt-3 text-center text-sm text-red-400">{txError}</p>
        )}

        <Timer value={countdown} />

        <Rules />

        <Footer />
      </div>
    </main>
  );
}

// ---- Sections ---------------------------------------------------------------

function Header() {
  return (
    <header className="flex w-full items-center justify-between text-[11px] font-medium uppercase tracking-[0.2em] text-white/50">
      <span className="text-white/85">all together</span>
      <span className="rounded-full border border-white/15 px-3 py-1">
        cycle 01
      </span>
    </header>
  );
}

function Hero({
  potCrc,
  entrants,
  youEntered,
  loading,
}: {
  potCrc: string;
  entrants: string[];
  youEntered: boolean;
  loading: boolean;
}) {
  const count = entrants.length;
  return (
    <section className="mt-12 flex flex-col items-center text-center">
      <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-white/45">
        {youEntered ? 'you’re in · pot' : 'this week’s pot'}
      </p>

      <div className="mt-4 flex items-baseline gap-2">
        <span
          className="font-numeric text-[88px] leading-none font-medium text-lime-300"
          style={{
            textShadow: '0 0 60px rgba(190, 242, 100, 0.35)',
          }}
        >
          {loading ? '—' : potCrc}
        </span>
        <span className="text-base font-medium uppercase tracking-[0.18em] text-white/55">
          CRC
        </span>
      </div>

      <p className="mt-4 text-sm text-white/65">
        {loading ? (
          'reading the chain…'
        ) : (
          <>
            <span className="font-medium text-white">{count}</span>{' '}
            {count === 1 ? 'human' : 'humans'} in this week
          </>
        )}
      </p>

      {count > 0 && !loading && <DotRow count={count} youEntered={youEntered} />}
    </section>
  );
}

function DotRow({ count, youEntered }: { count: number; youEntered: boolean }) {
  const visible = Math.min(count, 24);
  const overflow = count - visible;
  return (
    <div className="mt-5 flex max-w-full flex-wrap items-center justify-center gap-1.5">
      {Array.from({ length: visible }).map((_, i) => (
        <span
          key={i}
          className={`h-2 w-2 rounded-full ${
            youEntered && i === visible - 1 ? 'bg-lime-300' : 'bg-white/40'
          }`}
        />
      ))}
      {overflow > 0 && (
        <span className="ml-1 text-xs text-white/45">+{overflow}</span>
      )}
    </div>
  );
}

function CTA({
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
      <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-5 text-center">
        <p className="text-sm text-white/70">
          {miniappHost
            ? 'Waiting for your wallet…'
            : 'Open this inside the Circles app to enter.'}
        </p>
      </div>
    );
  }

  if (loading) {
    return <div className="mt-10 h-[68px] animate-pulse rounded-2xl bg-white/5" />;
  }

  if (youEntered) {
    return (
      <div className="mt-10 flex items-center justify-center gap-3 rounded-2xl border-2 border-lime-300/50 bg-lime-300/[0.06] px-6 py-5 text-center">
        <span className="inline-block h-2 w-2 rounded-full bg-lime-300 shadow-[0_0_12px_rgba(190,242,100,0.8)]" />
        <span className="text-base font-medium text-lime-100">
          You’re in for this week
        </span>
      </div>
    );
  }

  return (
    <button
      onClick={onEnter}
      disabled={sending}
      className="mt-10 flex w-full items-center justify-between rounded-2xl bg-lime-300 px-6 py-5 text-left text-black shadow-[0_10px_40px_-10px_rgba(190,242,100,0.45)] transition active:scale-[0.98] active:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="flex flex-col">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/55">
          {sending ? 'Confirming…' : 'Enter the pool'}
        </span>
        <span className="font-numeric text-2xl font-semibold leading-tight">
          {ENTRY_AMOUNT_CRC.toString()} CRC
        </span>
      </span>
      <span className="text-3xl leading-none">{sending ? '…' : '→'}</span>
    </button>
  );
}

function Timer({ value }: { value: string }) {
  return (
    <div className="mt-10 flex flex-col items-center rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-5">
      <span className="text-[11px] font-medium uppercase tracking-[0.24em] text-white/45">
        Entries close in
      </span>
      <span className="font-numeric mt-2 text-2xl font-medium tabular-nums text-white">
        {value}
      </span>
      <span className="mt-1 text-[11px] text-white/40">Sunday 23:59 CET</span>
    </div>
  );
}

function Rules() {
  const steps = [
    { n: 1, t: `Drop ${ENTRY_AMOUNT_CRC} CRC into the pool (once per wallet, per week).` },
    { n: 2, t: 'Sunday 23:59 CET, one human is picked at random.' },
    { n: 3, t: 'They take the full pot home.' },
  ];
  return (
    <section className="mt-10 rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-5">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/55">
        How it works
      </h2>
      <ol className="mt-4 space-y-3 text-[15px] leading-snug text-white/80">
        {steps.map((s) => (
          <li key={s.n} className="flex gap-3">
            <span className="font-numeric mt-[2px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-lime-300/15 text-[11px] font-semibold text-lime-300">
              {s.n}
            </span>
            <span>{s.t}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Footer() {
  return (
    <footer className="mt-10 flex flex-col items-center gap-1 text-[11px] text-white/35">
      <a
        href={`https://gnosisscan.io/address/${POOL_SAFE}`}
        target="_blank"
        rel="noopener"
        className="font-numeric tracking-wider underline-offset-4 hover:underline"
      >
        Pool safe · {POOL_SAFE.slice(0, 6)}…{POOL_SAFE.slice(-4)}
      </a>
      <span>Built for Circles Garage · Cycle 01</span>
    </footer>
  );
}
