/**
 * JobCard — an accepted job in a list (today / scheduled / history).
 *
 * Information hierarchy is deliberate and money-first: a specialist scanning a
 * list is asking "when, where, how much" in that order — never "what is the
 * order's payment status". The payout is set in display type because it is the
 * reason they opened the app.
 */
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Card } from './ui/Card';
import { Txt } from './ui/Text';
import { Icon } from './ui/Icon';
import { Badge, type BadgeTone } from './ui/Badge';
import { PressableScale } from './ui/Pressable';
import { useI18n } from '@/i18n/I18nContext';
import { colors, radius, spacing } from '@/theme/tokens';
import { money } from '@/theme/partner';
import { duration, whenLabel } from '@/data/time';
import { loc, type Job, type JobState } from '@/data/types';
import { findTrade } from '@/data/catalog';

const STATE_TONE: Record<JobState, BadgeTone> = {
  offered: 'accent',
  scheduled: 'neutral',
  today: 'accent',
  active: 'warning',
  completed: 'info',
  paid: 'success',
  cancelled: 'danger',
  expired: 'neutral',
};

function stateLabel(job: Job, lang: 'es' | 'en'): string {
  const es: Record<JobState, string> = {
    offered: 'Disponible',
    scheduled: 'Agendado',
    today: 'Hoy',
    active: 'En curso',
    completed: 'Terminado · por pagar',
    paid: 'Pagado',
    cancelled: 'Cancelado',
    expired: 'Expiró',
  };
  const en: Record<JobState, string> = {
    offered: 'Available',
    scheduled: 'Scheduled',
    today: 'Today',
    active: 'In progress',
    completed: 'Finished · payment pending',
    paid: 'Paid',
    cancelled: 'Cancelled',
    expired: 'Expired',
  };
  return (lang === 'es' ? es : en)[job.state];
}

export function JobCard({ job }: { job: Job }) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const trade = findTrade(job.tradeKey);

  const approvedExtras = job.priceChanges
    .filter((pc) => pc.status === 'approved' || pc.status === 'paid')
    .reduce((s, pc) => s + pc.providerAmountCents, 0);
  const total = job.payoutCents + approvedExtras;

  return (
    <PressableScale scaleTo={0.985} haptic={false} onPress={() => router.push(`/job/${job.id}`)}>
      <Card style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: radius.sm,
              backgroundColor: colors.surface,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name={trade?.icon ?? 'tool'} size={19} color={colors.textSecondary} />
          </View>

          <View style={{ flex: 1 }}>
            <Txt variant="headingSm" numberOfLines={2}>
              {loc(job.service, lang)}
            </Txt>
            <Txt variant="caption" style={{ marginTop: 3 }}>
              {job.id} · {loc(job.subLabel, lang)}
            </Txt>
          </View>

          <View style={{ alignItems: 'flex-end' }}>
            <Txt variant="headingSm">{money(total)}</Txt>
            {approvedExtras > 0 ? (
              <Txt variant="caption" color={colors.successInk} style={{ marginTop: 2 }}>
                +{money(approvedExtras)}
              </Txt>
            ) : null}
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.md }}>
          <Meta icon="clock" text={job.isAsap && !job.scheduledAt ? t('job.asap') : whenLabel(job.scheduledAt, lang)} />
          <Meta icon="map-pin" text={job.zone} />
          <Meta icon="activity" text={duration(job.estimatedMinutes, lang)} />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Badge label={stateLabel(job, lang)} tone={STATE_TONE[job.state]} dot />
          {job.client.trustsYou ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Icon name="bookmark" size={13} color={colors.accentDeep} />
              <Txt variant="caption" color={colors.accentInk}>
                {job.client.firstName}
              </Txt>
            </View>
          ) : null}
        </View>
      </Card>
    </PressableScale>
  );
}

function Meta({ icon, text }: { icon: 'clock' | 'map-pin' | 'activity'; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <Icon name={icon} size={13} color={colors.textMuted} />
      <Txt variant="caption">{text}</Txt>
    </View>
  );
}
