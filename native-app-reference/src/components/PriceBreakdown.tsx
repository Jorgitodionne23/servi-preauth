/**
 * PriceBreakdown — provider price → booking fee → processing → total, matching
 * the web `computePricing()` model. When the price isn't confirmed yet, shows
 * the "we confirm the price first" state instead of numbers.
 */
import { View } from 'react-native';
import { Txt } from './ui/Text';
import { Divider } from './ui/Card';
import { Badge } from './ui/Badge';
import { useI18n } from '@/i18n/I18nContext';
import { colors, spacing } from '@/theme/tokens';
import type { Order } from '@/data/types';

const mxn = (n: number) => `$${n.toLocaleString('es-MX')} MXN`;

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
  const { lang } = useI18n();

  if (!price.confirmed) {
    return (
      <View style={{ gap: spacing.sm }}>
        <Badge label={lang === 'es' ? 'Precio por confirmar' : 'Price to be confirmed'} tone="warning" icon="clock" />
        <Txt variant="bodySm">
          {lang === 'es'
            ? 'SERVI confirma el precio con tu especialista antes de cualquier cargo o retención.'
            : 'SERVI confirms the price with your specialist before any hold or charge.'}
        </Txt>
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.md }}>
      <Row label={lang === 'es' ? 'Servicio del especialista' : 'Specialist service'} value={mxn(price.provider)} />
      <Row label={lang === 'es' ? 'Tarifa de reserva' : 'Booking fee'} value={mxn(price.bookingFee)} />
      <Row label={lang === 'es' ? 'Procesamiento + IVA' : 'Processing + VAT'} value={mxn(price.processing)} />
      <Divider />
      <Row label={lang === 'es' ? 'Total' : 'Total'} value={mxn(price.total)} strong />
    </View>
  );
}
