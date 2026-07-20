/**
 * Step 6 — review and submit.
 *
 * Every section is editable in place (tap → jump back to that step), because
 * discovering a typo in your CLABE on the confirmation screen and having no way
 * to fix it without restarting is a genuinely infuriating pattern.
 */
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Text';
import { Card, Divider } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/Pressable';
import { StepHeader } from '@/components/StepHeader';
import { usePartner } from '@/state/PartnerStateContext';
import { useI18n } from '@/i18n/I18nContext';
import { DOCUMENTS, TRADES } from '@/data/catalog';
import { colors, radius, spacing } from '@/theme/tokens';
import { loc } from '@/data/types';

export default function ReviewScreen() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const { onboarding, patchOnboarding, submitApplication } = usePartner();

  const trades = TRADES.filter((tr) => onboarding.tradeKeys.includes(tr.key));
  const docsDone = DOCUMENTS.filter((d) => onboarding.documents[d.key] !== 'missing').length;
  const clabe = onboarding.clabe.replace(/\D/g, '');

  return (
    <Screen bottomInset={spacing['3xl']}>
      <StepHeader step={6} title={t('onb.review.title')} />

      <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
        <Section
          icon="user"
          title={t('onb.identity.title')}
          lines={[
            `${onboarding.firstName} ${onboarding.lastName}`.trim(),
            onboarding.phone,
            onboarding.email || '—',
            onboarding.city,
          ]}
          onEdit={() => router.push('/onboarding/identity')}
          editLabel={t('common.edit')}
        />

        <Section
          icon="tool"
          title={t('onb.services.title')}
          lines={[
            trades.map((tr) => loc(tr.label, lang)).join(', ') || '—',
            onboarding.skillKeys.join(' · ') || '—',
          ]}
          onEdit={() => router.push('/onboarding/services')}
          editLabel={t('common.edit')}
        />

        <Section
          icon="map-pin"
          title={t('onb.coverage.title')}
          lines={[
            onboarding.zones.join(', ') || '—',
            `${onboarding.radiusKm} km`,
            onboarding.acceptsAsap ? t('onb.coverage.asap') : '—',
          ]}
          onEdit={() => router.push('/onboarding/coverage')}
          editLabel={t('common.edit')}
        />

        <Section
          icon="shield"
          title={t('onb.docs.title')}
          lines={[`${docsDone}/${DOCUMENTS.length}`]}
          onEdit={() => router.push('/onboarding/documents')}
          editLabel={t('common.edit')}
        />

        <Section
          icon="credit-card"
          title={t('onb.payout.title')}
          lines={[
            onboarding.bankHolder || '—',
            clabe ? `CLABE ••••${clabe.slice(-4)}` : '—',
            onboarding.rfc || `${t('onb.payout.rfc')}: —`,
          ]}
          onEdit={() => router.push('/onboarding/payout')}
          editLabel={t('common.edit')}
        />
      </View>

      {/* Terms */}
      <PressableScale
        onPress={() => patchOnboarding({ acceptedTerms: !onboarding.acceptedTerms })}
        scaleTo={0.99}
        style={{
          flexDirection: 'row',
          gap: spacing.md,
          alignItems: 'center',
          marginTop: spacing.xl,
          padding: spacing.lg,
          borderRadius: radius.md,
          borderWidth: 1.5,
          borderColor: onboarding.acceptedTerms ? colors.accentDeep : colors.borderInput,
          backgroundColor: onboarding.acceptedTerms ? colors.accentTint : colors.bgElevated,
        }}
      >
        <View
          style={{
            width: 24, height: 24, borderRadius: 7,
            borderWidth: 2,
            borderColor: onboarding.acceptedTerms ? colors.accentDeep : colors.borderInput,
            backgroundColor: onboarding.acceptedTerms ? colors.accentDeep : 'transparent',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          {onboarding.acceptedTerms ? (
            <Icon name="check" size={14} color={colors.textInverse} />
          ) : null}
        </View>
        <Txt
          variant="bodySm"
          color={onboarding.acceptedTerms ? colors.accentInk : colors.text}
          style={{ flex: 1 }}
        >
          {t('onb.review.terms')}
        </Txt>
      </PressableScale>

      <View style={{ marginTop: spacing.xl }}>
        <Button
          label={t('onb.review.submit')}
          disabled={!onboarding.acceptedTerms}
          onPress={() => {
            submitApplication();
            router.replace('/onboarding/submitted');
          }}
        />
      </View>
    </Screen>
  );
}

function Section({
  icon,
  title,
  lines,
  onEdit,
  editLabel,
}: {
  icon: 'user' | 'tool' | 'map-pin' | 'shield' | 'credit-card';
  title: string;
  lines: string[];
  onEdit: () => void;
  editLabel: string;
}) {
  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Icon name={icon} size={17} color={colors.textMuted} />
        <Txt variant="bodyStrong" style={{ flex: 1 }}>
          {title}
        </Txt>
        <Button label={editLabel} variant="ghost" size="sm" block={false} onPress={onEdit} />
      </View>
      <Divider />
      <View style={{ gap: 3 }}>
        {lines.filter(Boolean).map((l, i) => (
          <Txt key={i} variant="bodySm">
            {l}
          </Txt>
        ))}
      </View>
    </Card>
  );
}
