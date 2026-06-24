/**
 * ORDERS — request history. Active vs Past segmented list of the customer's
 * orders, each opening the full order detail. Mirrors the web "My Orders".
 */
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Text';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { LangToggle } from '@/components/ui/LangToggle';
import { OrderCard } from '@/components/OrderCard';
import { MessageState } from '@/components/ui/States';
import { activeStatuses } from '@/data/mockData';
import { useApp } from '@/state/AppStateContext';
import { useI18n } from '@/i18n/I18nContext';
import { spacing } from '@/theme/tokens';

export default function OrdersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const { orders } = useApp();
  const [tab, setTab] = useState<'active' | 'past'>('active');

  const filtered = useMemo(
    () => orders.filter((o) => (tab === 'active' ? activeStatuses.includes(o.status) : !activeStatuses.includes(o.status))),
    [orders, tab],
  );

  return (
    <Screen bottomInset={insets.bottom + 96}>
      <View style={{ paddingTop: insets.top + spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg }}>
          <Txt variant="displayLg">{t('orders.title')}</Txt>
          <LangToggle />
        </View>
        <SegmentedControl
          segments={[
            { key: 'active', label: t('orders.active') },
            { key: 'past', label: t('orders.past') },
          ]}
          value={tab}
          onChange={(k) => setTab(k as 'active' | 'past')}
        />
      </View>

      {filtered.length === 0 ? (
        <MessageState icon="clipboard" title={t('orders.empty')} body={t('orders.emptySub')} cta={t('orders.emptyCta')} onCta={() => router.push('/(tabs)')} />
      ) : (
        <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
          {filtered.map((o) => (
            <OrderCard key={o.id} order={o} onPress={() => router.push(`/order/${o.id}`)} />
          ))}
        </View>
      )}
    </Screen>
  );
}
