/**
 * Step 3 — coverage.
 *
 * Zones are chips rather than a map: SERVI operates in a dozen named colonias
 * around Santa Fe, and people who work there think in colonia names, not
 * polygons. A map would be more impressive and less usable.
 *
 * The ASAP toggle is separated out and explained, because it's the setting that
 * most changes how much work arrives.
 */
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { Toggle } from '@/components/ui/Toggle';
import { PressableScale } from '@/components/ui/Pressable';
import { StepHeader } from '@/components/StepHeader';
import { usePartner } from '@/state/PartnerStateContext';
import { useI18n } from '@/i18n/I18nContext';
import { ZONES } from '@/data/catalog';
import { colors, radius, spacing } from '@/theme/tokens';

const RADII = [5, 10, 15, 25];

export default function CoverageScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { onboarding, toggleOnboardingZone, patchOnboarding } = usePartner();

  return (
    <Screen bottomInset={spacing['3xl']}>
      <StepHeader step={3} title={t('onb.coverage.title')} subtitle={t('onb.coverage.subtitle')} />

      <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
        <Txt variant="label">{t('onb.coverage.zones')}</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {ZONES.map((z) => (
            <Chip
              key={z}
              label={z}
              active={onboarding.zones.includes(z)}
              onPress={() => toggleOnboardingZone(z)}
            />
          ))}
        </View>
      </View>

      <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
        <Txt variant="label">{t('onb.coverage.radius')}</Txt>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {RADII.map((r) => {
            const active = onboarding.radiusKm === r;
            return (
              <PressableScale
                key={r}
                onPress={() => patchOnboarding({ radiusKm: r })}
                scaleTo={0.96}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: radius.md,
                  borderWidth: 1.5,
                  borderColor: active ? colors.ink : colors.borderInput,
                  backgroundColor: active ? colors.ink : colors.bgElevated,
                  alignItems: 'center',
                }}
              >
                <Txt variant="bodySmStrong" color={active ? colors.textInverse : colors.text}>
                  {r} km
                </Txt>
              </PressableScale>
            );
          })}
        </View>
      </View>

      <Card style={{ marginTop: spacing.xl, gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Txt variant="bodyStrong" style={{ flex: 1 }}>
            {t('onb.coverage.asap')}
          </Txt>
          <Toggle
            value={onboarding.acceptsAsap}
            onChange={(v) => patchOnboarding({ acceptsAsap: v })}
            onColor={colors.accentDeep}
          />
        </View>
        <Txt variant="bodySm">{t('onb.coverage.asapHint')}</Txt>
      </Card>

      <View style={{ marginTop: spacing.xl }}>
        <Button
          label={t('common.continue')}
          disabled={onboarding.zones.length === 0}
          iconRight="arrow-right"
          onPress={() => router.push('/onboarding/documents')}
        />
      </View>
    </Screen>
  );
}
