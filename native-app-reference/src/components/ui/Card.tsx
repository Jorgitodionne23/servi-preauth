/**
 * Card / Surface primitives — subtle bordered cards with soft lift,
 * matching the web `--shadow-card` + 1px border #e7eaea.
 */
import { View, type ViewProps, type ViewStyle } from 'react-native';
import { colors, radius, shadow, spacing } from '@/theme/tokens';

type CardProps = ViewProps & {
  padded?: boolean;
  elevated?: boolean;
  style?: ViewStyle;
};

export function Card({ padded = true, elevated = true, style, children, ...rest }: CardProps) {
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          padding: padded ? spacing.lg : 0,
        },
        elevated ? shadow.card : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Flat tinted surface — for summary rails, info blocks (no border/shadow). */
export function Surface({ style, children, ...rest }: CardProps) {
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          padding: spacing.lg,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Divider({ style }: { style?: ViewStyle }) {
  return <View style={[{ height: 1, backgroundColor: colors.border }, style]} />;
}
