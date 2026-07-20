/**
 * Request · Submitted — match-pending success. Confirms the request, shows the
 * SV-code, sets the WhatsApp contact expectation, and explains admin matching.
 */
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Surface, Divider } from '@/components/ui/Card';
import { InfoCard } from '@/components/ui/InfoCard';
import { useApp } from '@/state/AppStateContext';
import { useI18n } from '@/i18n/I18nContext';
import { loc } from '@/data/types';
import { colors, spacing } from '@/theme/tokens';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.md }}>
      <Txt variant="caption" style={{ width: 80 }}>
        {label}
      </Txt>
      <Txt variant="bodySmStrong" style={{ flex: 1 }}>
        {value}
      </Txt>
    </View>
  );
}

export default function SubmittedScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, lang } = useI18n();
  const { getOrder } = useApp();
  const order = id ? getOrder(id) : undefined;

  return (
    <Screen bottomInset={insets.bottom + spacing.xl} contentStyle={{ paddingTop: insets.top + spacing.xl }}>
      <Animated.View entering={ZoomIn.duration(420)} style={{ alignItems: 'center', marginTop: spacing.xl }}>
        <View
          style={{
            width: 84,
            height: 84,
            borderRadius: 42,
            backgroundColor: colors.successTint,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="check" size={40} color={colors.success} />
        </View>
      </Animated.View>

      <Animated.View entering={FadeIn.delay(150)} style={{ alignItems: 'center', marginTop: spacing.lg, gap: spacing.sm }}>
        <Txt variant="displayLg" center>
          {t('req.submitted.title')}
        </Txt>
        <Txt variant="body" center style={{ maxWidth: 320 }}>
          {t('req.submitted.body')}
        </Txt>
      </Animated.View>

      {order ? (
        <Surface style={{ marginTop: spacing.xl, gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Txt variant="caption">{t('req.submitted.code')}</Txt>
            <Txt variant="mono" color={colors.text}>
              {order.id}
            </Txt>
          </View>
          <Divider />
          <Row label={t('req.review.service')} value={loc(order.service, lang)} />
          <Row label={t('req.review.when')} value={loc(order.whenLabel, lang)} />
          <Row label={t('req.review.where')} value={order.addressLabel} />
        </Surface>
      ) : null}

      <View style={{ marginTop: spacing.lg }}>
        <InfoCard
          icon="users"
          title={t('req.review.next.step1')}
          body={t('req.submitted.coordinator')}
        />
      </View>

      <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
        <Button
          label={t('req.submitted.openChat')}
          icon="message-circle"
          onPress={() => router.replace('/help')}
        />
        {order ? (
          <Button label={t('req.submitted.trackOrder')} variant="secondary" icon="clipboard" onPress={() => router.replace(`/order/${order.id}`)} />
        ) : null}
        <Button
          label={t('req.submitted.newRequest')}
          variant="ghost"
          onPress={() => router.replace('/(tabs)')}
        />
      </View>
    </Screen>
  );
}
