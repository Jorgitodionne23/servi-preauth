/**
 * useCountdown — seconds remaining until an ISO deadline.
 *
 * Runs on the REAL clock (not the frozen `DEMO_NOW`) because an offer's
 * accept-or-lose-it pressure is the one thing in this prototype that has to be
 * felt in real time to be evaluated honestly.
 *
 * Implemented with `useSyncExternalStore` over the system clock, which is
 * precisely what that hook is for: the clock is an external mutable source, and
 * subscribing to it this way avoids both of the patterns React's lint rules
 * (correctly) reject here — writing state synchronously inside an effect, and
 * calling an impure function during render.
 *
 * The snapshot is the current *whole second*, so it's stable across re-renders
 * within the same second and can't drive a render loop. Polling at 250 ms keeps
 * the visible tick from lagging up to a second behind.
 */
import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void): () => void {
  const id = setInterval(onChange, 250);
  return () => clearInterval(id);
}

function getSnapshot(): number {
  return Math.floor(Date.now() / 1000);
}

export function useCountdown(deadlineIso: string | null): number {
  const nowSeconds = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  if (!deadlineIso) return 0;
  return Math.max(0, Math.floor(new Date(deadlineIso).getTime() / 1000) - nowSeconds);
}
