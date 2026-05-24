'use client';

import { useEffect, useImperativeHandle, useRef, forwardRef } from 'react';

export type GlowFieldHandle = {
  burst: (x?: number, y?: number) => void;
};

/**
 * Full-viewport ambient glow that follows the mouse on desktop and the device
 * tilt on mobile. Exposes a `burst()` method (via ref) for click bursts.
 */
export const GlowField = forwardRef<GlowFieldHandle>(function GlowField(_, ref) {
  const root = useRef<HTMLDivElement>(null);

  // Animation state (refs to avoid React re-renders on every frame).
  const target = useRef({ x: 0.5, y: 0.25 });
  const current = useRef({ x: 0.5, y: 0.25 });
  const intensity = useRef(0.35); // 0..1 base opacity of the glow
  const burstIntensity = useRef(0); // additive bump on click, decays
  const radius = useRef(620); // base radius in px
  const burstRadius = useRef(0); // additive bump on click, decays

  useImperativeHandle(ref, () => ({
    burst(x?: number, y?: number) {
      if (typeof x === 'number' && typeof y === 'number') {
        target.current.x = x;
        target.current.y = y;
      }
      burstIntensity.current = 0.55;
      burstRadius.current = 600;
    },
  }));

  useEffect(() => {
    if (!root.current) return;
    const el = root.current;
    let raf = 0;

    const tick = () => {
      // Lerp position toward target.
      current.current.x += (target.current.x - current.current.x) * 0.08;
      current.current.y += (target.current.y - current.current.y) * 0.08;
      // Decay burst additions.
      burstIntensity.current *= 0.92;
      burstRadius.current *= 0.93;

      const op = Math.min(1, intensity.current + burstIntensity.current);
      const r = radius.current + burstRadius.current;

      el.style.setProperty('--gx', `${current.current.x * 100}%`);
      el.style.setProperty('--gy', `${current.current.y * 100}%`);
      el.style.setProperty('--gop', op.toFixed(3));
      el.style.setProperty('--gr', `${r.toFixed(0)}px`);

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onMouseMove = (e: MouseEvent) => {
      target.current.x = e.clientX / window.innerWidth;
      target.current.y = e.clientY / window.innerHeight;
    };

    const onOrient = (e: DeviceOrientationEvent) => {
      // gamma: left/right tilt (-90 to 90)
      // beta: front/back tilt (-180 to 180)
      const gamma = e.gamma ?? 0;
      const beta = e.beta ?? 45; // most phones rest near 45 when held vertically
      // Map tilt to viewport; clamp to 0..1.
      const x = 0.5 + (gamma / 30) * 0.5;
      const y = 0.3 + ((beta - 45) / 60) * 0.5;
      target.current.x = Math.max(0, Math.min(1, x));
      target.current.y = Math.max(0, Math.min(1, y));
    };

    window.addEventListener('mousemove', onMouseMove);

    // iOS 13+ requires explicit permission for deviceorientation.
    const orientAvailable = typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
    const needsPermission =
      orientAvailable &&
      typeof (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> })
        .requestPermission === 'function';

    let orientationAttached = false;
    const attachOrient = () => {
      if (orientationAttached) return;
      orientationAttached = true;
      window.addEventListener('deviceorientation', onOrient);
    };

    const requestOnTouch = async () => {
      try {
        const state = await (
          DeviceOrientationEvent as unknown as {
            requestPermission: () => Promise<string>;
          }
        ).requestPermission();
        if (state === 'granted') attachOrient();
      } catch {
        // permission denied or unsupported — silently fall back to mouse-only
      }
    };

    if (needsPermission) {
      window.addEventListener('touchstart', requestOnTouch, { once: true });
    } else if (orientAvailable) {
      attachOrient();
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('deviceorientation', onOrient);
      window.removeEventListener('touchstart', requestOnTouch);
    };
  }, []);

  return (
    <div
      ref={root}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0"
      style={{
        // Default values before JS hydrates.
        // @ts-expect-error CSS custom properties
        '--gx': '50%',
        '--gy': '25%',
        '--gop': 0.35,
        '--gr': '620px',
        background:
          'radial-gradient(circle var(--gr) at var(--gx) var(--gy), rgba(190, 242, 100, var(--gop)), transparent 65%)',
        transition: 'background 60ms linear',
      }}
    />
  );
});
