/**
 * PriceBreakdown — the customer-facing price rows, mirroring what the live web
 * app shows on `frontend/success.html`: a single "Precio del servicio" line
 * (provider + booking fee + VAT), a "Comisión por procesamiento" line, an
 * "*IVA incluido" note, and the Total. The booking fee is intentionally NOT
 * itemized to the customer — that itemization is the partner app's view.
 *
 * Numbers come from data/pricing.ts (the port of backend/pricing.mjs); every
 * amount is centavos. When the price isn't confirmed yet, we show the
 * "we confirm the price first" state instead of numbers.
 */
import { View } from 'react-native';
import { Txt } from './ui/Text';
import { Divider } from './ui/Card';
import { Badge } from './ui/Badge';
import { useI18n } from '@/i18n/I18nContext';
import { money } from '@/theme/format';
import { colors, spacing } from '@/theme/tokens';
import type { Order } from '@/data/types';

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Txt variant={strong ? 'bodyStrong' : 'bodySm'}>{label}</Txt>
      <Txt variant={strong ? 'bodyStrong' : 'bodySmStrong'} color={colors.text}>
        {value}
      </Txt>
    </View>
  );
}

export function PriceBreakdown({ price }: { price: Order['price'] }) {
  const { t } = useI18n();

  if (!price.confirmed) {
    return (
      <View style={{ gap: spacing.sm }}>
        <Badge label={t('price.pending')} tone="warning" icon="clock" />
        <Txt variant="bodySm">{t('price.pendingBody')}</Txt>
      </View>
    );
  }

  // "Precio del servicio" bundles provider + booking fee + VAT, exactly like success.html.
  const serviceCents =
    price.providerAmountCents + price.bookingFeeAmountCents + price.vatAmountCents;

  return (
    <View style={{ gap: spacing.md }}>
      <Row label={t('price.service')} value={money(serviceCents)} />
      <Row label={t('price.processing')} value={money(price.processingFeeAmountCents)} />
      <Txt variant="caption" color={colors.textMuted}>
        {t('price.vatIncluded')}
      </Txt>
      <Divider />
      <Row label={t('price.total')} value={money(price.totalAmountCents)} strong />
    </View>
  );
}
