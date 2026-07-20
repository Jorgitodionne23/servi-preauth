/**
 * Today — the home screen, and the only one a specialist opens between jobs.
 *
 * Ordering is by urgency of decision, not by importance of concept:
 *   1. Duty toggle          — am I even receiving work right now?
 *   2. Active job           — if I'm mid-job, nothing else matters
 *   3. Offers               — time-limited money, decays if ignored
 *   4. Today's schedule     — what's ahead
 *   5. Today's earnings     — the reward loop
 *
 * The unverified state replaces offers entirely rather than showing an empty
 * list, because "no jobs available" and "you can't receive jobs yet" are very
 * different messages and conflating them is how a new partner silently churns.
 */
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LangToggle } from '@/components/ui/LangToggle';
import { MessageState } from '@/components/ui/States';
import { PressableScale } from '@/components/ui/Pressable';
import { ServiLogo } from '@/components/ui/ServiLogo';
import { DutyToggle } from '@/components/DutyToggle';
import { OfferCard } from '@/components/OfferCard';
import { JobCard } from '@/components/JobCard';
import { usePartner } from '@/state/PartnerStateContext';
import { useI18n } from '@/i18n/I18nContext';
import { colors, layout, radius, spacing } from '@/theme/tokens';
import { money } from '@/theme/partner';
import { DEMO_NOW, clockTime, hourCDMX, weekdayMon, whenLabel } from '@/data/time';
import { loc } from '@/data/types';

export default function TodayScreen() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const {
    session, onDuty, toggleDuty, offers, todayJobs, activeJob,
    acceptOffer, declineOffer, earnings,
  } = usePartner();

  const specialist = session.specialist;
  const verified = specialist?.status === 'verified';

  const hour = hourCDMX(DEMO_NOW);
  const greeting =
    hour < 12 ? 'today.greetingMorning' : hour < 19 ? 'today.greetingAfternoon' : 'today.greetingEvening';

  const todayIdx = weekdayMon(DEMO_NOW);
  const todayCents = earnings.weekByDay[todayIdx] ?? 0;

  return (
    <Screen bottomInset={layout.tabBarHeight + 48}>
      <ScreenHeader right={<LangToggle />} />
      <View style={{ marginTop: spacing.sm }}>
        <ServiLogo size={22} partner />
      </View>

      <View style={{ marginTop: spacing.lg, marginBottom: spacing.lg }}>
        <Txt variant="caption">{t(greeting)}</Txt>
        <Txt variant="displayLg" style={{ marginTop: 2 }}>
          {specialist?.firstName ?? 'Partner'}
        </Txt>
      </View>

      <DutyToggle value={onDuty} onChange={toggleDuty} disabled={!verified} />

      {/* ── Verification gate ───────────────────────────────── */}
      {!verified ? (
        <Card style={{ marginTop: spacing.lg, gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View
              style={{
                width: 40, height: 40, borderRadius: radius.md,
                backgroundColor: colors.warningTint,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Icon name="shield" size={18} color={colors.warningInk} />
            </View>
            <Txt variant="headingSm" style={{ flex: 1 }}>
              {t('today.pendingVerification')}
            </Txt>
          </View>
          <Txt variant="bodySm">{t('today.pendingVerificationBody')}</Txt>
          <Button
            label={t('prof.documents')}
            variant="secondary"
            size="md"
            onPress={() => router.push('/documents')}
          />
        </Card>
      ) : null}

      {/* ── Active job ──────────────────────────────────────── */}
      {activeJob ? (
        <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Txt variant="headingMd" style={{ flex: 1 }}>
              {t('today.inProgress')}
            </Txt>
            <Badge label={t('phase.started.done')} tone="warning" dot />
          </View>
          <JobCard job={activeJob} />
        </View>
      ) : null}

      {/* ── Offers ──────────────────────────────────────────── */}
      {verified ? (
        <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
          <View>
            <Txt variant="headingMd">{t('today.offers')}</Txt>
            <Txt variant="caption" style={{ marginTop: 3 }}>
              {t('today.offersHint')}
            </Txt>
          </View>

          {!onDuty ? (
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Icon name="moon" size={18} color={colors.textMuted} />
              <Txt variant="bodySm" style={{ flex: 1 }}>
                {t('today.offDutyHint')}
              </Txt>
            </Card>
          ) : offers.length === 0 ? (
            <Card>
              <MessageState
                icon="inbox"
                title={t('today.emptyOffers')}
                body={t('today.emptyOffersBody')}
              />
            </Card>
          ) : (
            offers.map((job) => (
              <OfferCard
                key={job.id}
                job={job}
                onAccept={() => acceptOffer(job.id)}
                onDecline={() => declineOffer(job.id)}
              />
            ))
          )}
        </View>
      ) : null}

      {/* ── Today's schedule ────────────────────────────────── */}
      <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
        <Txt variant="headingMd">{t('today.schedule')}</Txt>
        {todayJobs.length === 0 ? (
          <Card>
            <MessageState
              icon="calendar"
              title={t('today.emptyToday')}
              body={t('today.emptyTodayBody')}
            />
          </Card>
        ) : (
          todayJobs.map((job) => (
            <View key={job.id} style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ width: 46, alignItems: 'flex-end', paddingTop: spacing.lg }}>
                <Txt variant="bodySmStrong">
                  {job.scheduledAt ? clockTime(job.scheduledAt) : '—'}
                </Txt>
              </View>
              <View style={{ flex: 1 }}>
                <JobCard job={job} />
              </View>
            </View>
          ))
        )}
      </View>

      {/* ── Today's earnings ────────────────────────────────── */}
      <PressableScale
        scaleTo={0.99}
        haptic={false}
        onPress={() => router.push('/(tabs)/earnings')}
        style={{ marginTop: spacing.xl }}
      >
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View
            style={{
              width: 42, height: 42, borderRadius: radius.sm,
              backgroundColor: colors.successTint,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Icon name="trending-up" size={19} color={colors.successInk} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt variant="caption">{t('today.todayEarnings')}</Txt>
            <Txt variant="headingMd" style={{ marginTop: 2 }}>
              {money(todayCents)}
            </Txt>
          </View>
          <Icon name="chevron-right" size={20} color={colors.textMuted} />
        </Card>
      </PressableScale>

      {/* ── Next scheduled, as a tail hint ──────────────────── */}
      {todayJobs.length === 0 && !activeJob ? (
        <Txt variant="caption" center style={{ marginTop: spacing.xl }}>
          {t('proto.banner')}
        </Txt>
      ) : null}

      <View style={{ height: spacing.xl }} />
      {todayJobs[0]?.scheduledAt ? (
        <Txt variant="caption" center>
          {t('today.nextJob')}: {loc(todayJobs[0].service, lang)} ·{' '}
          {whenLabel(todayJobs[0].scheduledAt, lang)}
        </Txt>
      ) : null}
    </Screen>
  );
}
