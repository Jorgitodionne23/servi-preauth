/**
 * Auth · OTP — verify the SMS code (Firebase), then exchange the Firebase ID
 * token for a SERVI session via POST /api/auth/firebase. Routes to name
 * collection when the account has no name yet.
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
  const { type, value } = useLocalSearchParams<{ type: string; value: string; flow: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const { confirmPhoneCode, beginPhoneAuth } = useApp();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPhone = type !== 'email';

  const verify = async () => {
    if (code.length < 6 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const outcome = await confirmPhoneCode(code);
      if (outcome === 'needs_name') router.replace('/auth/name');
      else router.replace('/(tabs)/account');
    } catch {
      setError(t('auth.error.code'));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (!value || busy) return;
    setBusy(true);
    setError(null);
    try {
      await beginPhoneAuth(String(value));
    } catch {
      setError(t('auth.error.sms'));
    } finally {
      setBusy(false);
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

      {error ? (
        <Txt variant="bodySm" color={colors.danger} style={{ marginTop: spacing.md }}>
          {error}
        </Txt>
      ) : null}

      <View style={{ marginTop: spacing.xl, gap: spacing.lg }}>
        <Button label={t('auth.otp.verify')} icon="check" disabled={code.length < 6 || busy} onPress={verify} />
        <View style={{ alignItems: 'center', gap: spacing.md }}>
          <PressableScale onPress={resend} haptic={false}>
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
