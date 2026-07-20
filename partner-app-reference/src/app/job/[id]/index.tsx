/**
 * Job detail — the screen a specialist actually works from.
 *
 * Section order is dictated by when each fact is needed:
 *   1. Payment guarantee  — the anxiety that precedes everything else
 *   2. Check-in stepper   — the only thing they touch while on site
 *   3. Where / when       — navigation, needed on arrival
 *   4. The work itself    — description, answers, attachments
 *   5. Client             — masked, contact routed through SERVI
 *   6. Money breakdown    — transparency, read on the way home
 *   7. Adjustments        — the escape hatch when the job grows
 *
 * Offers get a reduced version: the address is withheld (backend already
 * enforces this) and the accept/decline bar is pinned to the bottom.
 */
import { Linking, Platform, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Text';
import { Card, Divider, Surface } from '@/components/ui/Card';
import { Icon, type FeatherName } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { MessageState } from '@/components/ui/States';
import { PhaseStepper } from '@/components/PhaseStepper';
import { useCountdown } from '@/components/useCountdown';
import { usePartner } from '@/state/PartnerStateContext';
import { useI18n } from '@/i18n/I18nContext';
import { colors, radius, spacing } from '@/theme/tokens';
import { money } from '@/theme/partner';
import { countdown, duration, whenLabel } from '@/data/time';
import { loc, type Job } from '@/data/types';
import type { StringKey } from '@/i18n/strings';

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, tn, lang } = useI18n();
  const router = useRouter();
  const {
    getJob, acceptOffer, declineOffer, checkIn,
    shareLocation, locationSharedFor, cancelJob,
  } = usePartner();

  const job = getJob(String(id));
  const secondsLeft = useCountdown(job?.offerExpiresAt ?? null);

  if (!job) {
    return (
      <Screen>
        <ScreenHeader back title={t('job.detail')} />
        <MessageState icon="alert-circle" title="404" body={String(id)} tone="danger" />
      </Screen>
    );
  }

  const isOffer = job.state === 'offered';
  const isWorkable = job.state === 'today' || job.state === 'active';
  const isDone = job.state === 'completed' || job.state === 'paid';
  const expired = job.offerExpiresAt != null && secondsLeft <= 0;

  const approvedExtras = job.priceChanges
    .filter((pc) => pc.status === 'approved' || pc.status === 'paid')
    .reduce((s, pc) => s + pc.providerAmountCents, 0);

  const openMaps = () => {
    const q = encodeURIComponent(job.address);
    const url = Platform.select({
      ios: `http://maps.apple.com/?q=${q}`,
      default: `https://www.google.com/maps/search/?api=1&query=${q}`,
    })!;
    Linking.openURL(url).catch(() => {});
  };

  return (
    <Screen bottomInset={isOffer ? 120 : spacing['3xl']}>
      <ScreenHeader back title={job.id} />

      <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
        <Txt variant="displayLg">{loc(job.service, lang)}</Txt>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          <Badge label={loc(job.subLabel, lang)} tone="neutral" />
          {job.isAsap ? <Badge label={t('job.asap')} tone="warning" icon="zap" /> : null}
          {job.client.trustsYou ? (
            <Badge label={t('job.trustsYou')} tone="accent" icon="bookmark" />
          ) : null}
        </View>
      </View>

      {/* ── 1. Payment guarantee ────────────────────────────── */}
      <Card style={{ marginTop: spacing.lg, gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
          <View
            style={{
              width: 42, height: 42, borderRadius: radius.sm,
              backgroundColor: job.paymentHeld ? colors.successTint : colors.surface,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Icon
              name={job.paymentHeld ? 'shield' : 'clock'}
              size={19}
              color={job.paymentHeld ? colors.successInk : colors.textMuted}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Txt variant="caption">{t('job.youEarnFull')}</Txt>
            <Txt variant="displayLg" style={{ marginTop: 2 }}>
              {money(job.payoutCents + approvedExtras)}
            </Txt>
          </View>
        </View>

        <Surface
          style={{
            backgroundColor: job.paymentHeld ? colors.successTint : colors.surface,
            padding: spacing.md,
          }}
        >
          <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
            <Icon
              name={job.paymentHeld ? 'check-circle' : 'info'}
              size={15}
              color={job.paymentHeld ? colors.successInk : colors.textMuted}
            />
            <View style={{ flex: 1 }}>
              <Txt
                variant="bodySmStrong"
                color={job.paymentHeld ? colors.successInk : colors.text}
              >
                {t('job.heldLabel')}
              </Txt>
              <Txt
                variant="caption"
                color={job.paymentHeld ? colors.successInk : colors.textSecondary}
                style={{ marginTop: 3 }}
              >
                {job.paymentHeld
                  ? t('job.heldBody', { amount: money(job.clientTotalCents) })
                  : t('job.notHeldBody')}
              </Txt>
            </View>
          </View>
        </Surface>
      </Card>

      {/* ── 2. Check-in ─────────────────────────────────────── */}
      {isWorkable ? (
        <Card style={{ marginTop: spacing.lg, gap: spacing.lg }}>
          <Txt variant="headingSm">{t('phase.title')}</Txt>
          <PhaseStepper job={job} onCheckIn={(phase) => {
            if (phase === 'completed') router.push(`/job/${job.id}/complete`);
            else checkIn(job.id, phase);
          }} />

          <Divider />

          <View style={{ gap: spacing.sm }}>
            <Button
              label={locationSharedFor === job.id ? t('phase.locationShared') : t('phase.shareLocation')}
              variant="secondary"
              size="md"
              icon={locationSharedFor === job.id ? 'check' : 'map-pin'}
              disabled={locationSharedFor === job.id}
              onPress={() => shareLocation(job.id)}
            />
            <Txt variant="caption">{t('phase.locationHint')}</Txt>
            <Txt variant="caption" color={colors.textMuted}>
              {t('phase.locationMock')}
            </Txt>
          </View>
        </Card>
      ) : null}

      {/* ── 3. Where / when ─────────────────────────────────── */}
      <Card style={{ marginTop: spacing.lg, gap: 0 }}>
        <InfoRow
          icon="map-pin"
          label={t('job.where')}
          value={isOffer ? `${job.zone} · ${job.distanceKm} km` : job.address}
          hint={isOffer ? t('offer.addressHidden') : `${job.distanceKm} km`}
          action={
            !isOffer
              ? { label: t('job.openMaps'), onPress: openMaps, icon: 'navigation' }
              : undefined
          }
        />
        <Divider />
        <InfoRow
          icon="calendar"
          label={t('job.when')}
          value={job.isAsap && !job.scheduledAt ? t('job.asap') : whenLabel(job.scheduledAt, lang)}
        />
        <Divider />
        <InfoRow
          icon="clock"
          label={t('job.estimated')}
          value={duration(job.estimatedMinutes, lang)}
        />
      </Card>

      {/* ── 4. The work ─────────────────────────────────────── */}
      <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
        <Txt variant="headingMd">{t('job.whatClientNeeds')}</Txt>
        <Card style={{ gap: spacing.md }}>
          <Txt variant="body" color={colors.text}>
            {loc(job.description, lang)}
          </Txt>

          {job.detailAnswers.length ? (
            <>
              <Divider />
              <View style={{ gap: spacing.md }}>
                {job.detailAnswers.map((d) => (
                  <View key={d.q.es}>
                    <Txt variant="caption">{loc(d.q, lang)}</Txt>
                    <Txt variant="bodySmStrong" style={{ marginTop: 2 }}>
                      {loc(d.a, lang)}
                    </Txt>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {job.attachments.length ? (
            <>
              <Divider />
              <View style={{ gap: spacing.sm }}>
                <Txt variant="caption">{t('job.attachments')}</Txt>
                <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
                  {job.attachments.map((a) => (
                    <View
                      key={a.kind}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 7,
                        paddingHorizontal: 12, paddingVertical: 9,
                        borderRadius: radius.sm, backgroundColor: colors.surface,
                      }}
                    >
                      <Icon
                        name={a.kind === 'photo' ? 'image' : a.kind === 'voice' ? 'mic' : 'video'}
                        size={15}
                        color={colors.textSecondary}
                      />
                      <Txt variant="bodySmStrong">
                        {a.kind === 'photo'
                          ? t('job.photos', { n: a.count })
                          : a.kind === 'voice'
                            ? t('job.voice')
                            : t('job.video')}
                      </Txt>
                    </View>
                  ))}
                </View>
              </View>
            </>
          ) : null}
        </Card>
      </View>

      {/* ── 5. Client ───────────────────────────────────────── */}
      <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
        <Txt variant="headingMd">{t('job.client')}</Txt>
        <Card style={{ gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View
              style={{
                width: 44, height: 44, borderRadius: 22,
                backgroundColor: colors.surface,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Txt variant="bodyStrong">{job.client.initials}</Txt>
            </View>
            <View style={{ flex: 1 }}>
              <Txt variant="bodyStrong">{job.client.firstName}</Txt>
              <Txt variant="caption" style={{ marginTop: 2 }}>
                {job.client.jobsTogether > 0
                  ? tn('job.jobsTogether', job.client.jobsTogether)
                  : t('job.firstTime')}
              </Txt>
            </View>
          </View>

          {!isOffer ? (
            <>
              <Button label={t('job.contact')} variant="secondary" size="md" icon="message-circle" />
              <Txt variant="caption">{t('job.contactHint')}</Txt>
            </>
          ) : null}
        </Card>
      </View>

      {/* ── 6. Money breakdown ──────────────────────────────── */}
      <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
        <Txt variant="headingMd">{t('job.payment')}</Txt>
        <Card style={{ gap: spacing.md }}>
          <Row label={t('job.youEarnFull')} value={money(job.payoutCents)} strong />
          {approvedExtras > 0 ? (
            <Row
              label={t('pc.title')}
              value={`+${money(approvedExtras)}`}
              tone={colors.successInk}
            />
          ) : null}
          <Divider />
          <Row
            label={t('job.serviFee')}
            value={money(job.clientTotalCents - job.payoutCents)}
            tone={colors.textMuted}
          />
          <Row label={t('job.clientPays')} value={money(job.clientTotalCents)} />
          <Surface style={{ padding: spacing.md, backgroundColor: colors.accentTint }}>
            <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
              <Icon name="info" size={14} color={colors.accentInk} />
              <Txt variant="caption" color={colors.accentInk} style={{ flex: 1 }}>
                {t('job.feeNote')}
              </Txt>
            </View>
          </Surface>
        </Card>
      </View>

      {/* ── 7. Adjustments ──────────────────────────────────── */}
      {!isOffer && !isDone ? (
        <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
          <Txt variant="headingMd">{t('pc.title')}</Txt>
          {job.priceChanges.length ? (
            <Card style={{ gap: spacing.md }}>
              {job.priceChanges.map((pc) => (
                <View key={pc.id} style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Txt variant="bodySmStrong">
                      {t(`pc.type.${pc.type}` as StringKey)}
                    </Txt>
                    {pc.note ? (
                      <Txt variant="caption" style={{ marginTop: 2 }}>
                        {pc.note}
                      </Txt>
                    ) : null}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Txt variant="bodyStrong">+{money(pc.providerAmountCents)}</Txt>
                    <Badge
                      label={t(`pc.status.${pc.status}` as StringKey)}
                      tone={
                        pc.status === 'approved' || pc.status === 'paid'
                          ? 'success'
                          : pc.status === 'rejected'
                            ? 'danger'
                            : 'warning'
                      }
                    />
                  </View>
                </View>
              ))}
            </Card>
          ) : null}
          <Button
            label={t('pc.title')}
            variant="secondary"
            size="md"
            icon="plus-circle"
            onPress={() => router.push(`/job/${job.id}/price-change`)}
          />
          <Txt variant="caption">{t('pc.never')}</Txt>
        </View>
      ) : null}

      {/* ── Cancel ──────────────────────────────────────────── */}
      {(job.state === 'scheduled' || job.state === 'today') ? (
        <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
          <Button
            label={t('job.cancelJob')}
            variant="ghost"
            size="md"
            onPress={() => {
              cancelJob(job.id);
              router.back();
            }}
          />
          <Txt variant="caption" center>
            {t('job.cancelBody')}
          </Txt>
        </View>
      ) : null}

      {/* ── Offer action bar ────────────────────────────────── */}
      {isOffer ? (
        <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
          {job.offerExpiresAt ? (
            <Txt variant="caption" center color={secondsLeft < 120 ? colors.dangerInk : colors.textMuted}>
              {expired ? t('offer.expired') : t('offer.expiresIn', { time: countdown(secondsLeft) })}
            </Txt>
          ) : null}
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button
              label={t('offer.decline')}
              variant="secondary"
              size="lg"
              block={false}
              style={{ flex: 1 }}
              onPress={() => {
                declineOffer(job.id);
                router.back();
              }}
            />
            <Button
              label={expired ? t('offer.expired') : t('offer.accept')}
              size="lg"
              block={false}
              disabled={expired}
              style={{ flex: 1.6 }}
              onPress={() => acceptOffer(job.id)}
            />
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

// ── Small pieces ──────────────────────────────────────────────
function InfoRow({
  icon,
  label,
  value,
  hint,
  action,
}: {
  icon: FeatherName;
  label: string;
  value: string;
  hint?: string;
  action?: { label: string; onPress: () => void; icon: FeatherName };
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingVertical: 14 }}>
      <Icon name={icon} size={17} color={colors.textMuted} />
      <View style={{ flex: 1 }}>
        <Txt variant="caption">{label}</Txt>
        <Txt variant="bodyStrong" style={{ marginTop: 2 }}>
          {value}
        </Txt>
        {hint ? (
          <Txt variant="caption" style={{ marginTop: 2 }}>
            {hint}
          </Txt>
        ) : null}
      </View>
      {action ? (
        <Button
          label={action.label}
          variant="secondary"
          size="sm"
          block={false}
          icon={action.icon}
          onPress={action.onPress}
        />
      ) : null}
    </View>
  );
}

function Row({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
      <Txt variant={strong ? 'bodyStrong' : 'bodySm'} color={tone} style={{ flex: 1 }}>
        {label}
      </Txt>
      <Txt variant={strong ? 'headingSm' : 'bodySmStrong'} color={tone}>
        {value}
      </Txt>
    </View>
  );
}

export type { Job };
