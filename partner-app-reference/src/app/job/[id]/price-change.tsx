/**
 * Price change — the specialist asks for more money mid-job.
 *
 * This is the flow that replaces the worst moment in independent trade work:
 * standing in someone's bathroom, covered in water, having to negotiate a
 * higher price face to face. Here the specialist states a reason and an amount,
 * SERVI reviews it, and SERVI charges the client. The specialist never argues
 * and never handles cash.
 *
 * Mirrors `POST /api/provider/price-change`: the reason keys are the backend's
 * exact `PRICE_CHANGE_TYPES` strings, and the client-facing preview comes from
 * the real `computePricing`. Critically, this records a REQUEST — it moves no
 * money. An admin turns it into a chargeable adjustment. That separation is
 * what stops the flow from being an inflation lever.
 */
import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Text';
import { Card, Divider, Surface } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Input, Field } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { MessageState } from '@/components/ui/States';
import { usePartner } from '@/state/PartnerStateContext';
import { useI18n } from '@/i18n/I18nContext';
import { computePricing } from '@/data/pricing';
import { colors, radius, spacing } from '@/theme/tokens';
import { money } from '@/theme/partner';
import type { PriceChangeType } from '@/data/types';
import type { StringKey } from '@/i18n/strings';

const TYPES: PriceChangeType[] = [
  'horas_adicionales',
  'servicio_adicional',
  'materiales',
  'precio_corregido',
  'otro',
];

export default function PriceChangeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const router = useRouter();
  const { getJob, requestPriceChange } = usePartner();

  const [type, setType] = useState<PriceChangeType>('horas_adicionales');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);

  const job = getJob(String(id));
  const pesos = Number(amount.replace(/[^0-9.]/g, ''));
  const valid = Number.isFinite(pesos) && pesos > 0 && note.trim().length >= 10;
  const preview = Number.isFinite(pesos) && pesos > 0 ? computePricing(pesos) : null;

  if (!job) {
    return (
      <Screen>
        <ScreenHeader back title={t('pc.title')} />
        <MessageState icon="alert-circle" title="404" tone="danger" />
      </Screen>
    );
  }

  if (sent) {
    return (
      <Screen>
        <ScreenHeader back title={t('pc.title')} />
        <View style={{ flex: 1, justifyContent: 'center', gap: spacing.xl }}>
          <MessageState icon="check-circle" title={t('pc.sent')} body={t('pc.sentBody')} />
          <Button label={t('common.done')} onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen bottomInset={spacing['3xl']}>
      <ScreenHeader back title={t('pc.title')} />

      <Txt variant="body" style={{ marginTop: spacing.lg }}>
        {t('pc.subtitle')}
      </Txt>

      {/* Reason */}
      <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
        <Txt variant="label">{t('pc.type')}</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {TYPES.map((k) => (
            <Chip
              key={k}
              label={t(`pc.type.${k}` as StringKey)}
              active={type === k}
              onPress={() => setType(k)}
            />
          ))}
        </View>
      </View>

      {/* Amount */}
      <View style={{ marginTop: spacing.xl }}>
        <Field label={t('pc.amount')}>
          <Input
            icon="dollar-sign"
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            placeholder="250"
            inputMode="numeric"
          />
        </Field>
      </View>

      {/* Note — required, and long enough to actually explain something */}
      <View style={{ marginTop: spacing.lg }}>
        <Field
          label={t('pc.note')}
          hint={note.trim().length > 0 && note.trim().length < 10 ? t('common.required') : undefined}
        >
          <Input
            value={note}
            onChangeText={setNote}
            placeholder={t('pc.notePlaceholder')}
            multiline
            numberOfLines={4}
            style={{ minHeight: 96, textAlignVertical: 'top' }}
            containerStyle={{ alignItems: 'flex-start', paddingTop: 4 }}
          />
        </Field>
      </View>

      {/* Live preview from the real pricing engine */}
      {preview ? (
        <Card style={{ marginTop: spacing.xl, gap: spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Txt variant="bodyStrong">{t('pc.previewYou')}</Txt>
            <Txt variant="headingMd">{money(preview.providerAmountCents)}</Txt>
          </View>
          <Divider />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Txt variant="bodySm">{t('pc.preview')}</Txt>
            <Txt variant="bodySmStrong">{money(preview.totalAmountCents)}</Txt>
          </View>
          <Surface style={{ padding: spacing.md, backgroundColor: colors.accentTint }}>
            <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
              <Icon name="info" size={14} color={colors.accentInk} />
              <Txt variant="caption" color={colors.accentInk} style={{ flex: 1 }}>
                {t('job.feeNote')}
              </Txt>
            </View>
          </Surface>
        </Card>
      ) : null}

      <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
        <Button
          label={t('pc.submit')}
          disabled={!valid}
          onPress={() => {
            requestPriceChange(job.id, { type, pesos, note });
            setSent(true);
          }}
        />
        <View
          style={{
            flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start',
            padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.warningTint,
          }}
        >
          <Icon name="alert-triangle" size={15} color={colors.warningInk} />
          <Txt variant="caption" color={colors.warningInk} style={{ flex: 1 }}>
            {t('pc.never')}
          </Txt>
        </View>
      </View>
    </Screen>
  );
}
