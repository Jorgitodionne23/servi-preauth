/**
 * ActiveOrderDock — surfaces the logged-in customer's ongoing order on Home,
 * mirroring the web `shared-active-order.js` floating dock. Tapping opens the
 * order; a pending order shows an "authorize card" shortcut.
 */
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { PressableScale } from './ui/Pressable';
import { Txt } from './ui/Text';
import { Icon } from './ui/Icon';
import { Badge } from './ui/Badge';
import { STATUS_META } from './status';
import { useI18n } from '@/i18n/I18nContext';
import { loc, PHASE_ORDER } from '@/data/types';
import { colors, radius, shadow, spacing } from '@/theme/tokens';
import type { StringKey } from '@/i18n/strings';
import type { Order } from '@/data/types';

export function ActiveOrderDock({ order }: { order: Order }) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const meta = STATUS_META[order.status];
  const needsPay = order.status === 'pending';
  // The most recent on-site milestone the specialist has reached, if any.
  const currentPhase = [...PHASE_ORDER].reverse().find((p) => order.phaseTimes[p]);

  return (
    <PressableScale
      onPress={() => router.push(`/order/${order.id}`)}
      scaleTo={0.98}
      haptic={false}
      style={{
        backgroundColor: colors.ink,
        borderRadius: radius.lg,
        padding: spacing.lg,
        gap: spacing.md,
        ...shadow.raised,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent }} />
          <Txt variant="eyebrow" color={colors.accent}>
            {t('dock.active')}
          </Txt>
        </View>
        <Txt variant="mono" color="rgba(255,255,255,0.6)">
          {order.id}
        </Txt>
      </View>

      <View>
        <Txt variant="bodyStrong" color={colors.textInverse} numberOfLines={1}>
          {loc(order.service, lang)}
        </Txt>
        <Txt variant="caption" color="rgba(255,255,255,0.7)" style={{ marginTop: 2 }}>
          {loc(order.whenLabel, lang)} · {order.addressLabel}
        </Txt>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {currentPhase ? (
          <Badge label={t(`phase.${currentPhase}` as StringKey)} tone="accent" icon="navigation" />
        ) : (
          <Badge label={t(meta.labelKey)} tone={meta.tone} icon={meta.icon} />
        )}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: needsPay ? colors.accent : 'rgba(255,255,255,0.12)',
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: radius.pill,
          }}
        >
          <Txt variant="bodySmStrong" color={needsPay ? colors.accentInk : colors.textInverse}>
            {needsPay ? t('order.payNow') : t('req.submitted.trackOrder')}
          </Txt>
          <Icon name="arrow-right" size={15} color={needsPay ? colors.accentInk : colors.textInverse} />
        </View>
      </View>
    </PressableScale>
  );
}
