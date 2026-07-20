/**
 * OfferCard — an unclaimed job, with a live countdown and inline accept/decline.
 *
 * Design intent: an offer must be decidable in about three seconds without
 * opening anything. So the card leads with **what you earn**, then the three
 * facts that actually gate the decision — when, how far, how long — and only
 * then the service name. The exact address is withheld until accept (a real
 * privacy constraint the backend already enforces), and that's stated rather
 * than silently omitted, so it doesn't read as missing information.
 *
 * The countdown bar drains rather than just counting down: an ambient sense of
 * "this is going away" without a number the specialist has to keep reading.
 */
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Card } from './ui/Card';
import { Txt } from './ui/Text';
import { Icon, type FeatherName } from './ui/Icon';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { PressableScale } from './ui/Pressable';
import { useCountdown } from './useCountdown';
import { useI18n } from '@/i18n/I18nContext';
import { colors, radius, spacing } from '@/theme/tokens';
import { money } from '@/theme/partner';
import { countdown, duration, whenLabel } from '@/data/time';
import { loc, type Job } from '@/data/types';

/** Offers are minted with a 10–25 min window; the bar is scaled to 25 min so
 *  a fresh offer never starts visually near-empty. */
const FULL_WINDOW_SECONDS = 25 * 60;

export function OfferCard({
  job,
  onAccept,
  onDecline,
}: {
  job: Job;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const secondsLeft = useCountdown(job.offerExpiresAt);
  const expired = job.offerExpiresAt != null && secondsLeft <= 0;
  const urgent = secondsLeft > 0 && secondsLeft < 120;
  const pct = Math.max(0, Math.min(1, secondsLeft / FULL_WINDOW_SECONDS));

  return (
    <Card padded={false} style={{ overflow: 'hidden' }}>
      {/* Draining countdown bar */}
      {job.offerExpiresAt ? (
        <View style={{ height: 3, backgroundColor: colors.surface }}>
          <View
            style={{
              height: 3,
              width: `${pct * 100}%`,
              backgroundColor: urgent ? colors.danger : colors.accentDeep,
            }}
          />
        </View>
      ) : null}

      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          {job.isAsap ? (
            <Badge label={t('job.asap')} tone="warning" icon="zap" />
          ) : (
            <Badge label={whenLabel(job.scheduledAt, lang)} tone="neutral" icon="calendar" />
          )}
          {job.offerExpiresAt ? (
            <Txt variant="caption" color={urgent ? colors.dangerInk : colors.textMuted}>
              {expired
                ? t('offer.expired')
                : t('offer.expiresIn', { time: countdown(secondsLeft) })}
            </Txt>
          ) : null}
        </View>

        {/* Money first — it's the decision */}
        <PressableScale
          scaleTo={0.99}
          haptic={false}
          onPress={() => router.push(`/job/${job.id}`)}
          style={{ gap: spacing.sm }}
        >
          <View>
            <Txt variant="caption">{t('offer.youEarn')}</Txt>
            <Txt variant="displayLg" style={{ marginTop: 2 }}>
              {money(job.payoutCents)}
            </Txt>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: 2 }}>
            <Meta icon="navigation" text={`${job.distanceKm} km · ${job.zone}`} />
            <Meta icon="activity" text={duration(job.estimatedMinutes, lang)} />
          </View>

          <View style={{ marginTop: spacing.xs }}>
            <Txt variant="bodyStrong" numberOfLines={2}>
              {loc(job.service, lang)}
            </Txt>
            <Txt variant="bodySm" numberOfLines={2} style={{ marginTop: 3 }}>
              {loc(job.description, lang)}
            </Txt>
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              marginTop: spacing.xs,
              paddingVertical: 8,
              paddingHorizontal: 10,
              borderRadius: radius.sm,
              backgroundColor: colors.surface,
            }}
          >
            <Icon name="lock" size={13} color={colors.textMuted} />
            <Txt variant="caption" style={{ flex: 1 }}>
              {t('offer.addressHidden')}
            </Txt>
            <Icon name="chevron-right" size={16} color={colors.textMuted} />
          </View>
        </PressableScale>

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button
            label={t('offer.decline')}
            variant="secondary"
            size="md"
            block={false}
            onPress={onDecline}
            style={{ flex: 1 }}
          />
          <Button
            label={expired ? t('offer.expired') : t('offer.accept')}
            size="md"
            block={false}
            disabled={expired}
            onPress={onAccept}
            style={{ flex: 1.6 }}
          />
        </View>
      </View>
    </Card>
  );
}

function Meta({ icon, text }: { icon: FeatherName; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <Icon name={icon} size={13} color={colors.textMuted} />
      <Txt variant="caption">{text}</Txt>
    </View>
  );
}
