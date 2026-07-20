/**
 * Reusable list rows: ListRow (tappable settings/menu row) and RadioRow
 * (selectable option with teal-tint active state, e.g. ASAP/Schedule, address).
 */
import { ReactNode } from 'react';
import { View } from 'react-native';
import { PressableScale } from './Pressable';
import { Txt } from './Text';
import { Icon, type FeatherName } from './Icon';
import { colors, radius, spacing } from '@/theme/tokens';

export function ListRow({
  icon,
  title,
  subtitle,
  right,
  onPress,
  danger,
  iconTone,
}: {
  icon?: FeatherName;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  danger?: boolean;
  iconTone?: string;
}) {
  const color = danger ? colors.danger : colors.text;
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.99}
      haptic={false}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: 14,
      }}
    >
      {icon ? (
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: radius.sm,
            backgroundColor: danger ? colors.dangerTint : colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={icon} size={18} color={iconTone ?? color} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Txt variant="bodyStrong" color={color}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="caption" style={{ marginTop: 2 }}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {right ?? (onPress ? <Icon name="chevron-right" size={20} color={colors.textMuted} /> : null)}
    </PressableScale>
  );
}

export function RadioRow({
  selected,
  onPress,
  icon,
  title,
  subtitle,
  right,
}: {
  selected: boolean;
  onPress: () => void;
  icon?: FeatherName;
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.98}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.lg,
        borderRadius: radius.md,
        borderWidth: 1.5,
        borderColor: selected ? colors.accentDeep : colors.borderInput,
        backgroundColor: selected ? colors.accentTint : colors.bgElevated,
      }}
    >
      {icon ? <Icon name={icon} size={20} color={selected ? colors.accentInk : colors.textSecondary} /> : null}
      <View style={{ flex: 1 }}>
        <Txt variant="bodyStrong" color={selected ? colors.accentInk : colors.text}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="caption" color={selected ? colors.accentDeep : colors.textMuted} style={{ marginTop: 2 }}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {right ?? (
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            borderWidth: 2,
            borderColor: selected ? colors.accentDeep : colors.borderInput,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {selected ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accentDeep }} /> : null}
        </View>
      )}
    </PressableScale>
  );
}
