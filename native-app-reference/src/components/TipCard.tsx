/**
 * TipCard — an optional post-service tip on a captured order. A tip is added ON
 * TOP and goes 100% to the specialist (it reinforces the platform's core promise
 * that the specialist keeps everything they're owed — nothing is skimmed).
 *
 * PROTOTYPE STUB: the backend has no tip support today (no column, no route).
 * The recommended production shape is spec'd in INTEROP.md ("Needs building"):
 * POST /api/auth/orders/:id/tip, charged off-session and transferred 100% to the
 * provider. Here it only records a local amount and shows a thank-you state.
 */
import { useState } from 'react';
import { View } from 'react-native';
import { Txt } from './ui/Text';
import { Icon } from './ui/Icon';
import { Card } from './ui/Card';
import { Chip } from './ui/Chip';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { useApp } from '@/state/AppStateContext';
import { useI18n } from '@/i18n/I18nContext';
import { money } from '@/theme/format';
import { colors, radius, spacing } from '@/theme/tokens';
import type { Order } from '@/data/types';

const PRESETS_CENTS = [2000, 5000, 10000];

export function TipCard({ order }: { order: Order }) {
  const { t } = useI18n();
  const { tipOrder } = useApp();
  const [custom, setCustom] = useState('');
  const specialist = order.specialist;

  // Already tipped → thank-you state.
  if (order.tipCents != null) {
    return (
      <Card style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Icon name="heart" size={16} color={colors.accentDeep} />
          <Txt variant="bodyStrong">{t('tip.thanksTitle')}</Txt>
        </View>
        <Txt variant="bodySm">
          {t('tip.thanksBody', { amount: money(order.tipCents), name: specialist?.maskedName ?? '' })}
        </Txt>
      </Card>
    );
  }

  const customCents = Math.round((parseFloat(custom.replace(/[^0-9.]/g, '')) || 0) * 100);

  return (
    <Card style={{ gap: spacing.md }}>
      <View>
        <Txt variant="eyebrow">{t('tip.title')}</Txt>
        <Txt variant="bodySm" style={{ marginTop: spacing.xs }}>
          {t('tip.subtitle', { name: specialist?.maskedName ?? '' })}
        </Txt>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {PRESETS_CENTS.map((cents) => (
          <Chip key={cents} label={money(cents)} onPress={() => tipOrder(order.id, cents)} />
        ))}
      </View>

      {/* Custom amount */}
      <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Input
            icon="dollar-sign"
            placeholder={t('tip.custom')}
            keyboardType="numeric"
            value={custom}
            onChangeText={setCustom}
          />
        </View>
        <Button
          label={t('tip.give')}
          size="md"
          disabled={customCents <= 0}
          onPress={() => tipOrder(order.id, customCents)}
        />
      </View>

      {/* 100%-to-specialist note + prototype disclaimer */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: spacing.sm,
          padding: spacing.md,
          borderRadius: radius.sm,
          backgroundColor: colors.successTint,
        }}
      >
        <Icon name="check-circle" size={14} color={colors.successInk} />
        <Txt variant="caption" color={colors.successInk} style={{ flex: 1 }}>
          {t('tip.hundredPct')}
        </Txt>
      </View>
      <Txt variant="caption" color={colors.textMuted}>
        {t('tip.disclaimer')}
      </Txt>
    </Card>
  );
}
