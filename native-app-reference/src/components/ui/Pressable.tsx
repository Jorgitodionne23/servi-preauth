/**
 * PressableScale — a press target with a subtle spring scale + optional haptic.
 * The premium "tap" microinteraction used across the app. Haptics no-op on web.
 */
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { Pressable, type PressableProps } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { motion } from '@/theme/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const EASE = Easing.bezier(...motion.springBezier);

type Props = PressableProps & {
  /** Scale to shrink to while pressed. Default 0.97. */
  scaleTo?: number;
  haptic?: boolean;
};

export function PressableScale({
  scaleTo = 0.97,
  haptic = true,
  onPressIn,
  onPressOut,
  onPress,
  style,
  children,
  ...rest
}: Props) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      {...rest}
      onPress={(e) => {
        if (haptic && Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
        onPress?.(e);
      }}
      onPressIn={(e) => {
        scale.value = withTiming(scaleTo, { duration: 90, easing: EASE });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withTiming(1, { duration: motion.durationFast, easing: EASE });
        onPressOut?.(e);
      }}
      style={[animatedStyle, style as object]}
    >
      {children}
    </AnimatedPressable>
  );
}
