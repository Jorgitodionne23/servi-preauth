/**
 * Auth · Identifier — unified phone/email field (auto-detects @), Google
 * shortcut, and a country flag that hides for email. Reference UI only.
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
import { Divider } from '@/components/ui/Card';
import { useI18n } from '@/i18n/I18nContext';
import { colors, radius, spacing } from '@/theme/tokens';

export default function IdentifierScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const [value, setValue] = useState('');
  const isEmail = value.includes('@');
  const canContinue = value.trim().length > 3;

  const cont = () => {
    const type = isEmail ? 'email' : 'phone';
    router.push(`/auth/otp?type=${type}&value=${encodeURIComponent(value.trim())}&flow=signup`);
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
        <Button label={t('auth.google')} variant="secondary" icon="chrome" onPress={cont} />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Divider style={{ flex: 1 }} />
          <Txt variant="caption">{t('auth.or')}</Txt>
          <Divider style={{ flex: 1 }} />
        </View>

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
            onChangeText={setValue}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType={isEmail ? 'email-address' : 'default'}
          />
        </View>
        <Txt variant="caption">{t('auth.phoneHint')}</Txt>

        <Button label={t('common.continue')} icon="arrow-right" disabled={!canContinue} onPress={cont} />
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
