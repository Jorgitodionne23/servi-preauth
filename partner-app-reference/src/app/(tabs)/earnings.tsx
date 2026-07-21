/**
 * Earnings — the retention screen.
 *
 * Structure follows the questions in the order they get asked:
 *   "How much can I take out right now?"    → hero + cash out
 *   "When does the rest land?"              → next deposit
 *   "Is it split the way I expect?"         → three buckets
 *   "How's my week going?"                  → bar chart
 *   "Which job was that?"                   → per-job breakdown
 *
 * The per-job breakdown shows the client's total next to the specialist's
 * payout on purpose. Hiding it would look like there's something to hide;
 * showing it proves the fee was added on top and never deducted — which is the
 * single fact that keeps a specialist from going direct.
 */
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Text';
import { Card, Divider } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LangToggle } from '@/components/ui/LangToggle';
import { ListRow } from '@/components/ui/Rows';
import { MessageState } from '@/components/ui/States';
import { EarningsBuckets, EarningsHero, PayoutRow, StatTile, WeekBars } from '@/components/Money';
import { usePartner } from '@/state/PartnerStateContext';
import { useI18n } from '@/i18n/I18nContext';
import { colors, layout, radius, spacing } from '@/theme/tokens';
import { ledger, money } from '@/theme/partner';
import { dateLabel, monthLabel, now, weekdayMon } from '@/data/time';
import { loc } from '@/data/types';

export default function EarningsScreen() {
  const { t, tn, lang } = useI18n();
  const router = useRouter();
  const { earnings, payouts, payoutAccount, jobs, cashOut, session } = usePartner();

  const nextPayout = payouts.find((p) => p.status === 'pending');
  const recentPayouts = payouts.slice(0, 3);
  const tier = session.specialist?.tier;
  const instantFree = tier === 'oro' || tier === 'elite';
  const canCashOut = earnings.availableCents > 0 && payoutAccount.status === 'active';

  const earned = jobs
    .filter((j) => j.state === 'completed' || j.state === 'paid')
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));

  const todayIdx = weekdayMon(now());

  return (
    <Screen bottomInset={layout.tabBarHeight + 48}>
      <ScreenHeader title={t('earn.title')} right={<LangToggle />} />

      {/* ── Hero + cash out ─────────────────────────────────── */}
      <View style={{ marginTop: spacing.lg }}>
        <EarningsHero
          amountCents={earnings.availableCents}
          label={t('earn.available')}
          caption={t('earn.availableHint')}
        >
          {payoutAccount.status !== 'active' ? (
            <View style={{ gap: spacing.md, marginTop: spacing.sm }}>
              <Txt variant="bodySm" color={ledger.textMuted}>
                {t('earn.noAccountBody')}
              </Txt>
              <Button
                label={t('earn.addAccount')}
                variant="accent"
                size="md"
                onPress={() => router.push('/payout-account')}
              />
            </View>
          ) : (
            <View style={{ gap: 8, marginTop: spacing.sm }}>
              <Button
                label={t('earn.cashOut')}
                variant="accent"
                size="md"
                icon="zap"
                disabled={!canCashOut}
                onPress={cashOut}
              />
              <Txt variant="caption" color={ledger.textMuted} center>
                {instantFree
                  ? t('earn.cashOutFee', { fee: money(0) })
                  : t('earn.cashOutFee', { fee: '1.5%' })}
              </Txt>
            </View>
          )}
        </EarningsHero>
      </View>

      {/* ── Next deposit ────────────────────────────────────── */}
      {nextPayout ? (
        <Card style={{ marginTop: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View
            style={{
              width: 42, height: 42, borderRadius: radius.sm,
              backgroundColor: colors.accentTint,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Icon name="calendar" size={19} color={colors.accentInk} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt variant="bodyStrong">{t('earn.nextPayout')}</Txt>
            <Txt variant="caption" style={{ marginTop: 3 }}>
              {t('earn.nextPayoutBody', {
                amount: money(nextPayout.amountCents),
                date: dateLabel(nextPayout.arrivesAt, lang),
                last4: nextPayout.last4,
              })}
            </Txt>
          </View>
        </Card>
      ) : null}

      {/* ── Buckets ─────────────────────────────────────────── */}
      <View style={{ marginTop: spacing.xl }}>
        <EarningsBuckets earnings={earnings} />
      </View>

      {/* ── Week ────────────────────────────────────────────── */}
      <Card style={{ marginTop: spacing.xl, gap: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View>
            <Txt variant="caption">{t('earn.thisWeek')}</Txt>
            <Txt variant="displayLg" style={{ marginTop: 2 }}>
              {money(earnings.weekCents)}
            </Txt>
          </View>
          <Badge label={tn('earn.jobsCount', earnings.weekJobs)} tone="neutral" />
        </View>
        <WeekBars values={earnings.weekByDay} todayIndex={todayIdx} />
        <Divider />
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <StatTile
            value={money(earnings.monthCents)}
            label={monthLabel(now(), lang)}
            icon="bar-chart-2"
          />
          <StatTile
            value={String(earnings.monthJobs)}
            label={t('prof.jobs')}
            icon="check-circle"
          />
        </View>
      </Card>

      {/* ── Per-job breakdown ───────────────────────────────── */}
      <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
        <Txt variant="headingMd">{t('earn.breakdown')}</Txt>

        {earned.length === 0 ? (
          <Card>
            <MessageState
              icon="dollar-sign"
              title={t('earn.emptyBreakdown')}
              body={t('earn.emptyBreakdownBody')}
            />
          </Card>
        ) : (
          <Card style={{ gap: 0 }}>
            {earned.map((job, i) => {
              const extras = job.priceChanges
                .filter((pc) => pc.status === 'approved' || pc.status === 'paid')
                .reduce((s, pc) => s + pc.providerAmountCents, 0);
              return (
                <View key={job.id}>
                  {i > 0 ? <Divider /> : null}
                  <View style={{ paddingVertical: 14, gap: 6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
                      <View style={{ flex: 1 }}>
                        <Txt variant="bodySmStrong" numberOfLines={1}>
                          {loc(job.service, lang)}
                        </Txt>
                        <Txt variant="caption" style={{ marginTop: 2 }}>
                          {job.id} · {job.completedAt ? dateLabel(job.completedAt, lang) : '—'}
                        </Txt>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Txt variant="bodyStrong">{money(job.payoutCents + extras)}</Txt>
                        <Txt
                          variant="caption"
                          color={job.state === 'paid' ? colors.successInk : colors.warningInk}
                          style={{ marginTop: 2 }}
                        >
                          {job.state === 'paid' ? t('payout.status.paid') : t('earn.pending')}
                        </Txt>
                      </View>
                    </View>

                    {/* The transparency line: what the client paid vs what you got. */}
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        borderRadius: radius.sm,
                        backgroundColor: colors.surface,
                      }}
                    >
                      <Icon name="info" size={12} color={colors.textMuted} />
                      <Txt variant="caption" style={{ flex: 1, fontSize: 11.5 }}>
                        {t('job.clientPays')} {money(job.clientTotalCents)} ·{' '}
                        {t('job.feeNote')}
                      </Txt>
                    </View>

                    {extras > 0 ? (
                      <Txt variant="caption" color={colors.successInk}>
                        + {money(extras)} · {t('pc.title')}
                      </Txt>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </Card>
        )}
      </View>

      {/* ── Deposits + account ──────────────────────────────── */}
      <View style={{ marginTop: spacing.xl }}>
        <Txt variant="headingMd">{t('earn.payouts')}</Txt>
        <Card style={{ marginTop: spacing.md, gap: 0 }}>
          {recentPayouts.length === 0 ? (
            <MessageState icon="credit-card" title={t('payout.empty')} body={t('payout.emptyBody')} />
          ) : (
            <>
              {recentPayouts.map((p, i) => (
                <View key={p.id}>
                  {i > 0 ? <Divider /> : null}
                  <PayoutRow payout={p} />
                </View>
              ))}
              <Divider />
              <ListRow
                icon="list"
                title={t('earn.payoutsAll')}
                onPress={() => router.push('/earnings/payouts')}
              />
            </>
          )}
        </Card>
      </View>

      <Card style={{ marginTop: spacing.lg, gap: 0 }}>
        <ListRow
          icon="credit-card"
          title={t('earn.payoutMethod')}
          subtitle={
            payoutAccount.status === 'active'
              ? `${payoutAccount.bankName} ••••${payoutAccount.last4}`
              : t('earn.noAccount')
          }
          onPress={() => router.push('/payout-account')}
        />
        <Divider />
        <ListRow
          icon="file-text"
          title={t('earn.taxTitle')}
          subtitle={t('earn.taxBody')}
          onPress={() => router.push('/help')}
        />
      </Card>

      <Txt variant="caption" center style={{ marginTop: spacing.xl }}>
        {t('proto.banner')}
      </Txt>
    </Screen>
  );
}
