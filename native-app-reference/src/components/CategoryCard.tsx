/**
 * Category visual elements: a round icon tile used in Home shortcuts and a
 * full category card used in Browse.
 */
import { View } from 'react-native';
import { PressableScale } from './ui/Pressable';
import { Txt } from './ui/Text';
import { Icon } from './ui/Icon';
import { useI18n } from '@/i18n/I18nContext';
import { loc } from '@/data/types';
import { colors, radius, shadow, spacing } from '@/theme/tokens';
import type { Category } from '@/data/types';

/** Compact icon + label shortcut (Home). */
export function CategoryShortcut({ category, onPress }: { category: Category; onPress: () => void }) {
  const { lang } = useI18n();
  return (
    <PressableScale onPress={onPress} scaleTo={0.95} style={{ alignItems: 'center', width: 72, gap: 8 }}>
      <View
        style={{
          width: 60,
          height: 60,
          borderRadius: radius.lg,
          backgroundColor: colors.bgElevated,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: 'center',
          justifyContent: 'center',
          ...shadow.soft,
        }}
      >
        <Icon name={category.icon} size={24} color={colors.accentDeep} />
      </View>
      <Txt variant="caption" center color={colors.text} numberOfLines={1}>
        {loc(category.label, lang)}
      </Txt>
    </PressableScale>
  );
}

/** Full row card (Browse list). */
export function CategoryCard({ category, onPress }: { category: Category; onPress: () => void }) {
  const { lang } = useI18n();
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.98}
      haptic={false}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.lg,
        backgroundColor: colors.card,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
        ...shadow.soft,
      }}
    >
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: radius.md,
          backgroundColor: colors.accentTint,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={category.icon} size={24} color={colors.accentInk} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt variant="headingSm">{loc(category.label, lang)}</Txt>
        <Txt variant="caption" style={{ marginTop: 3 }}>
          {loc(category.blurb, lang)}
        </Txt>
      </View>
      <Icon name="chevron-right" size={20} color={colors.textMuted} />
    </PressableScale>
  );
}
