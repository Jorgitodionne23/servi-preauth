/**
 * Coverage — edit the working zone after onboarding. Same controls as
 * `onboarding/coverage`, bound to the live specialist record instead of the
 * application draft.
 */
import { View } from 'react-native';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Toggle } from '@/components/ui/Toggle';
import { PressableScale } from '@/components/ui/Pressable';
import { LangToggle } from '@/components/ui/LangToggle';
import { usePartner } from '@/state/PartnerStateContext';
import { useI18n } from '@/i18n/I18nContext';
import { ZONES } from '@/data/catalog';
import { colors, radius, spacing } from '@/theme/tokens';

const RADII = [5, 10, 15, 25];

export default function CoverageSettingsScreen() {
  const { t } = useI18n();
  const { coverage, setCoverage } = usePartner();

  const toggleZone = (z: string) =>
    setCoverage({
      ...coverage,
      zones: coverage.zones.includes(z)
        ? coverage.zones.filter((x) => x !== z)
        : [...coverage.zones, z],
    });

  return (
    <Screen bottomInset={spacing['3xl']}>
      <ScreenHeader back title={t('cov.title')} right={<LangToggle />} />

      <Txt variant="body" style={{ marginTop: spacing.lg }}>
        {t('cov.subtitle')}
      </Txt>

      <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
        <Txt variant="label">{t('onb.coverage.zones')}</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {ZONES.map((z) => (
            <Chip
              key={z}
              label={z}
              active={coverage.zones.includes(z)}
              onPress={() => toggleZone(z)}
            />
          ))}
        </View>
      </View>

      <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
        <Txt variant="label">{t('onb.coverage.radius')}</Txt>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {RADII.map((r) => {
            const active = coverage.radiusKm === r;
            return (
              <PressableScale
                key={r}
                onPress={() => setCoverage({ ...coverage, radiusKm: r })}
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
            value={coverage.acceptsAsap}
            onChange={(v) => setCoverage({ ...coverage, acceptsAsap: v })}
            onColor={colors.accentDeep}
          />
        </View>
        <Txt variant="bodySm">{t('onb.coverage.asapHint')}</Txt>
      </Card>
    </Screen>
  );
}
