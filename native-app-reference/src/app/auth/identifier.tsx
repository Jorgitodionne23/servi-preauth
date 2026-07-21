/**
 * Auth · Identifier — phone sign-in (Firebase OTP). The unified field still
 * auto-detects an email, but v1 auth is phone-first: emails point the user back
 * to phone (email magic-link + Google arrive with a later release, matching the
 * web's dual-auth model).
 */
import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ServiLogo } from '@/components/ui/ServiLogo';
import { PressableScale } from '@/components/ui/Pressable';
import { useApp } from '@/state/AppStateContext';
import { useI18n } from '@/i18n/I18nContext';
import { colors, radius, spacing } from '@/theme/tokens';

function toE164(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.startsWith('+')) {
    const digits = trimmed.slice(1).replace(/\D/g, '');
    return digits.length >= 10 ? `+${digits}` : null;
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) return `+52${digits}`;
  if (digits.length === 12 && digits.startsWith('52')) return `+${digits}`;
  return null;
}

export default function IdentifierScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { beginPhoneAuth } = useApp();
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEmail = value.includes('@');
  const phone = toE164(value);
  const canContinue = !isEmail && !!phone && !sending;

  const cont = async () => {
    if (!phone) return;
    setSending(true);
    setError(null);
    try {
      await beginPhoneAuth(phone);
      router.push(`/auth/otp?type=phone&value=${encodeURIComponent(phone)}&flow=signup`);
    } catch (err) {
      const unavailable = err instanceof Error && err.message === 'firebase_unavailable';
      setError(t(unavailable ? 'auth.error.unavailable' : 'auth.error.sms'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen bottomInset={spacing.xl}>
      <ScreenHeader
        right={
          <PressableScale onPress={() => router.back()} haptic={false} style={closeBtn}>
            <Icon name="x" size={18} color={colors.text} />
          </PressableScale>
        }
      />
      <View style={{ marginTop: spacing.lg }}>
        <ServiLogo size={28} />
        <Txt variant="displayLg" style={{ marginTop: spacing.xl }}>
          {t('auth.signInTitle')}
        </Txt>
        <Txt variant="body" style={{ marginTop: spacing.sm }}>
          {t('auth.signInSub')}
        </Txt>
      </View>

      <View style={{ marginTop: spacing.xl, gap: spacing.lg }}>
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
          {!isEmail ? (
            <View style={{ height: 52, paddingHorizontal: 14, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.borderInput, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
              <Txt variant="bodySmStrong">MX</Txt>
              <Txt variant="bodySmStrong" color={colors.textMuted}>
                +52
              </Txt>
            </View>
          ) : null}
          <Input
            containerStyle={{ flex: 1 }}
            placeholder={t('auth.phoneOrEmail')}
            value={value}
            onChangeText={(v) => {
              setValue(v);
              setError(null);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType={isEmail ? 'email-address' : 'phone-pad'}
          />
        </View>
        <Txt variant="caption">{isEmail ? t('auth.emailSoon') : t('auth.phoneHint')}</Txt>

        {error ? (
          <Txt variant="bodySm" color={colors.danger}>
            {error}
          </Txt>
        ) : null}

        <Button
          label={sending ? t('req.uploading') : t('common.continue')}
          icon="arrow-right"
          disabled={!canContinue}
          onPress={cont}
        />
      </View>
    </Screen>
  );
}

const closeBtn = {
  width: 40,
  height: 40,
  borderRadius: 20,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  backgroundColor: colors.surface,
};
