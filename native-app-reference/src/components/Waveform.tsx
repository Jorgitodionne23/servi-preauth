/**
 * Waveform — a row of bars that animate while "recording". Simulated amplitude
 * (a production build would feed real mic levels via an AnalyserNode). A tick
 * counter (not per-bar state) drives the motion to keep the effect clean.
 */
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { colors } from '@/theme/tokens';

const BARS = 28;

export function Waveform({ active }: { active: boolean }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick((x) => x + 1), 90);
    return () => clearInterval(id);
  }, [active]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, height: 40 }}>
      {Array.from({ length: BARS }).map((_, i) => {
        const level = active ? 0.25 + Math.abs(Math.sin(i * 0.7 + tick * 0.6)) * 0.75 : 0.2;
        return (
          <View
            key={i}
            style={{
              width: 4,
              borderRadius: 2,
              height: Math.max(4, level * 40),
              backgroundColor: active ? colors.accentDeep : colors.border,
            }}
          />
        );
      })}
    </View>
  );
}
