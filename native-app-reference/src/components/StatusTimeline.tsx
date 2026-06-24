/**
 * StatusTimeline — vertical stepper showing an order's lifecycle progress.
 * Reached steps are inked + dated; future steps are muted.
 */
import { View } from 'react-native';
import { Txt } from './ui/Text';
import { Icon } from './ui/Icon';
import { STATUS_META } from './status';
import { useI18n } from '@/i18n/I18nContext';
import { colors, spacing } from '@/theme/tokens';
import type { TimelineStep } from '@/data/types';

function fmt(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) +
    ' · ' +
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function StatusTimeline({ steps }: { steps: TimelineStep[] }) {
  const { t } = useI18n();
  return (
    <View>
      {steps.map((step, i) => {
        const reached = step.at != null;
        const isLast = i === steps.length - 1;
        const meta = STATUS_META[step.status];
        const nextReached = !isLast && steps[i + 1].at != null;
        return (
          <View key={step.status} style={{ flexDirection: 'row', gap: spacing.md }}>
            {/* rail */}
            <View style={{ alignItems: 'center', width: 28 }}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: reached ? colors.ink : colors.surface,
                  borderWidth: reached ? 0 : 1,
                  borderColor: colors.border,
                }}
              >
                <Icon name={reached ? 'check' : meta.icon} size={14} color={reached ? colors.textInverse : colors.textMuted} />
              </View>
              {!isLast ? (
                <View
                  style={{
                    width: 2,
                    flex: 1,
                    minHeight: 26,
                    marginVertical: 2,
                    backgroundColor: nextReached ? colors.ink : colors.border,
                  }}
                />
              ) : null}
            </View>
            {/* label */}
            <View style={{ flex: 1, paddingBottom: isLast ? 0 : spacing.lg }}>
              <Txt variant="bodyStrong" color={reached ? colors.text : colors.textMuted}>
                {t(meta.labelKey)}
              </Txt>
              {reached ? (
                <Txt variant="caption" style={{ marginTop: 2 }}>
                  {fmt(step.at)}
                </Txt>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
