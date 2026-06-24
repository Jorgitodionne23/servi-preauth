/**
 * Auth · OTP — dynamic phone/email verification (title + subtitle adapt to the
 * identifier type, per the auth state machine). Any 6 digits "verify" in the
 * prototype. Routes to name collection (signup) or finishes (login).
 */
import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { OTPInput } from '@/components/OTPInput';
import { PressableScale } from '@/components/ui/Pressable';
import { useApp } from '@/state/AppStateContext';
import { useI18n } from '@/i18n/I18nContext';
import { colors, spacing } from '@/theme/tokens';

export default function OtpScreen() {
  const { type, value, flow } = useLocalSearchParams<{ type: string; value: string; flow: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const { signIn } = useApp();
  const [code, setCode] = useState('');

  const isPhone = type !== 'email';

  const verify = () => {
    if (code.length < 6) return;
    if (flow === 'signup') {
      router.push('/auth/name');
    } else {
      signIn();
      router.replace('/(tabs)/account');
    }
  };

  return (
    <Screen bottomInset={spacing.xl}>
      <ScreenHeader back />
      <View style={{ marginTop: spacing.lg }}>
        <Txt variant="displayLg">{isPhone ? t('auth.otp.phoneTitle') : t('auth.otp.emailTitle')}</Txt>
        <Txt variant="body" style={{ marginTop: spacing.sm }}>
          {isPhone ? t('auth.otp.phoneSub') : t('auth.otp.emailSub')} <Txt variant="bodyStrong">{value}</Txt>
        </Txt>
      </View>

      <View style={{ marginTop: spacing['2xl'] }}>
        <OTPInput value={code} onChange={setCode} autoFocus />
      </View>

      <View style={{ marginTop: spacing.xl, gap: spacing.lg }}>
        <Button label={t('auth.otp.verify')} icon="check" disabled={code.length < 6} onPress={verify} />
        <View style={{ alignItems: 'center', gap: spacing.md }}>
          <PressableScale onPress={() => setCode('')} haptic={false}>
            <Txt variant="bodySmStrong" color={colors.accentInk}>
              {t('auth.otp.resend')}
            </Txt>
          </PressableScale>
          {isPhone ? <Txt variant="caption">{t('auth.otp.noPhone')}</Txt> : null}
        </View>
      </View>
    </Screen>
  );
}
