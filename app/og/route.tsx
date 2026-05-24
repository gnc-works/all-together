import { ImageResponse } from 'next/og';

import {
  ENTRY_AMOUNT_CRC,
  fetchCycleDeposits,
  formatCountdown,
  getCycleRange,
  uniqueEntrants,
} from '@/lib/circles';

// Always render at request time so the image reflects the live pot.
export const dynamic = 'force-dynamic';
export const runtime = 'edge';

const SIZE = { width: 1200, height: 630 };

export async function GET() {
  let entrants: string[] = [];
  try {
    const deposits = await fetchCycleDeposits();
    entrants = uniqueEntrants(deposits);
  } catch {
    // fall through to empty state
  }
  const count = entrants.length;
  const pot = (BigInt(count) * ENTRY_AMOUNT_CRC).toString();
  const cycle = getCycleRange();
  const countdown = formatCountdown(cycle.deadline);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px',
          background:
            'radial-gradient(circle at 50% 30%, rgba(190, 242, 100, 0.22), transparent 60%), #000',
          color: 'white',
          fontFamily: 'Helvetica, Arial, sans-serif',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 22,
            letterSpacing: 4,
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.85)',
          }}
        >
          <span>all together</span>
          <span
            style={{
              border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: 999,
              padding: '8px 18px',
              fontSize: 18,
              color: 'rgba(255,255,255,0.6)',
            }}
          >
            cycle 01
          </span>
        </div>

        {/* Hero pot */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <span
            style={{
              fontSize: 24,
              letterSpacing: 6,
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.5)',
            }}
          >
            this week’s pot
          </span>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 18,
              marginTop: 16,
            }}
          >
            <span
              style={{
                fontSize: 240,
                lineHeight: 1,
                color: '#bef264',
                fontWeight: 600,
              }}
            >
              {pot}
            </span>
            <span
              style={{
                fontSize: 36,
                letterSpacing: 6,
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.55)',
              }}
            >
              CRC
            </span>
          </div>
          <span
            style={{
              marginTop: 24,
              fontSize: 28,
              color: 'rgba(255,255,255,0.8)',
            }}
          >
            {count === 0
              ? 'Be the first to enter.'
              : `${count} ${count === 1 ? 'human' : 'humans'} in this week`}
          </span>
        </div>

        {/* Footer line */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 22,
            letterSpacing: 2,
            color: 'rgba(255,255,255,0.55)',
          }}
        >
          <span>Entries close in {countdown}</span>
          <span>Sunday 23:59 CET</span>
        </div>
      </div>
    ),
    SIZE,
  );
}
