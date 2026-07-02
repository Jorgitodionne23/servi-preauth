/**
 * Auth · Verify email — secondary identifier collection + the booking gate
 * concept: phone-only first-time users can place their first order, but a
 * verified email is required for returning users / subsequent orders.
 */
import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PressableScale } from '@/components/ui/Pressable';
import { InfoCard } from '@/components/ui/InfoCard';
import { useApp } from '@/state/AppStateContext';
import { useI18n } from '@/i18n/I18nContext';
import { colors, spacing } from '@/theme/tokens';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { signIn } = useApp();
  const [email, setEmail] = useState('');

  const finish = () => {
    signIn();
    router.replace('/(tabs)/account');
  };

  return (
    <Screen bottomInset={spacing.xl}>
      <ScreenHeader back />
      <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
        <Txt variant="displayLg">{t('auth.email.title')}</Txt>
        <Txt variant="body">{t('auth.email.sub')}</Txt>
      </View>

      <View style={{ marginTop: spacing.xl, gap: spacing.lg }}>
        <Input
          icon="mail"
          placeholder="correo@ejemplo.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Button label={t('auth.email.verify')} icon="arrow-right" disabled={!email.includes('@')} onPress={finish} />

        <PressableScale onPress={finish} haptic={false} style={{ alignItems: 'center', paddingVertical: spacing.sm }}>
          <Txt variant="bodySmStrong" color={colors.textSecondary}>
            {t('common.skip')}
          </Txt>
        </PressableScale>

        <InfoCard icon="info" title={t('auth.gate.title')} body={t('auth.email.skipNote')} />
      </View>
    </Screen>
  );
}
