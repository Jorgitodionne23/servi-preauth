/**
 * SpecialistCard — the matched SERVI Partner. Shows avatar initials, rating,
 * jobs, trade, and a "trusted/saved" marker (anti-disintermediation feature in
 * the real product). Contact is intentionally routed through SERVI.
 */
import { View } from 'react-native';
import { Txt } from './ui/Text';
import { Icon } from './ui/Icon';
import { Badge } from './ui/Badge';
import { useI18n } from '@/i18n/I18nContext';
import { loc } from '@/data/types';
import { colors, spacing } from '@/theme/tokens';
import type { Specialist } from '@/data/types';

export function SpecialistCard({ specialist }: { specialist: Specialist }) {
  const { lang } = useI18n();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.accentTint,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Txt variant="headingMd" color={colors.accentInk}>
          {specialist.initials}
        </Txt>
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Txt variant="bodyStrong">{specialist.name}</Txt>
          {specialist.trusted ? <Badge label={lang === 'es' ? 'De confianza' : 'Trusted'} tone="accent" icon="shield" /> : null}
        </View>
        <Txt variant="caption" style={{ marginTop: 2 }}>
          {loc(specialist.trade, lang)}
        </Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon name="star" size={13} color={colors.warning} />
            <Txt variant="bodySmStrong">{specialist.rating.toFixed(1)}</Txt>
          </View>
          <Txt variant="caption">{specialist.jobs} {lang === 'es' ? 'servicios' : 'jobs'}</Txt>
        </View>
      </View>
    </View>
  );
}
