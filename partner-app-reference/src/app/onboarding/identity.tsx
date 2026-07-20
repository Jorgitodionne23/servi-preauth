/**
 * Step 1 — identity. Deliberately the shortest step: the first screen after
 * "start my application" should be finishable in under a minute or the drop-off
 * happens here and nowhere else.
 */
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Field, Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { StepHeader } from '@/components/StepHeader';
import { usePartner } from '@/state/PartnerStateContext';
import { useI18n } from '@/i18n/I18nContext';
import { spacing } from '@/theme/tokens';

export default function IdentityScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { onboarding, patchOnboarding } = usePartner();

  const valid =
    onboarding.firstName.trim().length > 1 &&
    onboarding.lastName.trim().length > 1 &&
    onboarding.phone.replace(/\D/g, '').length >= 10;

  return (
    <Screen bottomInset={spacing['3xl']}>
      <StepHeader step={1} title={t('onb.identity.title')} subtitle={t('onb.identity.subtitle')} />

      <View style={{ marginTop: spacing.xl, gap: spacing.lg }}>
        <Field label={t('onb.identity.first')}>
          <Input
            icon="user"
            value={onboarding.firstName}
            onChangeText={(v) => patchOnboarding({ firstName: v })}
            autoCapitalize="words"
            placeholder="Pablo"
          />
        </Field>

        <Field label={t('onb.identity.last')}>
          <Input
            value={onboarding.lastName}
            onChangeText={(v) => patchOnboarding({ lastName: v })}
            autoCapitalize="words"
            placeholder="Méndez Ruiz"
          />
        </Field>

        <Field label={t('onb.identity.phone')}>
          <Input
            icon="phone"
            value={onboarding.phone}
            onChangeText={(v) => patchOnboarding({ phone: v })}
            keyboardType="phone-pad"
            placeholder="55 1234 5678"
          />
        </Field>

        <Field label={`${t('onb.identity.email')} · ${t('common.optional')}`}>
          <Input
            icon="mail"
            value={onboarding.email}
            onChangeText={(v) => patchOnboarding({ email: v })}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="tucorreo@ejemplo.com"
          />
        </Field>

        <Field label={t('onb.identity.city')}>
          <Input
            icon="map-pin"
            value={onboarding.city}
            onChangeText={(v) => patchOnboarding({ city: v })}
          />
        </Field>
      </View>

      <View style={{ marginTop: spacing.xl }}>
        <Button
          label={t('common.continue')}
          disabled={!valid}
          iconRight="arrow-right"
          onPress={() => router.push('/onboarding/services')}
        />
      </View>
    </Screen>
  );
}
