/**
 * BROWSE — service discovery. Category cards by default; typing in the search
 * field filters subcategories across the whole catalog.
 */
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Text';
import { Input } from '@/components/ui/Input';
import { Icon } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/Pressable';
import { LangToggle } from '@/components/ui/LangToggle';
import { CategoryCard } from '@/components/CategoryCard';
import { MessageState } from '@/components/ui/States';
import { catalog, allSubsFlat } from '@/data/catalog';
import { loc } from '@/data/types';
import { useI18n } from '@/i18n/I18nContext';
import { colors, radius, spacing } from '@/theme/tokens';

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function BrowseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, lang } = useI18n();
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = norm(query.trim());
    if (!q) return null;
    return allSubsFlat().filter(({ category, sub }) => {
      const hay = norm(
        [sub.label.es, sub.label.en, category.label.es, category.label.en, ...sub.keywords, ...sub.services.es, ...sub.services.en].join(' '),
      );
      return hay.includes(q);
    });
  }, [query]);

  return (
    <Screen bottomInset={insets.bottom + 96}>
      <View style={{ paddingTop: insets.top + spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg }}>
          <Txt variant="displayLg">{t('browse.title')}</Txt>
          <LangToggle />
        </View>
        <Input
          icon="search"
          placeholder={t('browse.searchPlaceholder')}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          autoCorrect={false}
        />
      </View>

      {results === null ? (
        <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
          {catalog.map((c) => (
            <CategoryCard key={c.key} category={c} onPress={() => router.push(`/browse/${c.key}`)} />
          ))}
        </View>
      ) : results.length === 0 ? (
        <MessageState icon="search" title={t('browse.noResults')} body={t('browse.noResultsSub')} />
      ) : (
        <Animated.View entering={FadeIn.duration(220)} style={{ marginTop: spacing.xl, gap: spacing.sm }}>
          {results.map(({ category, sub }) => (
            <PressableScale
              key={`${category.key}-${sub.key}`}
              onPress={() => router.push(`/browse/service/${sub.key}?cat=${category.key}`)}
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
              <View style={{ width: 42, height: 42, borderRadius: radius.sm, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={sub.icon} size={18} color={colors.accentDeep} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt variant="bodyStrong">{loc(sub.label, lang)}</Txt>
                <Txt variant="caption" style={{ marginTop: 1 }}>
                  {loc(category.label, lang)}
                </Txt>
              </View>
              <Icon name="chevron-right" size={18} color={colors.textMuted} />
            </PressableScale>
          ))}
        </Animated.View>
      )}
    </Screen>
  );
}
