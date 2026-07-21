/**
 * OTP verification. Six boxes, auto-advance, auto-submit on the last digit.
 * Confirms the Firebase SMS code, then exchanges the ID token for a provider
 * session (POST /api/provider/auth/firebase). A phone that isn't a registered
 * specialist routes to the free application instead.
 */
import { useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { usePartner } from '@/state/PartnerStateContext';
import { useI18n } from '@/i18n/I18nContext';
import { colors, radius, spacing } from '@/theme/tokens';
import { fonts } from '@/theme/typography';

const LENGTH = 6;

export default function OtpScreen() {
  const { phone } = useLocalSearchParams<{ phone?: string }>();
  const { t } = useI18n();
  const router = useRouter();
  const { confirmPhoneCode, beginPhoneAuth } = usePartner();

  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refs = useRef<(TextInput | null)[]>([]);

  const complete = digits.every((d) => d !== '');

  const submit = async (code?: string) => {
    const value = code ?? digits.join('');
    if (value.length < LENGTH || busy) return;
    setBusy(true);
    setError(null);
    try {
      const outcome = await confirmPhoneCode(value);
      if (outcome === 'ok') {
        router.replace('/(tabs)');
      } else {
        setError(t('auth.error.notProvider'));
      }
    } catch {
      setError(t('auth.error.code'));
      setDigits(Array(LENGTH).fill(''));
      refs.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (!phone || busy) return;
    setBusy(true);
    setError(null);
    try {
      await beginPhoneAuth(String(phone));
    } catch {
      setError(t('auth.error.sms'));
    } finally {
      setBusy(false);
    }
  };

  const onChange = (i: number, v: string) => {
    const char = v.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = char;
    setDigits(next);
    if (char && i < LENGTH - 1) refs.current[i + 1]?.focus();
    if (char && i === LENGTH - 1 && next.every((d) => d !== '')) submit(next.join(''));
  };

  return (
    <Screen bottomInset={spacing['3xl']}>
      <ScreenHeader back />

      <View style={{ marginTop: spacing.xl }}>
        <Txt variant="displayLg">{t('auth.otpTitle')}</Txt>
        <Txt variant="body" style={{ marginTop: spacing.md }}>
          {t('auth.otpSubtitle', { phone: String(phone ?? '') })}
        </Txt>
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing['2xl'] }}>
        {digits.map((d, i) => (
          <TextInput
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            value={d}
            onChangeText={(v) => onChange(i, v)}
            onKeyPress={({ nativeEvent }) => {
              if (nativeEvent.key === 'Backspace' && !digits[i] && i > 0) {
                refs.current[i - 1]?.focus();
              }
            }}
            keyboardType="number-pad"
            maxLength={1}
            autoFocus={i === 0}
            style={{
              flex: 1,
              height: 62,
              borderRadius: radius.md,
              borderWidth: 1.5,
              borderColor: d ? colors.accentDeep : colors.borderInput,
              backgroundColor: colors.bgElevated,
              textAlign: 'center',
              fontFamily: fonts.displaySemi,
              fontSize: 24,
              color: colors.text,
            }}
          />
        ))}
      </View>

      {error ? (
        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          <Txt variant="bodySm" color={colors.danger}>
            {error}
          </Txt>
          {error === t('auth.error.notProvider') ? (
            <Button
              label={t('auth.apply')}
              variant="secondary"
              size="md"
              onPress={() => router.replace('/onboarding/welcome')}
            />
          ) : null}
        </View>
      ) : null}

      <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
        <Button label={t('auth.verify')} disabled={!complete || busy} onPress={() => submit()} />
        <Button label={t('auth.resend')} variant="ghost" size="md" onPress={resend} />
      </View>
    </Screen>
  );
}
