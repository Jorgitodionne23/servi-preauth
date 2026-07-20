/**
 * Payout account — the bank destination and deposit schedule.
 *
 * Maps to `providers.connect_account_id` + Stripe Connect payout settings. The
 * schedule choice is presented as a real trade-off (free weekly vs on-demand)
 * rather than defaulting someone into fees they didn't notice.
 */
import { View } from 'react-native';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Text';
import { Card, Divider } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { RadioRow } from '@/components/ui/Rows';
import { LangToggle } from '@/components/ui/LangToggle';
import { usePartner } from '@/state/PartnerStateContext';
import { useI18n } from '@/i18n/I18nContext';
import { colors, radius, spacing } from '@/theme/tokens';
import { dateLabel, nextPayoutDate } from '@/data/time';

export default function PayoutAccountScreen() {
  const { t, lang } = useI18n();
  const { payoutAccount, setPayoutSchedule, session } = usePartner();
  const tier = session.specialist?.tier;
  const instantFree = tier === 'oro' || tier === 'elite';

  return (
    <Screen bottomInset={spacing['3xl']}>
      <ScreenHeader back title={t('earn.payoutMethod')} right={<LangToggle />} />

      {/* Account */}
      <Card style={{ marginTop: spacing.lg, gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View
            style={{
              width: 44, height: 44, borderRadius: radius.sm,
              backgroundColor: colors.surface,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Icon name="credit-card" size={19} color={colors.textSecondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt variant="bodyStrong">{payoutAccount.bankName ?? t('earn.noAccount')}</Txt>
            <Txt variant="caption" style={{ marginTop: 2 }}>
              {payoutAccount.last4 ? `CLABE ••••${payoutAccount.last4}` : '—'}
            </Txt>
          </View>
          <Badge
            label={payoutAccount.status === 'active' ? t('prof.verified') : t('prof.pending')}
            tone={payoutAccount.status === 'active' ? 'success' : 'warning'}
          />
        </View>

        <Divider />

        <View style={{ gap: 4 }}>
          <Txt variant="caption">{t('onb.payout.holder')}</Txt>
          <Txt variant="bodySmStrong">{payoutAccount.holderName ?? '—'}</Txt>
        </View>
        <View style={{ gap: 4 }}>
          <Txt variant="caption">{t('onb.payout.rfc')}</Txt>
          <Txt variant="bodySmStrong">{payoutAccount.rfc ?? '—'}</Txt>
        </View>

        <Button label={t('common.edit')} variant="secondary" size="md" />
      </Card>

      {/* Schedule */}
      <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
        <Txt variant="headingMd">{t('payout.standard')}</Txt>
        <RadioRow
          selected={payoutAccount.schedule === 'weekly'}
          onPress={() => setPayoutSchedule('weekly')}
          icon="calendar"
          title={t('payout.standard')}
          subtitle={`${dateLabel(nextPayoutDate(), lang)} · ${t('earn.cashOutFee', { fee: '$0.00' }).split('·')[0].trim()}`}
        />
        <RadioRow
          selected={payoutAccount.schedule === 'manual'}
          onPress={() => setPayoutSchedule('manual')}
          icon="zap"
          title={t('payout.instant')}
          subtitle={instantFree ? t('earn.cashOutFee', { fee: '$0.00' }) : t('earn.cashOutFee', { fee: '1.5%' })}
        />
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
        <Icon name="lock" size={16} color={colors.textSecondary} />
        <Txt variant="bodySm" style={{ flex: 1 }}>
          {t('onb.payout.secure')}
        </Txt>
      </Card>
    </Screen>
  );
}
