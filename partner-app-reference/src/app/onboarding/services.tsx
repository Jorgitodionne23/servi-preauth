/**
 * Step 2 — trades and skills.
 *
 * Multi-select by design. A real CDMX handyman does plumbing AND electrical AND
 * mounts televisions; forcing a single "specialty" is a modelling error that
 * costs both sides work. Skills only appear for selected trades, so the list
 * never becomes a wall of 30 checkboxes.
 *
 * This screen is reused from Profile → "Mis oficios" for editing later.
 */
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/Pressable';
import { StepHeader } from '@/components/StepHeader';
import { usePartner } from '@/state/PartnerStateContext';
import { useI18n } from '@/i18n/I18nContext';
import { TRADES } from '@/data/catalog';
import { colors, radius, spacing } from '@/theme/tokens';
import { loc } from '@/data/types';

export default function ServicesScreen() {
  const { t, tn, lang } = useI18n();
  const router = useRouter();
  const { onboarding, toggleOnboardingTrade, toggleOnboardingSkill } = usePartner();

  const selectedTrades = TRADES.filter((tr) => onboarding.tradeKeys.includes(tr.key));
  const valid = onboarding.tradeKeys.length > 0 && onboarding.skillKeys.length > 0;

  return (
    <Screen bottomInset={spacing['3xl']}>
      <StepHeader step={2} title={t('onb.services.title')} subtitle={t('onb.services.subtitle')} />

      {/* Trades */}
      <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
        {TRADES.map((tr) => {
          const active = onboarding.tradeKeys.includes(tr.key);
          return (
            <PressableScale
              key={tr.key}
              onPress={() => toggleOnboardingTrade(tr.key)}
              scaleTo={0.985}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                padding: spacing.lg,
                borderRadius: radius.md,
                borderWidth: 1.5,
                borderColor: active ? colors.accentDeep : colors.borderInput,
                backgroundColor: active ? colors.accentTint : colors.bgElevated,
              }}
            >
              <Icon
                name={tr.icon}
                size={20}
                color={active ? colors.accentInk : colors.textSecondary}
              />
              <Txt
                variant="bodyStrong"
                color={active ? colors.accentInk : colors.text}
                style={{ flex: 1 }}
              >
                {loc(tr.label, lang)}
              </Txt>
              <View
                style={{
                  width: 22, height: 22, borderRadius: 6,
                  borderWidth: 2,
                  borderColor: active ? colors.accentDeep : colors.borderInput,
                  backgroundColor: active ? colors.accentDeep : 'transparent',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                {active ? <Icon name="check" size={13} color={colors.textInverse} /> : null}
              </View>
            </PressableScale>
          );
        })}
      </View>

      {/* Skills, only for chosen trades */}
      {selectedTrades.length ? (
        <View style={{ marginTop: spacing.xl, gap: spacing.lg }}>
          <View>
            <Txt variant="headingSm">{t('onb.services.skills')}</Txt>
            <Txt variant="caption" style={{ marginTop: 3 }}>
              {t('onb.services.skillsHint')}
            </Txt>
          </View>

          {selectedTrades.map((tr) => (
            <Card key={tr.key} style={{ gap: spacing.md }}>
              <Txt variant="bodySmStrong">{loc(tr.label, lang)}</Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {tr.skills.map((sk) => (
                  <Chip
                    key={sk.es}
                    label={loc(sk, lang)}
                    active={onboarding.skillKeys.includes(sk.es)}
                    onPress={() => toggleOnboardingSkill(sk.es)}
                  />
                ))}
              </View>
            </Card>
          ))}

          <Txt variant="caption">
            {tn('onb.services.selected', onboarding.skillKeys.length)}
          </Txt>
        </View>
      ) : null}

      <View style={{ marginTop: spacing.xl }}>
        <Button
          label={t('common.continue')}
          disabled={!valid}
          iconRight="arrow-right"
          onPress={() => router.push('/onboarding/coverage')}
        />
      </View>
    </Screen>
  );
}
