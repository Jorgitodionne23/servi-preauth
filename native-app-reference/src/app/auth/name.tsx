/**
 * Auth · Name — required name collection (used for booking invoices). Persists
 * via PATCH /api/auth/me. Mirrors the web "¿Cuál es tu nombre?" step.
 */
import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Input, Field } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { useApp } from '@/state/AppStateContext';
import { useI18n } from '@/i18n/I18nContext';
import { colors, spacing } from '@/theme/tokens';

export default function NameScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { completeName } = useApp();
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const save = async () => {
    if (!first.trim() || !last.trim() || busy) return;
    setBusy(true);
    setError(false);
    try {
      await completeName(first, last);
      router.replace('/auth/verify-email');
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen bottomInset={spacing.xl}>
      <ScreenHeader back />
      <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
        <Badge label={t('auth.name.verified')} tone="success" icon="check-circle" />
        <Txt variant="displayLg" style={{ marginTop: spacing.sm }}>
          {t('auth.name.title')}
        </Txt>
        <Txt variant="body">{t('auth.name.sub')}</Txt>
      </View>

      <View style={{ marginTop: spacing.xl, gap: spacing.lg }}>
        <Field label={t('auth.name.first')}>
          <Input placeholder="Juan" value={first} onChangeText={setFirst} autoCapitalize="words" />
        </Field>
        <Field label={t('auth.name.last')}>
          <Input placeholder="García" value={last} onChangeText={setLast} autoCapitalize="words" />
        </Field>
        {error ? (
          <Txt variant="bodySm" color={colors.danger}>
            {t('req.review.sendError')}
          </Txt>
        ) : null}
        <Button label={t('common.continue')} icon="arrow-right" disabled={!first.trim() || !last.trim() || busy} onPress={save} />
      </View>
    </Screen>
  );
}
