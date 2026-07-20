/**
 * Why SERVI — the retention argument, stated once, honestly.
 *
 * This screen exists because of a specific business risk: a specialist and a
 * client meet through SERVI, like each other, and agree to skip the platform
 * next time. Threatening people doesn't stop that. What stops it is making the
 * value legible — so this is a side-by-side comparison where the "on your own"
 * column is written fairly, not as a strawman. If SERVI's side doesn't win on
 * an honest reading, the answer is to fix the product, not the copy.
 *
 * The one hard line — going off-platform ends the relationship — is stated
 * plainly at the bottom, after the argument, not instead of it.
 */
import { View } from 'react-native';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Icon, type FeatherName } from '@/components/ui/Icon';
import { LangToggle } from '@/components/ui/LangToggle';
import { usePartner } from '@/state/PartnerStateContext';
import { useI18n } from '@/i18n/I18nContext';
import { computePricing, serviFeeShare } from '@/data/pricing';
import { colors, radius, spacing } from '@/theme/tokens';
import { ledger, money } from '@/theme/partner';
import type { StringKey } from '@/i18n/strings';

const ROWS: { icon: FeatherName; t: StringKey; servi: StringKey; direct: StringKey }[] = [
  { icon: 'shield', t: 'why.pay.t', servi: 'why.pay.servi', direct: 'why.pay.direct' },
  { icon: 'dollar-sign', t: 'why.cut.t', servi: 'why.cut.servi', direct: 'why.cut.direct' },
  { icon: 'users', t: 'why.clients.t', servi: 'why.clients.servi', direct: 'why.clients.direct' },
  { icon: 'message-square', t: 'why.disputes.t', servi: 'why.disputes.servi', direct: 'why.disputes.direct' },
  { icon: 'plus-circle', t: 'why.extra.t', servi: 'why.extra.servi', direct: 'why.extra.direct' },
  { icon: 'umbrella', t: 'why.noshow.t', servi: 'why.noshow.servi', direct: 'why.noshow.direct' },
  { icon: 'trending-up', t: 'why.growth.t', servi: 'why.growth.servi', direct: 'why.growth.direct' },
];

export default function WhyServiScreen() {
  const { t, tn } = useI18n();
  const { earnings } = usePartner();

  // A concrete worked example beats an abstract percentage.
  const example = computePricing(500);
  const feePct = Math.round(serviFeeShare(example) * 100);

  return (
    <Screen bottomInset={spacing['3xl']}>
      <ScreenHeader back title={t('why.title')} right={<LangToggle />} />

      <View style={{ marginTop: spacing.lg }}>
        <Txt variant="displayLg">{t('why.title')}</Txt>
        <Txt variant="body" style={{ marginTop: spacing.sm }}>
          {t('why.subtitle')}
        </Txt>
      </View>

      {/* ── The worked example ──────────────────────────────── */}
      <View
        style={{
          marginTop: spacing.xl,
          backgroundColor: ledger.bg,
          borderRadius: radius.lg,
          padding: spacing.xl,
          gap: spacing.lg,
        }}
      >
        <Txt variant="eyebrow" color={ledger.textMuted}>
          {t('why.cut.t')}
        </Txt>

        <View style={{ gap: spacing.md }}>
          <LedgerRow
            label={t('offer.youEarn')}
            value={money(example.providerAmountCents)}
            emphasis
          />
          <LedgerRow
            label={t('job.serviFee')}
            value={money(example.totalAmountCents - example.providerAmountCents)}
            muted
          />
          <View style={{ height: 1, backgroundColor: ledger.border }} />
          <LedgerRow label={t('job.clientPays')} value={money(example.totalAmountCents)} muted />
        </View>

        <View
          style={{
            flexDirection: 'row',
            gap: spacing.sm,
            alignItems: 'flex-start',
            padding: spacing.md,
            borderRadius: radius.md,
            backgroundColor: ledger.bgSoft,
          }}
        >
          <Icon name="check-circle" size={15} color={ledger.positive} />
          <Txt variant="caption" color={ledger.text} style={{ flex: 1 }}>
            {t('why.cut.servi')}
          </Txt>
        </View>

        <Txt variant="caption" color={ledger.textMuted}>
          {feePct}% · {t('job.serviFee')} — {t('job.feeNote')}
        </Txt>
      </View>

      {/* ── Comparison ──────────────────────────────────────── */}
      <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
        <Txt variant="headingMd">{t('why.compare')}</Txt>

        {ROWS.map((row) => (
          <Card key={row.t} style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View
                style={{
                  width: 36, height: 36, borderRadius: radius.sm,
                  backgroundColor: colors.accentTint,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Icon name={row.icon} size={17} color={colors.accentInk} />
              </View>
              <Txt variant="bodyStrong" style={{ flex: 1 }}>
                {t(row.t)}
              </Txt>
            </View>

            <View
              style={{
                flexDirection: 'row',
                gap: 8,
                alignItems: 'flex-start',
                padding: spacing.md,
                borderRadius: radius.sm,
                backgroundColor: colors.successTint,
              }}
            >
              <Icon name="check" size={14} color={colors.successInk} />
              <View style={{ flex: 1 }}>
                <Txt variant="caption" color={colors.successInk} style={{ textTransform: 'uppercase' }}>
                  {t('why.col.servi')}
                </Txt>
                <Txt variant="bodySm" color={colors.successInk} style={{ marginTop: 3 }}>
                  {t(row.servi)}
                </Txt>
              </View>
            </View>

            <View
              style={{
                flexDirection: 'row',
                gap: 8,
                alignItems: 'flex-start',
                padding: spacing.md,
                borderRadius: radius.sm,
                backgroundColor: colors.surface,
              }}
            >
              <Icon name="minus" size={14} color={colors.textMuted} />
              <View style={{ flex: 1 }}>
                <Txt variant="caption" style={{ textTransform: 'uppercase' }}>
                  {t('why.col.direct')}
                </Txt>
                <Txt variant="bodySm" style={{ marginTop: 3 }}>
                  {t(row.direct)}
                </Txt>
              </View>
            </View>
          </Card>
        ))}
      </View>

      {/* ── Your own numbers, as proof ──────────────────────── */}
      <Card style={{ marginTop: spacing.xl, gap: spacing.md }}>
        <Txt variant="headingSm">{t('earn.thisMonth')}</Txt>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
          <Txt variant="displayLg">{money(earnings.monthCents)}</Txt>
          <Txt variant="caption">{tn('earn.jobsCount', earnings.monthJobs)}</Txt>
        </View>
        <Txt variant="bodySm">{t('why.clients.servi')}</Txt>
      </Card>

      {/* ── The line ────────────────────────────────────────── */}
      <View
        style={{
          marginTop: spacing.xl,
          flexDirection: 'row',
          gap: spacing.md,
          alignItems: 'flex-start',
          padding: spacing.lg,
          borderRadius: radius.md,
          backgroundColor: colors.warningTint,
        }}
      >
        <Icon name="alert-triangle" size={17} color={colors.warningInk} />
        <Txt variant="bodySm" color={colors.warningInk} style={{ flex: 1 }}>
          {t('why.footer')}
        </Txt>
      </View>
    </Screen>
  );
}

function LedgerRow({
  label,
  value,
  emphasis,
  muted,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  muted?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.md }}>
      <Txt variant="bodySm" color={muted ? ledger.textMuted : ledger.text} style={{ flex: 1 }}>
        {label}
      </Txt>
      <Txt
        variant={emphasis ? 'displayLg' : 'bodyStrong'}
        color={emphasis ? ledger.positive : muted ? ledger.textMuted : ledger.text}
      >
        {value}
      </Txt>
    </View>
  );
}
