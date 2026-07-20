/**
 * SegmentedControl — iOS-style segmented toggle (Active/Past, ASAP/Schedule…).
 */
import { View } from 'react-native';
import { PressableScale } from './Pressable';
import { Txt } from './Text';
import { colors, radius } from '@/theme/tokens';

type Segment = { key: string; label: string };

export function SegmentedControl({
  segments,
  value,
  onChange,
}: {
  segments: Segment[];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        padding: 4,
        gap: 4,
      }}
    >
      {segments.map((s) => {
        const active = s.key === value;
        return (
          <PressableScale
            key={s.key}
            onPress={() => onChange(s.key)}
            scaleTo={0.98}
            style={{
              flex: 1,
              paddingVertical: 9,
              borderRadius: radius.sm,
              backgroundColor: active ? colors.bgElevated : 'transparent',
              alignItems: 'center',
              ...(active
                ? { shadowColor: '#101213', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }
                : {}),
            }}
          >
            <Txt variant="bodySmStrong" color={active ? colors.text : colors.textMuted}>
              {s.label}
            </Txt>
          </PressableScale>
        );
      })}
    </View>
  );
}
