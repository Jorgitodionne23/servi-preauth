/**
 * Order detail — the full lifecycle view for one order: status header, timeline,
 * specialist, summary, price, and a payment/pre-auth reference card that adapts
 * to the order's state (pending → authorize; confirmed → card held; captured →
 * paid; refunded; cancelled). NO Stripe — reference UI + an inert action.
 */
import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Text';
import { Icon, type FeatherName } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Card, Surface } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { InfoCard } from '@/components/ui/InfoCard';
import { StatusTimeline } from '@/components/StatusTimeline';
import { PhaseTimeline } from '@/components/PhaseTimeline';
import { SpecialistCard } from '@/components/SpecialistCard';
import { PriceBreakdown } from '@/components/PriceBreakdown';
import { TipCard } from '@/components/TipCard';
import { MessageState } from '@/components/ui/States';
import { STATUS_META, MODE_ICON } from '@/components/status';
import { categoryByKey } from '@/data/catalog';
import { loc } from '@/data/types';
import { clockTime } from '@/data/time';
import { useApp } from '@/state/AppStateContext';
import { useI18n } from '@/i18n/I18nContext';
import { colors, radius, spacing } from '@/theme/tokens';
import type { Order } from '@/data/types';
import type { StringKey } from '@/i18n/strings';

const ATTACH_ICON: Record<'photo' | 'voice' | 'video', FeatherName> = {
  photo: 'camera',
  voice: 'mic',
  video: 'video',
};

const TERMINAL: Order['status'][] = ['captured', 'refunded', 'cancelled'];

/** Payment concept(s) to surface for a given order state. */
function paymentRef(status: Order['status']): { icon: FeatherName; title: StringKey; body: StringKey; tone: 'accent' | 'neutral' }[] {
  switch (status) {
    case 'pending':
      return [
        { icon: 'link', title: 'pay.link.title', body: 'pay.link.body', tone: 'accent' },
        { icon: 'credit-card', title: 'pay.hold.title', body: 'pay.hold.body', tone: 'neutral' },
      ];
    case 'scheduled':
      return [
        { icon: 'shield', title: 'pay.saved.title', body: 'pay.saved.body', tone: 'accent' },
        { icon: 'clock', title: 'pay.auto.title', body: 'pay.auto.body', tone: 'neutral' },
      ];
    case 'blocked':
      return [
        { icon: 'calendar', title: 'pay.fiveday.title', body: 'pay.fiveday.body', tone: 'accent' },
        { icon: 'shield', title: 'pay.saved.title', body: 'pay.saved.body', tone: 'neutral' },
      ];
    case 'confirmed':
    case 'assigned':
    case 'in_progress':
    case 'completed':
      return [{ icon: 'credit-card', title: 'pay.hold.title', body: 'pay.hold.body', tone: 'accent' }];
    default:
      return [];
  }
}

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, lang } = useI18n();
  const { getOrder } = useApp();
  const order = id ? getOrder(id) : undefined;
  const [authorized, setAuthorized] = useState(false);

  if (!order) {
    return (
      <Screen>
        <ScreenHeader back />
        <MessageState icon="alert-circle" title={t('state.errorTitle')} body={t('state.errorBody')} />
      </Screen>
    );
  }

  const meta = STATUS_META[order.status];
  const cat = categoryByKey[order.categoryKey];
  const refs = paymentRef(order.status);
  const isTerminal = TERMINAL.includes(order.status);
  // Show the on-site milestone track once a specialist exists and could be
  // checking in — or whenever any milestone has already been reached.
  const showPhases =
    order.specialist != null &&
    (Object.keys(order.phaseTimes).length > 0 ||
      order.status === 'assigned' ||
      order.status === 'in_progress');

  return (
    <Screen bottomInset={insets.bottom + 110}>
      <ScreenHeader back right={<Txt variant="mono" color={colors.textMuted}>{order.id}</Txt>} />

      {/* Status header */}
      <View style={{ marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ width: 52, height: 52, borderRadius: radius.lg, backgroundColor: colors.accentTint, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={cat?.icon ?? 'grid'} size={24} color={colors.accentInk} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt variant="headingSm">{loc(order.service, lang)}</Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <Icon name={MODE_ICON[order.mode]} size={12} color={colors.textMuted} />
            <Txt variant="caption">{loc(order.subLabel, lang)}</Txt>
          </View>
        </View>
      </View>
      <View style={{ marginTop: spacing.md }}>
        <Badge label={t(meta.labelKey)} tone={meta.tone} icon={meta.icon} />
      </View>

      {/* Specialist */}
      <Card style={{ marginTop: spacing.xl }}>
        <Txt variant="eyebrow" style={{ marginBottom: spacing.md }}>
          {order.specialist ? t('order.specialist') : t('order.specialistPending')}
        </Txt>
        {order.specialist ? (
          <View style={{ gap: spacing.md }}>
            <SpecialistCard specialist={order.specialist} trade={order.subLabel} />
            <Txt variant="caption" color={colors.textMuted}>
              {t('spec.maskedNote')}
            </Txt>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="users" size={22} color={colors.textMuted} />
            </View>
            <Txt variant="bodySm" style={{ flex: 1 }}>
              {t('order.assigningBody')}
            </Txt>
          </View>
        )}
      </Card>

      {/* On-site milestones (the specialist's live check-ins) */}
      {showPhases ? (
        <Card style={{ marginTop: spacing.lg }}>
          <Txt variant="eyebrow" style={{ marginBottom: spacing.lg }}>
            {t('phase.title')}
          </Txt>
          <PhaseTimeline phaseTimes={order.phaseTimes} />
        </Card>
      ) : null}

      {/* One-shot shared location (never continuous tracking) */}
      {order.locationSharedAt ? (
        <View style={{ marginTop: spacing.lg }}>
          <InfoCard
            icon="map-pin"
            title={t('order.location')}
            body={t('order.locationBody', { time: clockTime(order.locationSharedAt) })}
            tone="accent"
          />
        </View>
      ) : null}

      {/* Timeline */}
      <Card style={{ marginTop: spacing.lg }}>
        <Txt variant="eyebrow" style={{ marginBottom: spacing.lg }}>
          {t('order.timeline')}
        </Txt>
        <StatusTimeline steps={order.timeline} />
      </Card>

      {/* The request — the client's own words, attachments, follow-up answers */}
      <Card style={{ marginTop: spacing.lg, gap: spacing.md }}>
        <Txt variant="eyebrow">{t('order.request')}</Txt>
        <Txt variant="bodySm">{loc(order.description, lang)}</Txt>
        {order.attachments.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {order.attachments.map((a) => (
              <View
                key={a.kind}
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
                <Icon name={ATTACH_ICON[a.kind]} size={13} color={colors.textSecondary} />
                <Txt variant="caption">{a.count}</Txt>
              </View>
            ))}
          </View>
        ) : null}
        {order.detailAnswers.map((qa, i) => (
          <View key={i} style={{ gap: 2 }}>
            <Txt variant="caption" color={colors.textMuted}>
              {loc(qa.q, lang)}
            </Txt>
            <Txt variant="bodySmStrong">{loc(qa.a, lang)}</Txt>
          </View>
        ))}
      </Card>

      {/* Summary */}
      <Surface style={{ marginTop: spacing.lg, gap: spacing.md }}>
        <Row label={t('req.review.when')} value={loc(order.whenLabel, lang)} />
        <Row label={t('req.review.where')} value={order.addressLabel} />
      </Surface>

      {/* Price */}
      <Card style={{ marginTop: spacing.lg }}>
        <Txt variant="eyebrow" style={{ marginBottom: spacing.md }}>
          {t('pay.method')}
        </Txt>
        <PriceBreakdown price={order.price} />
      </Card>

      {/* Tip — post-service, optional, 100% to the specialist */}
      {order.status === 'captured' && order.specialist ? (
        <View style={{ marginTop: spacing.lg }}>
          <TipCard order={order} />
        </View>
      ) : null}

      {/* Payment reference */}
      {refs.length ? (
        <Card style={{ marginTop: spacing.lg, gap: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Txt variant="eyebrow">{t('pay.title')}</Txt>
            <Badge label={t('pay.refDisclaimer')} tone="warning" icon="info" />
          </View>
          {refs.map((r) => (
            <InfoCard key={r.title} icon={r.icon} title={t(r.title)} body={t(r.body)} tone={r.tone} />
          ))}
        </Card>
      ) : null}

      {/* Actions */}
      <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
        {order.status === 'pending' ? (
          <Button
            label={authorized ? t('auth.success') : t('order.payNow')}
            icon={authorized ? 'check' : 'credit-card'}
            variant={authorized ? 'secondary' : 'primary'}
            onPress={() => setAuthorized(true)}
          />
        ) : null}
        {order.status === 'blocked' ? <Button label={t('pay.addCard')} icon="credit-card" onPress={() => router.push('/payment-info')} /> : null}
        {isTerminal ? <Button label={t('order.rebook')} icon="refresh-cw" onPress={() => router.push('/(tabs)')} /> : null}
        <Button label={t('order.contactSupport')} variant="secondary" icon="message-circle" onPress={() => router.push('/help')} />
      </View>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.md }}>
      <Txt variant="caption" style={{ width: 80 }}>
        {label}
      </Txt>
      <Txt variant="bodySmStrong" style={{ flex: 1 }}>
        {value}
      </Txt>
    </View>
  );
}
