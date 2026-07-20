/**
 * Money surfaces: the dark "ledger" hero, the three-bucket rail, the week bar
 * chart, and payout rows.
 *
 * Why the earnings hero goes dark while the rest of the app is light: it
 * borrows from SERVI's existing dark payment pages (`frontend/pay.html`,
 * `book.html`), so money screens feel like the same institution on both sides
 * of the marketplace. It also makes the number unmissable, which is the point.
 */
import { View } from 'react-native';
import { Txt } from './ui/Text';
import { Icon, type FeatherName } from './ui/Icon';
import { PressableScale } from './ui/Pressable';
import { useI18n } from '@/i18n/I18nContext';
import { colors, radius, shadow, spacing } from '@/theme/tokens';
import { ledger, money, moneyShort } from '@/theme/partner';
import { dateLabel } from '@/data/time';
import type { EarningsSummary, Payout } from '@/data/types';
import type { StringKey } from '@/i18n/strings';

// ── Hero ──────────────────────────────────────────────────────────
export function EarningsHero({
  amountCents,
  label,
  caption,
  children,
}: {
  amountCents: number;
  label: string;
  caption?: string;
  children?: React.ReactNode;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: ledger.bg,
          borderRadius: radius.lg,
          padding: spacing.xl,
          gap: spacing.md,
        },
        shadow.raised,
      ]}
    >
      <Txt variant="eyebrow" color={ledger.textMuted}>
        {label}
      </Txt>
      <Txt variant="displayXl" color={ledger.text} style={{ fontSize: 42, lineHeight: 46 }}>
        {money(amountCents)}
      </Txt>
      {caption ? (
        <Txt variant="bodySm" color={ledger.textMuted}>
          {caption}
        </Txt>
      ) : null}
      {children}
    </View>
  );
}

// ── Three-bucket rail ─────────────────────────────────────────────
/**
 * available / pending / scheduled. These answer three different questions and
 * are never summed into one "balance" — a single blended number is how
 * marketplaces end up showing people money they can't actually touch.
 */
export function EarningsBuckets({ earnings }: { earnings: EarningsSummary }) {
  const { t } = useI18n();
  const items: { key: StringKey; hint: StringKey; cents: number; tone: string }[] = [
    { key: 'earn.available', hint: 'earn.availableHint', cents: earnings.availableCents, tone: colors.successInk },
    { key: 'earn.pending', hint: 'earn.pendingHint', cents: earnings.pendingCents, tone: colors.warningInk },
    { key: 'earn.scheduled', hint: 'earn.scheduledHint', cents: earnings.scheduledCents, tone: colors.textSecondary },
  ];

  return (
    <View style={{ gap: spacing.md }}>
      {items.map((it) => (
        <View
          key={it.key}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.lg,
            borderRadius: radius.md,
            backgroundColor: colors.surface,
          }}
        >
          <View style={{ flex: 1 }}>
            <Txt variant="bodySmStrong" color={it.tone}>
              {t(it.key)}
            </Txt>
            <Txt variant="caption" style={{ marginTop: 2 }}>
              {t(it.hint)}
            </Txt>
          </View>
          <Txt variant="headingSm">{money(it.cents)}</Txt>
        </View>
      ))}
    </View>
  );
}

// ── Week bars ─────────────────────────────────────────────────────
/**
 * Seven bars, Mon→Sun. Deliberately not a line chart: a specialist reads this
 * as "which days did I work", and discrete bars carry that better than a trend.
 * Empty days keep a visible baseline so the week's shape stays honest.
 */
export function WeekBars({ values, todayIndex }: { values: number[]; todayIndex: number }) {
  const { lang } = useI18n();
  const max = Math.max(...values, 1);
  const labels = lang === 'es'
    ? ['L', 'M', 'M', 'J', 'V', 'S', 'D']
    : ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, height: 96 }}>
        {values.map((v, i) => {
          const h = Math.max(4, (v / max) * 92);
          const isToday = i === todayIndex;
          return (
            <View key={i} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
              {v > 0 ? (
                <Txt variant="caption" style={{ fontSize: 10 }}>
                  {moneyShort(v)}
                </Txt>
              ) : null}
              <View
                style={{
                  width: '100%',
                  height: h,
                  borderRadius: 6,
                  backgroundColor: v > 0 ? (isToday ? colors.ink : colors.accent) : colors.shimmer,
                }}
              />
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {labels.map((l, i) => (
          <Txt
            key={i}
            variant="caption"
            center
            color={i === todayIndex ? colors.text : colors.textMuted}
            style={{ flex: 1 }}
          >
            {l}
          </Txt>
        ))}
      </View>
    </View>
  );
}

// ── Payout row ────────────────────────────────────────────────────
export function PayoutRow({ payout, onPress }: { payout: Payout; onPress?: () => void }) {
  const { t, tn, lang } = useI18n();

  const tone: Record<Payout['status'], { icon: FeatherName; color: string }> = {
    pending: { icon: 'clock', color: colors.textMuted },
    in_transit: { icon: 'send', color: colors.accentDeep },
    paid: { icon: 'check-circle', color: colors.success },
    failed: { icon: 'alert-circle', color: colors.danger },
  };
  const { icon, color } = tone[payout.status];

  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.99}
      haptic={false}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 14 }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: radius.sm,
          backgroundColor: colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={17} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt variant="bodyStrong">
          {t(payout.instant ? 'payout.instant' : 'payout.standard')}
        </Txt>
        <Txt variant="caption" style={{ marginTop: 2 }}>
          {dateLabel(payout.arrivesAt, lang)} · ••••{payout.last4} ·{' '}
          {tn('payout.jobsIncluded', payout.jobIds.length)}
        </Txt>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Txt variant="bodyStrong">{money(payout.amountCents)}</Txt>
        <Txt variant="caption" color={color} style={{ marginTop: 2 }}>
          {t(`payout.status.${payout.status}` as StringKey)}
        </Txt>
      </View>
    </PressableScale>
  );
}

// ── Stat tile ─────────────────────────────────────────────────────
export function StatTile({
  value,
  label,
  icon,
  tone,
}: {
  value: string;
  label: string;
  icon?: FeatherName;
  tone?: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        padding: spacing.lg,
        borderRadius: radius.md,
        backgroundColor: colors.surface,
        gap: 4,
      }}
    >
      {icon ? <Icon name={icon} size={16} color={tone ?? colors.textMuted} /> : null}
      <Txt variant="headingMd" color={tone}>
        {value}
      </Txt>
      <Txt variant="caption">{label}</Txt>
    </View>
  );
}
