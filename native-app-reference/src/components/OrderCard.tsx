/**
 * OrderCard — compact order summary row used in the Orders list and the
 * active-order dock. Shows service, when, status badge, and request mode.
 */
import { View } from 'react-native';
import { PressableScale } from './ui/Pressable';
import { Txt } from './ui/Text';
import { Icon } from './ui/Icon';
import { Badge } from './ui/Badge';
import { STATUS_META, MODE_ICON } from './status';
import { categoryByKey } from '@/data/catalog';
import { useI18n } from '@/i18n/I18nContext';
import { loc } from '@/data/types';
import { colors, radius, shadow, spacing } from '@/theme/tokens';
import type { Order } from '@/data/types';

export function OrderCard({ order, onPress }: { order: Order; onPress: () => void }) {
  const { t, lang } = useI18n();
  const meta = STATUS_META[order.status];
  const cat = categoryByKey[order.categoryKey];
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.98}
      haptic={false}
      style={{
        backgroundColor: colors.card,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
        gap: spacing.md,
        ...shadow.soft,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.md,
            backgroundColor: colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={cat?.icon ?? 'grid'} size={20} color={colors.accentDeep} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt variant="bodyStrong" numberOfLines={1}>
            {loc(order.service, lang)}
          </Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
            <Icon name={MODE_ICON[order.mode]} size={12} color={colors.textMuted} />
            <Txt variant="caption">{loc(order.whenLabel, lang)}</Txt>
          </View>
        </View>
        <Txt variant="mono" color={colors.textMuted}>
          {order.id}
        </Txt>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Badge label={t(meta.labelKey)} tone={meta.tone} icon={meta.icon} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Icon name="map-pin" size={12} color={colors.textMuted} />
          <Txt variant="caption" numberOfLines={1} style={{ maxWidth: 160 }}>
            {order.addressLabel}
          </Txt>
        </View>
      </View>
    </PressableScale>
  );
}
