/**
 * DutyToggle — the on/off shift control.
 *
 * This is the highest-consequence control in the app (off duty = zero income),
 * so it gets a full-width card rather than a settings row, states its
 * consequence in plain language, and animates its own background so the change
 * is felt, not just read.
 */
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Txt } from './ui/Text';
import { Toggle } from './ui/Toggle';
import { useI18n } from '@/i18n/I18nContext';
import { colors, motion, radius, spacing } from '@/theme/tokens';
import { duty } from '@/theme/partner';

const EASE = Easing.bezier(...motion.springBezier);

export function DutyToggle({
  value,
  onChange,
  disabled,
}: {
  value: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, { duration: 260, easing: EASE });
  }, [value, progress]);

  const bg = useAnimatedStyle(() => ({
    backgroundColor: progress.value > 0.5 ? duty.onBg : duty.offBg,
  }));

  const pulse = useAnimatedStyle(() => ({ opacity: 0.35 + progress.value * 0.65 }));

  return (
    <Animated.View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          padding: spacing.lg,
          borderRadius: radius.lg,
        },
        bg,
      ]}
    >
      <Animated.View
        style={[
          {
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: value ? duty.onDot : duty.offDot,
          },
          pulse,
        ]}
      />
      <View style={{ flex: 1 }}>
        <Txt variant="bodyStrong" color={value ? duty.onInk : duty.offInk}>
          {t(value ? 'today.onDuty' : 'today.offDuty')}
        </Txt>
        <Txt
          variant="caption"
          color={value ? duty.onInk : colors.textMuted}
          style={{ marginTop: 2, opacity: value ? 0.8 : 1 }}
        >
          {t(value ? 'today.onDutyHint' : 'today.offDutyHint')}
        </Txt>
      </View>
      <Toggle value={value} onChange={onChange} disabled={disabled} />
    </Animated.View>
  );
}
