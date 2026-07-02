/**
 * Partner — provider entry point as a SECONDARY CTA only. This is the customer
 * app; full Partner onboarding lives on the web. Reference UI only.
 */
import { View } from 'react-native';

import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Text';
import { Icon, type FeatherName } from '@/components/ui/Icon';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useI18n } from '@/i18n/I18nContext';
import { colors, radius, spacing } from '@/theme/tokens';

const BENEFITS: { icon: FeatherName; es: string; en: string }[] = [
  { icon: 'users', es: 'Clientes verificados en tu zona', en: 'Verified clients in your area' },
  { icon: 'shield', es: 'Pagos garantizados por SERVI', en: 'Payments guaranteed by SERVI' },
  { icon: 'calendar', es: 'Tú eliges tu disponibilidad', en: 'You choose your availability' },
];

export default function PartnerScreen() {
  const { t, lang } = useI18n();

  return (
    <Screen bottomInset={spacing.xl}>
      <ScreenHeader back />
      <View style={{ marginTop: spacing.md }}>
        <View style={{ width: 56, height: 56, borderRadius: radius.lg, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md }}>
          <Icon name="briefcase" size={26} color={colors.textInverse} />
        </View>
        <Txt variant="displayLg">{t('partner.title')}</Txt>
        <Txt variant="body" style={{ marginTop: spacing.sm }}>
          {t('partner.sub')}
        </Txt>
      </View>

      <Card style={{ marginTop: spacing.xl, gap: spacing.lg }}>
        {BENEFITS.map((b, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.accentTint, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={b.icon} size={18} color={colors.accentInk} />
            </View>
            <Txt variant="bodyStrong" style={{ flex: 1 }}>
              {lang === 'es' ? b.es : b.en}
            </Txt>
          </View>
        ))}
      </Card>

      <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
        <Button label={t('partner.cta')} icon="arrow-up-right" onPress={() => {}} />
        <Txt variant="caption" center>
          {t('partner.note')}
        </Txt>
      </View>
    </Screen>
  );
}
