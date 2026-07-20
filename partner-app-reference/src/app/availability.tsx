/**
 * Availability — the weekly working-hours grid.
 *
 * Per-day on/off with a from/to window. Hours are stepped through a fixed list
 * rather than typed or picked from a wheel: trades work in whole hours, and
 * tapping a number up and down is faster than any date picker on a phone in
 * one hand.
 */
import { View } from 'react-native';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Text';
import { Card, Divider } from '@/components/ui/Card';
import { Toggle } from '@/components/ui/Toggle';
import { PressableScale } from '@/components/ui/Pressable';
import { LangToggle } from '@/components/ui/LangToggle';
import { usePartner } from '@/state/PartnerStateContext';
import { useI18n } from '@/i18n/I18nContext';
import { colors, radius, spacing } from '@/theme/tokens';
import type { DayAvailability } from '@/data/types';
import type { StringKey } from '@/i18n/strings';

const HOURS = ['06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00',
  '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00'];

function shift(current: string, dir: 1 | -1, min?: string, max?: string): string {
  const i = HOURS.indexOf(current);
  const next = HOURS[Math.min(HOURS.length - 1, Math.max(0, i + dir))];
  if (min && HOURS.indexOf(next) <= HOURS.indexOf(min)) return current;
  if (max && HOURS.indexOf(next) >= HOURS.indexOf(max)) return current;
  return next;
}

export default function AvailabilityScreen() {
  const { t, tn } = useI18n();
  const { availability, setAvailability } = usePartner();

  const update = (day: DayAvailability['day'], patch: Partial<DayAvailability>) => {
    setAvailability(availability.map((d) => (d.day === day ? { ...d, ...patch } : d)));
  };

  const weeklyHours = availability
    .filter((d) => d.enabled)
    .reduce((sum, d) => sum + (HOURS.indexOf(d.to) - HOURS.indexOf(d.from)), 0);

  return (
    <Screen bottomInset={spacing['3xl']}>
      <ScreenHeader back title={t('avail.title')} right={<LangToggle />} />

      <Txt variant="body" style={{ marginTop: spacing.lg }}>
        {t('avail.subtitle')}
      </Txt>

      <Card style={{ marginTop: spacing.xl, gap: 0 }}>
        {availability.map((d, i) => (
          <View key={d.day}>
            {i > 0 ? <Divider /> : null}
            <View style={{ paddingVertical: 14, gap: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <Txt variant="bodyStrong" style={{ flex: 1 }}>
                  {t(`avail.day.${d.day}` as StringKey)}
                </Txt>
                {!d.enabled ? <Txt variant="caption">{t('avail.off')}</Txt> : null}
                <Toggle
                  value={d.enabled}
                  onChange={(v) => update(d.day, { enabled: v })}
                  onColor={colors.accentDeep}
                />
              </View>

              {d.enabled ? (
                <View style={{ flexDirection: 'row', gap: spacing.md }}>
                  <TimeStepper
                    value={d.from}
                    onChange={(v) => update(d.day, { from: v })}
                    max={d.to}
                  />
                  <TimeStepper
                    value={d.to}
                    onChange={(v) => update(d.day, { to: v })}
                    min={d.from}
                  />
                </View>
              ) : null}
            </View>
          </View>
        ))}
      </Card>

      <Txt variant="caption" center style={{ marginTop: spacing.lg }}>
        {tn('avail.hoursWeek', weeklyHours)}
      </Txt>
    </Screen>
  );
}

function TimeStepper({
  value,
  onChange,
  min,
  max,
}: {
  value: string;
  onChange: (v: string) => void;
  min?: string;
  max?: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 6,
        paddingVertical: 6,
        borderRadius: radius.sm,
        backgroundColor: colors.surface,
      }}
    >
      <Step label="−" onPress={() => onChange(shift(value, -1, min, max))} />
      <Txt variant="bodySmStrong">{value}</Txt>
      <Step label="+" onPress={() => onChange(shift(value, 1, min, max))} />
    </View>
  );
}

function Step({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.88}
      style={{
        width: 30, height: 30, borderRadius: 15,
        backgroundColor: colors.bgElevated,
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <Txt variant="bodyStrong">{label}</Txt>
    </PressableScale>
  );
}
