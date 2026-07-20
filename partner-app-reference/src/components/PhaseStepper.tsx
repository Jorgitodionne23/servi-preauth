/**
 * PhaseStepper — the on-site milestone flow.
 *
 * Maps exactly onto the backend's `MILESTONE_EVENTS`
 * (`en_route | arrived | started | completed`) which `POST /api/provider/checkin`
 * accepts, and which the customer app renders as its live order timeline.
 *
 * Design intent: exactly ONE tappable action at a time. A specialist doing this
 * one-handed, standing in a doorway, holding a toolbag, should not have to
 * choose between four buttons. Completed steps collapse into timestamped rows;
 * the next step is a full-width primary button; later steps are dimmed previews
 * so the whole sequence is still legible.
 */
import { View } from 'react-native';
import { Txt } from './ui/Text';
import { Icon } from './ui/Icon';
import { Button } from './ui/Button';
import { useI18n } from '@/i18n/I18nContext';
import { colors, radius, spacing } from '@/theme/tokens';
import { phaseTone } from '@/theme/partner';
import { clockTime } from '@/data/time';
import { PHASE_ORDER, type Job, type JobPhase } from '@/data/types';
import type { StringKey } from '@/i18n/strings';

export function PhaseStepper({
  job,
  onCheckIn,
}: {
  job: Job;
  onCheckIn: (phase: JobPhase) => void;
}) {
  const { t } = useI18n();
  const nextPhase = PHASE_ORDER.find((p) => !job.phaseTimes[p]) ?? null;

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ gap: spacing.sm }}>
        {PHASE_ORDER.map((phase, i) => {
          const at = job.phaseTimes[phase];
          const isNext = phase === nextPhase;
          const tone = phaseTone[phase];

          if (at) {
            return (
              <View
                key={phase}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  paddingVertical: 10,
                  paddingHorizontal: spacing.md,
                  borderRadius: radius.sm,
                  backgroundColor: tone.bg,
                }}
              >
                <Icon name="check" size={16} color={tone.dot} />
                <Txt variant="bodySmStrong" color={tone.ink} style={{ flex: 1 }}>
                  {t(`phase.${phase}.done` as StringKey)}
                </Txt>
                <Txt variant="caption" color={tone.ink}>
                  {clockTime(at)}
                </Txt>
              </View>
            );
          }

          if (isNext) {
            return (
              <Button
                key={phase}
                label={t(`phase.${phase}` as StringKey)}
                icon={phase === 'completed' ? 'check-circle' : 'arrow-right'}
                onPress={() => onCheckIn(phase)}
              />
            );
          }

          return (
            <View
              key={phase}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                paddingVertical: 10,
                paddingHorizontal: spacing.md,
                borderRadius: radius.sm,
                borderWidth: 1,
                borderColor: colors.border,
                borderStyle: 'dashed',
                opacity: 0.55,
              }}
            >
              <View
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 8,
                  borderWidth: 1.5,
                  borderColor: colors.borderStrong,
                }}
              />
              <Txt variant="bodySm" style={{ flex: 1 }}>
                {t(`phase.${phase}` as StringKey)}
              </Txt>
              <Txt variant="caption">{i + 1}</Txt>
            </View>
          );
        })}
      </View>

      <Txt variant="caption">{t('phase.hint')}</Txt>
    </View>
  );
}
