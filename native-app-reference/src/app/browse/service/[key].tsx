/**
 * Service detail preview — shows a subcategory's example services and a
 * "Request this" CTA that seeds a draft and enters the request builder.
 */
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PressableScale } from '@/components/ui/Pressable';
import { MessageState } from '@/components/ui/States';
import { findSub, categoryByKey } from '@/data/catalog';
import { loc } from '@/data/types';
import { useApp } from '@/state/AppStateContext';
import { useI18n } from '@/i18n/I18nContext';
import { colors, radius, spacing } from '@/theme/tokens';

export default function ServiceDetailScreen() {
  const { key, cat } = useLocalSearchParams<{ key: string; cat: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, lang } = useI18n();
  const { startFromService } = useApp();

  const category = categoryByKey[cat ?? ''];
  const sub = cat && key ? findSub(cat, key) : null;

  if (!sub || !category) {
    return (
      <Screen>
        <ScreenHeader back />
        <MessageState icon="alert-circle" title={t('state.errorTitle')} body={t('state.errorBody')} />
      </Screen>
    );
  }

  const request = (serviceEs: string, serviceEn: string) => {
    startFromService(category.key, sub.key, serviceEs, serviceEn);
    router.push('/request/build');
  };

  return (
    <Screen
      scroll
      bottomInset={insets.bottom + 100}
    >
      <ScreenHeader back />
      <View style={{ marginTop: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: radius.lg,
              backgroundColor: colors.accentTint,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name={sub.icon} size={26} color={colors.accentInk} />
          </View>
          <View style={{ flex: 1 }}>
            <Badge label={loc(category.label, lang)} tone="neutral" />
            <Txt variant="displayLg" style={{ marginTop: 6 }}>
              {loc(sub.label, lang)}
            </Txt>
          </View>
        </View>

        <Txt variant="eyebrow" style={{ marginTop: spacing.lg, marginBottom: spacing.md }}>
          {t('browse.examples')}
        </Txt>
        <View style={{ gap: spacing.sm }}>
          {sub.services[lang].map((svc, i) => (
            <PressableScale
              key={i}
              onPress={() => request(sub.services.es[i], sub.services.en[i])}
              scaleTo={0.99}
              haptic={false}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                backgroundColor: colors.bgElevated,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.border,
                paddingVertical: 14,
                paddingHorizontal: spacing.lg,
              }}
            >
              <Txt variant="bodyStrong" style={{ flex: 1 }}>
                {svc}
              </Txt>
              <Icon name="arrow-up-right" size={18} color={colors.accentDeep} />
            </PressableScale>
          ))}
        </View>
      </View>

      <View style={{ marginTop: spacing.xl }}>
        <Button
          label={t('browse.requestThis')}
          icon="zap"
          onPress={() => request(sub.services.es[0], sub.services.en[0])}
        />
      </View>
    </Screen>
  );
}
