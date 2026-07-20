/**
 * Button — primary (ink/black), secondary (outlined), and accent (teal)
 * variants. Mirrors the web `.btn-primary` / `.btn-secondary` system.
 */
import { ActivityIndicator, View, type ViewStyle } from 'react-native';
import { PressableScale } from './Pressable';
import { Txt } from './Text';
import { Icon, type FeatherName } from './Icon';
import { colors, radius } from '@/theme/tokens';

type Variant = 'primary' | 'secondary' | 'accent' | 'ghost' | 'danger';
type Size = 'lg' | 'md' | 'sm';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: FeatherName;
  iconRight?: FeatherName;
  loading?: boolean;
  disabled?: boolean;
  block?: boolean;
  style?: ViewStyle;
};

const HEIGHT: Record<Size, number> = { lg: 56, md: 48, sm: 40 };
const PADX: Record<Size, number> = { lg: 24, md: 18, sm: 14 };

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  iconRight,
  loading = false,
  disabled = false,
  block = true,
  style,
}: Props) {
  const isDisabled = disabled || loading;

  const bg =
    variant === 'primary'
      ? colors.ink
      : variant === 'accent'
        ? colors.accent
        : variant === 'danger'
          ? colors.danger
          : 'transparent';
  const fg =
    variant === 'secondary' || variant === 'ghost'
      ? colors.text
      : variant === 'accent'
        ? colors.accentInk
        : colors.textInverse;
  const border =
    variant === 'secondary'
      ? { borderWidth: 1.5, borderColor: colors.borderStrong }
      : undefined;

  return (
    <PressableScale
      onPress={isDisabled ? undefined : onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      style={[
        {
          height: HEIGHT[size],
          paddingHorizontal: PADX[size],
          borderRadius: radius.md,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
          opacity: isDisabled ? 0.45 : 1,
          alignSelf: block ? 'stretch' : 'flex-start',
        },
        border,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {icon ? <Icon name={icon} size={18} color={fg} /> : null}
          <Txt variant="button" color={fg}>
            {label}
          </Txt>
          {iconRight ? <Icon name={iconRight} size={18} color={fg} /> : null}
        </View>
      )}
    </PressableScale>
  );
}
