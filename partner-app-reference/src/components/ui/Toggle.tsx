/**
 * Toggle — iOS-style switch. RN's built-in `Switch` renders inconsistently
 * across web/iOS/Android and can't be tinted to the SERVI palette on all three,
 * so this is a small hand-rolled one with the app's spring easing.
 */
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { PressableScale } from './Pressable';
import { colors, motion } from '@/theme/tokens';

const EASE = Easing.bezier(...motion.springBezier);

export function Toggle({
  value,
  onChange,
  onColor = colors.success,
  disabled,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  onColor?: string;
  disabled?: boolean;
}) {
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, { duration: 200, easing: EASE });
  }, [value, progress]);

  const knob = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * 20 }],
  }));

  return (
    <PressableScale
      onPress={disabled ? undefined : () => onChange(!value)}
      scaleTo={0.94}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: !!disabled }}
      style={{ opacity: disabled ? 0.45 : 1 }}
    >
      <View
        style={{
          width: 50,
          height: 30,
          borderRadius: 15,
          padding: 3,
          backgroundColor: value ? onColor : colors.borderStrong,
          justifyContent: 'center',
        }}
      >
        <Animated.View
          style={[
            {
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: '#ffffff',
              shadowColor: '#101213',
              shadowOpacity: 0.2,
              shadowRadius: 3,
              shadowOffset: { width: 0, height: 1 },
            },
            knob,
          ]}
        />
      </View>
    </PressableScale>
  );
}
