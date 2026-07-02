/**
 * Txt — typography-preset Text. `variant` maps to the presets in
 * theme/typography.ts so screens never hardcode font sizes.
 */
import { Text as RNText, type TextProps } from 'react-native';
import { type } from '@/theme/typography';

type Variant = keyof typeof type;

type Props = TextProps & {
  variant?: Variant;
  color?: string;
  center?: boolean;
};

export function Txt({ variant = 'body', color, center, style, children, ...rest }: Props) {
  return (
    <RNText
      {...rest}
      style={[type[variant], color ? { color } : null, center ? { textAlign: 'center' } : null, style]}
    >
      {children}
    </RNText>
  );
}
