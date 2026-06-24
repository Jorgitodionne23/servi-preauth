/**
 * Reusable UX states: Loading (skeleton shimmer), Empty, Error, Offline banner.
 * The web app's "thoughtful states" requirement, native edition.
 */
import { useEffect } from 'react';
import { ActivityIndicator, View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Txt } from './Text';
import { Icon, type FeatherName } from './Icon';
import { Button } from './Button';
import { colors, radius, shadow, spacing } from '@/theme/tokens';

// ── Skeleton shimmer ──────────────────────────────────────
export function Skeleton({ height = 16, width = '100%', style }: { height?: number; width?: number | `${number}%`; style?: ViewStyle }) {
  const opacity = useSharedValue(0.5);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [opacity]);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      style={[{ height, width, borderRadius: radius.sm, backgroundColor: colors.shimmer }, animatedStyle, style]}
    />
  );
}

export function LoadingBlock({ label }: { label?: string }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: spacing['3xl'], gap: spacing.md }}>
      <ActivityIndicator color={colors.accentDeep} />
      {label ? <Txt variant="caption">{label}</Txt> : null}
    </View>
  );
}

// ── Centered message state (empty / error) ────────────────
export function MessageState({
  icon,
  title,
  body,
  cta,
  onCta,
  tone = 'neutral',
}: {
  icon: FeatherName;
  title: string;
  body?: string;
  cta?: string;
  onCta?: () => void;
  tone?: 'neutral' | 'danger';
}) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: spacing['3xl'], gap: spacing.md }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: tone === 'danger' ? colors.dangerTint : colors.surface,
        }}
      >
        <Icon name={icon} size={28} color={tone === 'danger' ? colors.danger : colors.textMuted} />
      </View>
      <Txt variant="headingSm" center>
        {title}
      </Txt>
      {body ? (
        <Txt variant="bodySm" center style={{ maxWidth: 300 }}>
          {body}
        </Txt>
      ) : null}
      {cta && onCta ? <Button label={cta} onPress={onCta} block={false} size="md" style={{ marginTop: spacing.sm }} /> : null}
    </View>
  );
}

// ── Offline banner ────────────────────────────────────────
export function OfflineBanner({ visible, label, detail }: { visible: boolean; label: string; detail?: string }) {
  if (!visible) return null;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        backgroundColor: colors.text,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderRadius: radius.md,
        ...shadow.raised,
      }}
    >
      <Icon name="wifi-off" size={18} color={colors.textInverse} />
      <View style={{ flex: 1 }}>
        <Txt variant="bodySmStrong" color={colors.textInverse}>
          {label}
        </Txt>
        {detail ? (
          <Txt variant="caption" color="rgba(255,255,255,0.7)" style={{ marginTop: 1 }}>
            {detail}
          </Txt>
        ) : null}
      </View>
    </View>
  );
}
