/**
 * Sign in — phone only.
 *
 * Unlike the customer app (which offers phone / email / Google), a specialist
 * signs in with their phone number and nothing else. They have exactly one
 * phone, they already gave it to SERVI during onboarding, it's the channel
 * dispatch uses, and email is unreliable in this population. Offering three
 * auth methods here would be optionality that only creates support tickets.
 */
import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Text';
import { Field, Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { LangToggle } from '@/components/ui/LangToggle';
import { ServiLogo } from '@/components/ui/ServiLogo';
import { usePartner } from '@/state/PartnerStateContext';
import { useI18n } from '@/i18n/I18nContext';
import { colors, spacing } from '@/theme/tokens';

function toE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (raw.trim().startsWith('+')) return digits.length >= 10 ? `+${digits}` : null;
  if (digits.length === 10) return `+52${digits}`;
  if (digits.length === 12 && digits.startsWith('52')) return `+${digits}`;
  return null;
}

export default function PhoneScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { beginPhoneAuth } = usePartner();
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const e164 = toE164(phone);
  const valid = !!e164 && !sending;

  const send = async () => {
    if (!e164) return;
    setSending(true);
    setError(null);
    try {
      await beginPhoneAuth(e164);
      router.push({ pathname: '/auth/otp', params: { phone: e164 } });
    } catch (err) {
      const unavailable = err instanceof Error && err.message === 'firebase_unavailable';
      setError(t(unavailable ? 'auth.error.unavailable' : 'auth.error.sms'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen bottomInset={spacing['3xl']}>
      <ScreenHeader back right={<LangToggle />} />

      <View style={{ marginTop: spacing.xl }}>
        <ServiLogo size={24} partner />
        <Txt variant="displayLg" style={{ marginTop: spacing.xl }}>
          {t('auth.title')}
        </Txt>
        <Txt variant="body" style={{ marginTop: spacing.md }}>
          {t('auth.subtitle')}
        </Txt>
      </View>

      <View style={{ marginTop: spacing['2xl'] }}>
        <Field label={t('auth.phoneLabel')}>
          <Input
            icon="phone"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="55 1234 5678"
            autoFocus
          />
        </Field>
      </View>

      <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
        {error ? (
          <Txt variant="bodySm" color={colors.danger}>
            {error}
          </Txt>
        ) : null}
        <Button
          label={sending ? t('auth.sending') : t('auth.sendCode')}
          disabled={!valid}
          onPress={send}
        />
        <Txt variant="caption" center>
          {t('auth.noAccount')}
        </Txt>
        <Button
          label={t('auth.apply')}
          variant="ghost"
          size="md"
          onPress={() => router.replace('/onboarding/welcome')}
        />
      </View>
    </Screen>
  );
}
