'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { encodeFunctionData } from 'viem';

import { useWallet } from '@/hooks/use-wallet';
import {
  ENTRY_AMOUNT_ATTO,
  ENTRY_AMOUNT_CRC,
  HUB_ABI,
  HUB_V2,
  POOL_SAFE,
  fetchCycleDeposits,
  fetchProfile,
  fetchProfiles,
  formatCountdown,
  getCycleRange,
  shortAddress,
  uniqueEntrants,
  type DepositRow,
  type ProfileLite,
} from '@/lib/circles';
import { GlowField, type GlowFieldHandle } from './GlowField';

type LoadState = 'loading' | 'ready' | 'error';

export function PoolHero() {
  const { address, isConnected, isMiniappHost } = useWallet();
  const cycle = useMemo(() => getCycleRange(), []);
  const glow = useRef<GlowFieldHandle>(null);

  const [deposits, setDeposits] = useState<DepositRow[]>([]);
  const [entrantProfiles, setEntrantProfiles] = useState<ProfileLite[]>([]);
  const [me, setMe] = useState<ProfileLite | null>(null);
  const [load, setLoad] = useState<LoadState>('loading');
  const [now, setNow] = useState(Date.now());
  const [sending, setSending] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);

  const entrants = useMemo(() => uniqueEntrants(deposits), [deposits]);

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
    const pollDeposits = setInterval(refresh, 30_000);
    return () => {
      clearInterval(tick);
      clearInterval(pollDeposits);
    };
  }, [refresh]);

  // Fetch entrant profiles whenever the entrant set changes.
  useEffect(() => {
    if (entrants.length === 0) {
      setEntrantProfiles([]);
      return;
    }
    let cancelled = false;
    fetchProfiles(entrants).then((profiles) => {
      if (!cancelled) setEntrantProfiles(profiles);
    });
    return () => {
      cancelled = true;
    };
  }, [entrants.length, entrants.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch own profile when wallet connects.
  useEffect(() => {
    if (!address) {
      setMe(null);
      return;
    }
    let cancelled = false;
    fetchProfile(address).then((p) => {
      if (!cancelled) setMe(p);
    });
    return () => {
      cancelled = true;
    };
  }, [address]);

  const youEntered = address ? entrants.includes(address.toLowerCase()) : false;
  const potCrc = (BigInt(entrants.length) * ENTRY_AMOUNT_CRC).toString();
  const countdown = formatCountdown(cycle.deadline, now);
  const myBalanceNum = me?.v2Balance ? Number(me.v2Balance) : null;
  const insufficient =
    myBalanceNum !== null && myBalanceNum < Number(ENTRY_AMOUNT_CRC);

  async function handleEnter(e?: React.MouseEvent) {
    if (!address) return;
    if (e) {
      glow.current?.burst(
        e.clientX / window.innerWidth,
        e.clientY / window.innerHeight,
      );
    }
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
      glow.current?.burst();
    } catch (e2) {
      setTxError(e2 instanceof Error ? e2.message : 'Transfer failed');
    } finally {
      setSending(false);
    }
  }

  async function handleShare() {
    const url = 'https://all-together-gamma.vercel.app';
    const text =
      entrants.length > 0
        ? `${potCrc} CRC in this week's All Together pool. ${entrants.length} ${
            entrants.length === 1 ? 'human' : 'humans'
          } in. Draw Sunday 23:59 CET.`
        : "Be the first into this week's All Together pool. Draw Sunday 23:59 CET.";

    const sharePayload = { title: 'All Together', text, url };
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share(sharePayload);
        return;
      } catch {
        // user cancelled — fall through to clipboard
      }
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(`${text} ${url}`);
      } catch {
        // noop
      }
    }
  }

  return (
    <main className="relative flex min-h-[100dvh] w-full flex-col items-center bg-black text-white">
      <GlowField ref={glow} />

      <div className="relative z-10 flex w-full max-w-md flex-1 flex-col px-5 pt-8 pb-10 sm:px-6">
        <Header me={me} connected={isConnected} />

        <Hero
          potCrc={potCrc}
          entrants={entrants}
          profiles={entrantProfiles}
          youEntered={youEntered}
          loading={load === 'loading'}
        />

        <CTA
          connected={isConnected}
          miniappHost={isMiniappHost}
          loading={load === 'loading'}
          youEntered={youEntered}
          sending={sending}
          insufficient={insufficient}
          onEnter={handleEnter}
          onShare={handleShare}
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

function Header({ me, connected }: { me: ProfileLite | null; connected: boolean }) {
  return (
    <header className="flex w-full items-center justify-between text-[11px] font-medium uppercase tracking-[0.2em]">
      <span className="text-white/85">all together</span>
      {connected && me ? (
        <WalletChip me={me} />
      ) : (
        <span className="rounded-full border border-white/15 px-3 py-1 text-white/50">
          cycle 01
        </span>
      )}
    </header>
  );
}

function WalletChip({ me }: { me: ProfileLite }) {
  const label = me.name ?? shortAddress(me.address);
  const balance = me.v2Balance
    ? `${Math.floor(Number(me.v2Balance))} CRC`
    : null;
  // Use first 2 hex chars *after* 0x for the fallback monogram (e.g. "7F").
  const monogram = me.address.slice(2, 4).toUpperCase();
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] py-1 pr-3 pl-1">
      {me.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={me.avatar}
          alt=""
          className="h-6 w-6 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-lime-300/15 text-[9px] font-semibold tracking-normal text-lime-300">
          {monogram}
        </div>
      )}
      <div className="flex flex-col text-left leading-tight">
        <span className="text-[10px] font-medium normal-case tracking-normal text-white/85">
          {label}
        </span>
        {balance && (
          <span className="text-[9px] tracking-normal text-white/45">
            {balance}
          </span>
        )}
      </div>
    </div>
  );
}

function Hero({
  potCrc,
  entrants,
  profiles,
  youEntered,
  loading,
}: {
  potCrc: string;
  entrants: string[];
  profiles: ProfileLite[];
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
          style={{ textShadow: '0 0 60px rgba(190, 242, 100, 0.35)' }}
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
        ) : count === 0 ? (
          'be the first to enter'
        ) : (
          <>
            <span className="font-medium text-white">{count}</span>{' '}
            {count === 1 ? 'human' : 'humans'} in this week
          </>
        )}
      </p>

      {count > 0 && !loading && (
        <AvatarRow profiles={profiles} entrants={entrants} />
      )}
    </section>
  );
}

function AvatarRow({
  profiles,
  entrants,
}: {
  profiles: ProfileLite[];
  entrants: string[];
}) {
  const visible = Math.min(entrants.length, 18);
  const overflow = entrants.length - visible;
  const profileByAddress = useMemo(() => {
    const map = new Map<string, ProfileLite>();
    for (const p of profiles) map.set(p.address.toLowerCase(), p);
    return map;
  }, [profiles]);

  return (
    <div className="mt-5 flex max-w-full flex-wrap items-center justify-center gap-2">
      {entrants.slice(0, visible).map((addr) => {
        const p = profileByAddress.get(addr);
        const initials = (p?.name ?? addr).slice(0, 2).toUpperCase();
        return p?.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={addr}
            src={p.avatar}
            alt={p.name ?? shortAddress(addr)}
            title={p.name ?? shortAddress(addr)}
            className="h-7 w-7 rounded-full border border-white/15 object-cover"
          />
        ) : (
          <div
            key={addr}
            title={shortAddress(addr)}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-[9px] font-semibold text-white/60"
          >
            {initials}
          </div>
        );
      })}
      {overflow > 0 && (
        <span className="ml-1 text-xs text-white/50">+{overflow}</span>
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
  insufficient,
  onEnter,
  onShare,
}: {
  connected: boolean;
  miniappHost: boolean;
  loading: boolean;
  youEntered: boolean;
  sending: boolean;
  insufficient: boolean;
  onEnter: (e: React.MouseEvent) => void;
  onShare: () => void;
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
      <div className="mt-10 flex flex-col gap-3">
        <div className="flex items-center justify-center gap-3 rounded-2xl border-2 border-lime-300/50 bg-lime-300/[0.06] px-6 py-5 text-center">
          <span className="inline-block h-2 w-2 rounded-full bg-lime-300 shadow-[0_0_12px_rgba(190,242,100,0.8)]" />
          <span className="text-base font-medium text-lime-100">
            You’re in for this week
          </span>
        </div>
        <button
          onClick={onShare}
          className="w-full rounded-2xl border border-white/15 bg-white/[0.03] px-6 py-3 text-sm font-medium text-white/85 transition hover:bg-white/[0.06] active:scale-[0.98]"
        >
          Share with friends →
        </button>
      </div>
    );
  }

  if (insufficient) {
    return (
      <div className="mt-10 rounded-2xl border border-white/15 bg-white/[0.03] px-6 py-5 text-center">
        <p className="text-sm text-white/85">
          Need at least {ENTRY_AMOUNT_CRC.toString()} CRC to enter.
        </p>
        <p className="mt-1 text-xs text-white/50">
          Keep minting — Circles drops 1 CRC per hour.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-10 flex flex-col gap-3">
      <button
        onClick={onEnter}
        disabled={sending}
        className="flex w-full items-center justify-between rounded-2xl bg-lime-300 px-6 py-5 text-left text-black shadow-[0_10px_40px_-10px_rgba(190,242,100,0.55)] transition active:scale-[0.98] active:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
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
      <button
        onClick={onShare}
        className="w-full rounded-2xl border border-white/15 bg-white/[0.03] px-6 py-3 text-sm font-medium text-white/70 transition hover:bg-white/[0.06] active:scale-[0.98]"
      >
        Share with friends →
      </button>
    </div>
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
