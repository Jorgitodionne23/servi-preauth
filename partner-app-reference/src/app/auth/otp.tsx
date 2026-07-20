/**
 * OTP verification. Six boxes, auto-advance, auto-submit on the last digit.
 * Any 6 digits are accepted — this is a prototype with no Firebase behind it,
 * and that's stated on screen rather than silently faked.
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
  const { signIn } = usePartner();

  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(''));
  const refs = useRef<(TextInput | null)[]>([]);

  const complete = digits.every((d) => d !== '');

  const submit = () => {
    signIn();
    router.replace('/(tabs)');
  };

  const onChange = (i: number, v: string) => {
    const char = v.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = char;
    setDigits(next);
    if (char && i < LENGTH - 1) refs.current[i + 1]?.focus();
    if (char && i === LENGTH - 1 && next.every((d) => d !== '')) submit();
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

      <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
        <Button label={t('auth.verify')} disabled={!complete} onPress={submit} />
        <Button label={t('auth.resend')} variant="ghost" size="md" />
        <Txt variant="caption" center>
          {t('auth.demoHint')}
        </Txt>
      </View>
    </Screen>
  );
}
