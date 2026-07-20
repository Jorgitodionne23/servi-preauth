/**
 * SpecialistCard — the matched SERVI Partner as the customer sees them: a MASKED
 * name ("Pablo M."), the trade they're doing (derived from the order category,
 * passed in), a SERVI-verified line, and a "trusted/saved" marker. Contact is
 * intentionally routed through SERVI (anti-disintermediation) — there is no call
 * or message affordance on this card.
 *
 * The customer never sees a full name, phone, or email — the backend enforces
 * this in ~8 routes via maskProviderName(). The masked-name note explaining WHY
 * is rendered once on the order screen, not here.
 */
import { View } from 'react-native';
import { Txt } from './ui/Text';
import { Icon } from './ui/Icon';
import { Badge } from './ui/Badge';
import { useI18n } from '@/i18n/I18nContext';
import { loc } from '@/data/types';
import { colors, spacing } from '@/theme/tokens';
import type { Bilingual, Specialist } from '@/data/types';

export function SpecialistCard({ specialist, trade }: { specialist: Specialist; trade?: Bilingual }) {
  const { t, lang } = useI18n();
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
          <Txt variant="bodyStrong">{specialist.maskedName}</Txt>
          {specialist.trusted ? <Badge label={t('spec.trusted')} tone="accent" icon="shield" /> : null}
        </View>
        {trade ? (
          <Txt variant="caption" style={{ marginTop: 2 }}>
            {loc(trade, lang)}
          </Txt>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon name="check-circle" size={13} color={colors.accentDeep} />
            <Txt variant="caption" color={colors.accentInk}>
              {t('spec.verified')}
            </Txt>
          </View>
          {/* Aggregate satisfaction from thumbs — % positive, not stars. */}
          {specialist.providerRating.display === 'score' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon name="thumbs-up" size={12} color={colors.textSecondary} />
              <Txt variant="bodySmStrong">{specialist.providerRating.positivePct}%</Txt>
              <Txt variant="caption">· {specialist.providerRating.count}</Txt>
            </View>
          ) : (
            <Txt variant="caption" color={colors.textMuted}>
              {t('spec.new')}
            </Txt>
          )}
        </View>
      </View>
    </View>
  );
}
