/**
 * ServicePicker — "Not quite? Change service" sheet. Category pills filter the
 * subcategory list; tapping a subcategory re-seeds the request.
 */
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { BottomSheet } from './ui/BottomSheet';
import { Chip } from './ui/Chip';
import { PressableScale } from './ui/Pressable';
import { Txt } from './ui/Text';
import { Icon } from './ui/Icon';
import { catalog } from '@/data/catalog';
import { loc } from '@/data/types';
import { useI18n } from '@/i18n/I18nContext';
import { colors, radius, spacing } from '@/theme/tokens';
import type { Subcategory } from '@/data/types';

export function ServicePicker({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (categoryKey: string, sub: Subcategory) => void;
}) {
  const { t, lang } = useI18n();
  const [activeCat, setActiveCat] = useState(catalog[0].key);
  const cat = catalog.find((c) => c.key === activeCat) ?? catalog[0];

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('req.understand.change')}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.md }}>
        {catalog.map((c) => (
          <Chip key={c.key} label={loc(c.label, lang)} active={c.key === activeCat} onPress={() => setActiveCat(c.key)} />
        ))}
      </ScrollView>
      <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
        <View style={{ gap: spacing.sm, paddingTop: spacing.sm }}>
          {cat.subs.map((sub) => (
            <PressableScale
              key={sub.key}
              onPress={() => onPick(cat.key, sub)}
              scaleTo={0.98}
              haptic={false}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                padding: spacing.md,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.bgElevated,
              }}
            >
              <View style={{ width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={sub.icon} size={18} color={colors.accentDeep} />
              </View>
              <Txt variant="bodyStrong" style={{ flex: 1 }}>
                {loc(sub.label, lang)}
              </Txt>
              <Icon name="chevron-right" size={18} color={colors.textMuted} />
            </PressableScale>
          ))}
        </View>
      </ScrollView>
    </BottomSheet>
  );
}
