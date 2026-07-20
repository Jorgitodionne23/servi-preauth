/**
 * Step 5 — where the money lands.
 *
 * CLABE, not "account number": it's the 18-digit Mexican interbank standard and
 * using the local term is table stakes for credibility with a CDMX tradesperson.
 * RFC is explicitly optional with the threshold stated, so nobody abandons the
 * flow believing they need to be formally registered to start earning.
 *
 * Production wires this to Stripe Connect (`providers.connect_account_id`);
 * nothing here touches Stripe.
 */
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Field, Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { StepHeader } from '@/components/StepHeader';
import { usePartner } from '@/state/PartnerStateContext';
import { useI18n } from '@/i18n/I18nContext';
import { colors, radius, spacing } from '@/theme/tokens';

export default function PayoutScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { onboarding, patchOnboarding } = usePartner();

  const clabeDigits = onboarding.clabe.replace(/\D/g, '');
  const valid = onboarding.bankHolder.trim().length > 3 && clabeDigits.length === 18;

  return (
    <Screen bottomInset={spacing['3xl']}>
      <StepHeader step={5} title={t('onb.payout.title')} subtitle={t('onb.payout.subtitle')} />

      <View style={{ marginTop: spacing.xl, gap: spacing.lg }}>
        <Field label={t('onb.payout.holder')}>
          <Input
            icon="user"
            value={onboarding.bankHolder}
            onChangeText={(v) => patchOnboarding({ bankHolder: v })}
            autoCapitalize="words"
            placeholder="Como aparece en tu banco"
          />
        </Field>

        <Field
          label={t('onb.payout.clabe')}
          hint={clabeDigits.length > 0 ? `${clabeDigits.length}/18` : undefined}
        >
          <Input
            icon="credit-card"
            value={onboarding.clabe}
            onChangeText={(v) => patchOnboarding({ clabe: v })}
            keyboardType="numeric"
            inputMode="numeric"
            maxLength={22}
            placeholder="012 180 00123456789 0"
          />
        </Field>

        <Field label={`${t('onb.payout.rfc')} · ${t('common.optional')}`} hint={t('onb.payout.rfcHint')}>
          <Input
            icon="file-text"
            value={onboarding.rfc}
            onChangeText={(v) => patchOnboarding({ rfc: v.toUpperCase() })}
            autoCapitalize="characters"
            maxLength={13}
            placeholder="XAXX010101000"
          />
        </Field>
      </View>

      <Card
        style={{
          marginTop: spacing.xl,
          flexDirection: 'row',
          gap: spacing.md,
          alignItems: 'flex-start',
          backgroundColor: colors.surface,
        }}
        elevated={false}
      >
        <View
          style={{
            width: 34, height: 34, borderRadius: radius.sm,
            backgroundColor: colors.bgElevated,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Icon name="lock" size={16} color={colors.textSecondary} />
        </View>
        <Txt variant="bodySm" style={{ flex: 1 }}>
          {t('onb.payout.secure')}
        </Txt>
      </Card>

      <View style={{ marginTop: spacing.xl }}>
        <Button
          label={t('common.continue')}
          disabled={!valid}
          iconRight="arrow-right"
          onPress={() => router.push('/onboarding/review')}
        />
      </View>
    </Screen>
  );
}
