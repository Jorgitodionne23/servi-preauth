/**
 * Payment & pre-authorization reference (modal). Explains SERVI's payment model
 * accurately, as UI references only — NO Stripe, NO real payments. Covers: card
 * hold (not a charge), payment link, saved-card consent, auto pre-auth ~24h
 * before, the 5-day saved-card rule, and visits-always-need-a-card.
 */
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Text';
import { Icon, type FeatherName } from '@/components/ui/Icon';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { InfoCard } from '@/components/ui/InfoCard';
import { PressableScale } from '@/components/ui/Pressable';
import { useI18n } from '@/i18n/I18nContext';
import { colors, radius, spacing } from '@/theme/tokens';
import type { StringKey } from '@/i18n/strings';

const CONCEPTS: { icon: FeatherName; title: StringKey; body: StringKey }[] = [
  { icon: 'credit-card', title: 'pay.hold.title', body: 'pay.hold.body' },
  { icon: 'link', title: 'pay.link.title', body: 'pay.link.body' },
  { icon: 'shield', title: 'pay.saved.title', body: 'pay.saved.body' },
  { icon: 'clock', title: 'pay.auto.title', body: 'pay.auto.body' },
  { icon: 'calendar', title: 'pay.fiveday.title', body: 'pay.fiveday.body' },
  { icon: 'eye', title: 'pay.visit.title', body: 'pay.visit.body' },
];

export default function PaymentInfoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();

  return (
    <Screen bottomInset={insets.bottom + spacing.xl}>
      <ScreenHeader
        title={t('pay.title')}
        right={
          <PressableScale onPress={() => router.back()} haptic={false} style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }}>
            <Icon name="x" size={18} color={colors.text} />
          </PressableScale>
        }
      />

      <View style={{ marginTop: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.warningTint, padding: spacing.md, borderRadius: radius.md }}>
          <Icon name="info" size={16} color={colors.warning} />
          <Txt variant="bodySmStrong" color={colors.warning} style={{ flex: 1 }}>
            {t('pay.refDisclaimer')}
          </Txt>
        </View>
      </View>

      <Card style={{ marginTop: spacing.lg, gap: spacing.xl }}>
        {CONCEPTS.map((c) => (
          <InfoCard key={c.title} icon={c.icon} title={t(c.title)} body={t(c.body)} />
        ))}
      </Card>

      <View style={{ marginTop: spacing.lg, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <Badge label="primary" tone="neutral" />
        <Badge label="book" tone="neutral" />
        <Badge label="setup" tone="neutral" />
        <Badge label="visit" tone="neutral" />
      </View>
      <Txt variant="caption" style={{ marginTop: spacing.sm }}>
        {t('pay.refDisclaimer')} · order kinds shown for reference only.
      </Txt>
    </Screen>
  );
}
