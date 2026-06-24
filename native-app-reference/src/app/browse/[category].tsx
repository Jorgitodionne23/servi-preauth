/**
 * Category detail — lists a category's subcategories. Tapping one opens the
 * service detail preview.
 */
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/Pressable';
import { MessageState } from '@/components/ui/States';
import { categoryByKey } from '@/data/catalog';
import { loc } from '@/data/types';
import { useI18n } from '@/i18n/I18nContext';
import { colors, radius, spacing } from '@/theme/tokens';

export default function CategoryScreen() {
  const { category } = useLocalSearchParams<{ category: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, lang } = useI18n();
  const cat = categoryByKey[category ?? ''];

  if (!cat) {
    return (
      <Screen>
        <ScreenHeader back />
        <MessageState icon="alert-circle" title={t('state.errorTitle')} body={t('state.errorBody')} />
      </Screen>
    );
  }

  return (
    <Screen bottomInset={insets.bottom + spacing.xl}>
      <ScreenHeader back />
      <View style={{ marginTop: spacing.md, marginBottom: spacing.lg }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: radius.lg,
            backgroundColor: colors.accentTint,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: spacing.md,
          }}
        >
          <Icon name={cat.icon} size={26} color={colors.accentInk} />
        </View>
        <Txt variant="displayLg">{loc(cat.label, lang)}</Txt>
        <Txt variant="body" style={{ marginTop: 4 }}>
          {loc(cat.blurb, lang)}
        </Txt>
      </View>

      <Txt variant="eyebrow" style={{ marginBottom: spacing.md }}>
        {t('browse.subcategories')}
      </Txt>
      <View style={{ gap: spacing.sm }}>
        {cat.subs.map((sub) => (
          <PressableScale
            key={sub.key}
            onPress={() => router.push(`/browse/service/${sub.key}?cat=${cat.key}`)}
            scaleTo={0.98}
            haptic={false}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              backgroundColor: colors.bgElevated,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.border,
              padding: spacing.md,
            }}
          >
            <View style={{ width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={sub.icon} size={19} color={colors.accentDeep} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt variant="bodyStrong">{loc(sub.label, lang)}</Txt>
              <Txt variant="caption" numberOfLines={1} style={{ marginTop: 2 }}>
                {sub.services[lang].length} {t('browse.servicesCount')}
              </Txt>
            </View>
            <Icon name="chevron-right" size={18} color={colors.textMuted} />
          </PressableScale>
        ))}
      </View>
    </Screen>
  );
}
