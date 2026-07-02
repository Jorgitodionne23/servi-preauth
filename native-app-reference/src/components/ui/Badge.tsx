/**
 * Badge — small status pill. `tone` picks a semantic color pair.
 */
import { View } from 'react-native';
import { Txt } from './Text';
import { Icon, type FeatherName } from './Icon';
import { colors, radius } from '@/theme/tokens';

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

// `fg` colors the dot/icon fill; `ink` colors the label text (AA-passing on `bg`).
const TONES: Record<BadgeTone, { bg: string; fg: string; ink: string }> = {
  neutral: { bg: colors.surface, fg: colors.textSecondary, ink: colors.textSecondary },
  accent: { bg: colors.accentTint, fg: colors.accentDeep, ink: colors.accentInk },
  success: { bg: colors.successTint, fg: colors.success, ink: colors.successInk },
  warning: { bg: colors.warningTint, fg: colors.warning, ink: colors.warningInk },
  danger: { bg: colors.dangerTint, fg: colors.danger, ink: colors.dangerInk },
  info: { bg: colors.accentTint, fg: colors.accentDeep, ink: colors.accentInk },
};

type Props = {
  label: string;
  tone?: BadgeTone;
  icon?: FeatherName;
  dot?: boolean;
};

export function Badge({ label, tone = 'neutral', icon, dot }: Props) {
  const { bg, fg, ink } = TONES[tone];
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: radius.pill,
        backgroundColor: bg,
      }}
    >
      {dot ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: fg }} /> : null}
      {icon ? <Icon name={icon} size={13} color={fg} /> : null}
      <Txt variant="caption" color={ink} style={{ textTransform: 'none' }}>
        {label}
      </Txt>
    </View>
  );
}
