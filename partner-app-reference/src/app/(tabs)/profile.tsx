/**
 * Profile — identity, standing, and every setting that changes what work
 * arrives.
 *
 * The stats row leads with **reliability**, not rating. Rating is what clients
 * think of you; reliability is what SERVI dispatches on. Putting the metric
 * that actually drives income in the primary position is the honest choice, and
 * it makes the tier ladder below it legible instead of arbitrary.
 *
 * The demo controls at the bottom are prototype-only and clearly fenced off.
 */
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Text';
import { Card, Divider } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LangToggle } from '@/components/ui/LangToggle';
import { ListRow } from '@/components/ui/Rows';
import { StatTile } from '@/components/Money';
import { usePartner } from '@/state/PartnerStateContext';
import { useI18n } from '@/i18n/I18nContext';
import { colors, layout, radius, spacing } from '@/theme/tokens';
import { dateLabel } from '@/data/time';
import { findTier, nextTier } from '@/data/catalog';
import { loc } from '@/data/types';

export default function ProfileScreen() {
  const { t, tn, lang } = useI18n();
  const router = useRouter();
  const {
    session, availability, coverage, payoutAccount, signOut,
  } = usePartner();

  const s = session.specialist;
  if (!s) return null;

  const tier = findTier(s.tier);
  const next = nextTier(s.tier);
  const jobsToNext = next ? Math.max(0, next.minJobs - s.completedJobs) : 0;
  const tierProgress = next
    ? Math.min(1, s.completedJobs / Math.max(1, next.minJobs))
    : 1;

  const activeDays = availability.filter((d) => d.enabled).length;
  const weeklyHours = availability
    .filter((d) => d.enabled)
    .reduce((sum, d) => {
      const [fh, fm] = d.from.split(':').map(Number);
      const [th, tm] = d.to.split(':').map(Number);
      return sum + (th * 60 + tm - (fh * 60 + fm)) / 60;
    }, 0);

  const statusTone =
    s.status === 'verified' ? 'success' : s.status === 'paused' ? 'warning' : 'neutral';
  const statusLabel =
    s.status === 'verified' ? t('prof.verified')
      : s.status === 'paused' ? t('prof.paused')
        : t('prof.pending');

  return (
    <Screen bottomInset={layout.tabBarHeight + 48}>
      <ScreenHeader title={t('prof.title')} right={<LangToggle />} />

      {/* ── Identity ────────────────────────────────────────── */}
      <Card style={{ marginTop: spacing.lg, gap: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
          <View
            style={{
              width: 62, height: 62, borderRadius: 31,
              backgroundColor: colors.accentTint,
              alignItems: 'center', justifyContent: 'center',
              borderWidth: 1, borderColor: colors.border,
            }}
          >
            <Txt variant="headingMd" color={colors.accentInk}>
              {s.initials}
            </Txt>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Txt variant="headingMd">
              {s.firstName} {s.lastName}
            </Txt>
            <Txt variant="caption">{loc(s.specialty, lang)}</Txt>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 2 }}>
              <Badge label={statusLabel} tone={statusTone} icon="shield" />
              <Badge label={loc(tier.label, lang)} tone="accent" icon="award" />
            </View>
          </View>
        </View>

        <Txt variant="caption">
          {s.providerId} · {t('prof.memberSince', { date: dateLabel(s.memberSince, lang) })}
        </Txt>

        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <StatTile
            value={`${Math.round(s.reliability * 100)}%`}
            label={t('prof.reliability')}
            icon="check-circle"
            tone={colors.successInk}
          />
          <StatTile
            value={s.providerRating.display === 'score' ? `${s.providerRating.positivePct}%` : '—'}
            label={t('prof.satisfaction')}
            icon="thumbs-up"
          />
          <StatTile value={String(s.completedJobs)} label={t('prof.jobs')} icon="briefcase" />
        </View>

        {s.trustedBy > 0 ? (
          <View
            style={{
              flexDirection: 'row', alignItems: 'center', gap: spacing.md,
              padding: spacing.md, borderRadius: radius.md,
              backgroundColor: colors.accentTint,
            }}
          >
            <Icon name="bookmark" size={17} color={colors.accentInk} />
            <View style={{ flex: 1 }}>
              <Txt variant="bodySmStrong" color={colors.accentInk}>
                {tn('prof.trustedByN', s.trustedBy)}
              </Txt>
              <Txt variant="caption" color={colors.accentDeep} style={{ marginTop: 1 }}>
                {t('prof.trustedBy')}
              </Txt>
            </View>
          </View>
        ) : null}
      </Card>

      {/* ── Tier ────────────────────────────────────────────── */}
      <Card style={{ marginTop: spacing.lg, gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Icon name="award" size={19} color={colors.accentDeep} />
          <Txt variant="headingSm" style={{ flex: 1 }}>
            {t('prof.tier')} {loc(tier.label, lang)}
          </Txt>
        </View>

        <View style={{ gap: 6 }}>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.surface }}>
            <View
              style={{
                height: 6,
                width: `${tierProgress * 100}%`,
                borderRadius: 3,
                backgroundColor: colors.accentDeep,
              }}
            />
          </View>
          <Txt variant="caption">
            {next
              ? tn('prof.tierProgress', jobsToNext, { next: loc(next.label, lang) })
              : t('prof.tierMax')}
          </Txt>
        </View>

        <Divider />
        <Txt variant="bodySmStrong">{t('prof.perks')}</Txt>
        <View style={{ gap: 8 }}>
          {tier.perks.map((p) => (
            <View key={p.es} style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
              <Icon name="check" size={14} color={colors.success} />
              <Txt variant="bodySm" style={{ flex: 1 }}>
                {loc(p, lang)}
              </Txt>
            </View>
          ))}
        </View>
      </Card>

      {/* ── Work settings ───────────────────────────────────── */}
      <Card style={{ marginTop: spacing.lg, gap: 0 }}>
        <ListRow
          icon="tool"
          title={t('prof.myTrades')}
          subtitle={s.trades.flatMap((tr) => tr.skills).map((sk) => loc(sk, lang)).join(' · ')}
          onPress={() => router.push('/onboarding/services')}
        />
        <Divider />
        <ListRow
          icon="clock"
          title={t('prof.availability')}
          subtitle={tn('avail.hoursWeek', Math.round(weeklyHours)) + ` · ${activeDays}/7`}
          onPress={() => router.push('/availability')}
        />
        <Divider />
        <ListRow
          icon="map-pin"
          title={t('prof.coverage')}
          subtitle={`${coverage.zones.length} zonas · ${coverage.radiusKm} km`}
          onPress={() => router.push('/coverage')}
        />
        <Divider />
        <ListRow
          icon="shield"
          title={t('prof.documents')}
          subtitle={`${s.documents.filter((d) => d.status === 'approved').length}/${s.documents.length}`}
          onPress={() => router.push('/documents')}
        />
        <Divider />
        <ListRow
          icon="credit-card"
          title={t('prof.payoutAccount')}
          subtitle={
            payoutAccount.status === 'active'
              ? `${payoutAccount.bankName} ••••${payoutAccount.last4}`
              : t('earn.noAccount')
          }
          onPress={() => router.push('/payout-account')}
        />
      </Card>

      {/* ── Value + support ─────────────────────────────────── */}
      <Card style={{ marginTop: spacing.lg, gap: 0 }}>
        <ListRow
          icon="shield"
          title={t('prof.whyServi')}
          subtitle={t('prof.whyServiHint')}
          iconTone={colors.accentDeep}
          onPress={() => router.push('/why-servi')}
        />
        <Divider />
        <ListRow icon="help-circle" title={t('prof.help')} onPress={() => router.push('/help')} />
        <Divider />
        <ListRow
          icon="globe"
          title={t('prof.language')}
          right={<LangToggle />}
        />
      </Card>

      <View style={{ marginTop: spacing.lg }}>
        <Button
          label={t('prof.signOut')}
          variant="ghost"
          size="md"
          onPress={() => {
            signOut();
            router.replace('/auth/phone');
          }}
        />
      </View>
    </Screen>
  );
}
