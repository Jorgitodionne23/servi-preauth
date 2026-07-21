/**
 * Auth · Email — explains the booking gate: phone-only first-time users can
 * place their first order; a verified email is required for subsequent orders.
 * Adding/verifying email happens from the web account page in v1 (email
 * magic-link in-app arrives with a later release).
 */
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { InfoCard } from '@/components/ui/InfoCard';
import { useI18n } from '@/i18n/I18nContext';
import { spacing } from '@/theme/tokens';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { t } = useI18n();

  const finish = () => router.replace('/(tabs)/account');

  return (
    <Screen bottomInset={spacing.xl}>
      <ScreenHeader back />
      <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
        <Txt variant="displayLg">{t('auth.email.title')}</Txt>
        <Txt variant="body">{t('auth.email.later')}</Txt>
      </View>

      <View style={{ marginTop: spacing.xl, gap: spacing.lg }}>
        <InfoCard icon="info" title={t('auth.gate.title')} body={t('auth.email.skipNote')} />
        <Button label={t('common.done')} icon="check" onPress={finish} />
      </View>
    </Screen>
  );
}
