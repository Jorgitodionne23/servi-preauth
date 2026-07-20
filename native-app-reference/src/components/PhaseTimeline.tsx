/**
 * PhaseTimeline — the customer's read-only view of the specialist's on-site
 * check-ins. This is the counterpart to the partner app's PhaseStepper: the
 * specialist taps "Voy en camino → Llegué → Empecé → Terminé" and each event
 * lands here as a reached milestone with a timestamp.
 *
 * It is a SEPARATE track from StatusTimeline (payment/coordination). Backend:
 * the four events are `MILESTONE_EVENTS`, written by POST /api/provider/checkin;
 * a production build would read them from a customer-scoped lifecycle route
 * (see INTEROP.md "Needs building"). Here they come from `order.phaseTimes`.
 */
import { View } from 'react-native';
import { Txt } from './ui/Text';
import { Icon, type FeatherName } from './ui/Icon';
import { useI18n } from '@/i18n/I18nContext';
import { clockTime } from '@/data/time';
import { colors, spacing } from '@/theme/tokens';
import { PHASE_ORDER, type ServicePhase } from '@/data/types';
import type { StringKey } from '@/i18n/strings';

const PHASE_META: Record<ServicePhase, { icon: FeatherName; labelKey: StringKey }> = {
  en_route: { icon: 'navigation', labelKey: 'phase.en_route' },
  arrived: { icon: 'map-pin', labelKey: 'phase.arrived' },
  started: { icon: 'tool', labelKey: 'phase.started' },
  completed: { icon: 'check-circle', labelKey: 'phase.completed' },
};

export function PhaseTimeline({ phaseTimes }: { phaseTimes: Partial<Record<ServicePhase, string>> }) {
  const { t } = useI18n();
  return (
    <View>
      {PHASE_ORDER.map((phase, i) => {
        const at = phaseTimes[phase] ?? null;
        const reached = at != null;
        const isLast = i === PHASE_ORDER.length - 1;
        const nextReached = !isLast && phaseTimes[PHASE_ORDER[i + 1]] != null;
        const meta = PHASE_META[phase];
        return (
          <View key={phase} style={{ flexDirection: 'row', gap: spacing.md }}>
            {/* rail */}
            <View style={{ alignItems: 'center', width: 28 }}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: reached ? colors.accent : colors.surface,
                  borderWidth: reached ? 0 : 1,
                  borderColor: colors.border,
                }}
              >
                <Icon name={meta.icon} size={14} color={reached ? colors.accentInk : colors.textMuted} />
              </View>
              {!isLast ? (
                <View
                  style={{
                    width: 2,
                    flex: 1,
                    minHeight: 22,
                    marginVertical: 2,
                    backgroundColor: nextReached ? colors.accent : colors.border,
                  }}
                />
              ) : null}
            </View>
            {/* label */}
            <View style={{ flex: 1, paddingBottom: isLast ? 0 : spacing.md }}>
              <Txt variant="bodyStrong" color={reached ? colors.text : colors.textMuted}>
                {t(meta.labelKey)}
              </Txt>
              {reached ? (
                <Txt variant="caption" style={{ marginTop: 2 }}>
                  {clockTime(at)}
                </Txt>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
