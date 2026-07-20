/**
 * StepHeader — progress rail for the onboarding flow.
 *
 * A segmented rail rather than a percentage: a specialist deciding whether to
 * continue wants to see how many discrete things are left, not an abstract
 * number. Six visible segments make "almost done" self-evident.
 */
import { View } from 'react-native';
import { ScreenHeader } from './ui/Screen';
import { Txt } from './ui/Text';
import { useI18n } from '@/i18n/I18nContext';
import { colors, spacing } from '@/theme/tokens';

export const ONBOARDING_STEPS = 6;

export function StepHeader({
  step,
  title,
  subtitle,
}: {
  step: number;
  title: string;
  subtitle?: string;
}) {
  const { t } = useI18n();
  return (
    <View>
      <ScreenHeader back />
      <View style={{ flexDirection: 'row', gap: 5, marginTop: spacing.lg }}>
        {Array.from({ length: ONBOARDING_STEPS }).map((_, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              backgroundColor: i < step ? colors.ink : colors.border,
            }}
          />
        ))}
      </View>
      <Txt variant="caption" style={{ marginTop: spacing.md }}>
        {t('onb.step', { n: step, total: ONBOARDING_STEPS })}
      </Txt>
      <Txt variant="displayLg" style={{ marginTop: spacing.sm }}>
        {title}
      </Txt>
      {subtitle ? (
        <Txt variant="body" style={{ marginTop: spacing.sm }}>
          {subtitle}
        </Txt>
      ) : null}
    </View>
  );
}
