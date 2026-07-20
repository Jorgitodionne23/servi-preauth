/**
 * Step 4 — verification documents.
 *
 * Framing matters more than the UI here. Asking a tradesperson for their INE,
 * a selfie and a utility bill is invasive; it's justified by exactly one thing,
 * stated at the top: clients let you into their home. Leading with the reason
 * rather than the requirement is why people finish this step.
 *
 * Uploads are simulated — no camera, no picker, no R2. Tapping cycles the row
 * into `uploaded`, which is enough to evaluate the flow and the states.
 */
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Icon, type FeatherName } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { StepHeader } from '@/components/StepHeader';
import { usePartner } from '@/state/PartnerStateContext';
import { useI18n } from '@/i18n/I18nContext';
import { DOCUMENTS } from '@/data/catalog';
import { colors, radius, spacing } from '@/theme/tokens';
import { loc, type DocumentStatus } from '@/data/types';

const STATUS_META: Record<DocumentStatus, { tone: BadgeTone; icon: FeatherName; es: string; en: string }> = {
  missing: { tone: 'neutral', icon: 'upload', es: 'Falta', en: 'Missing' },
  uploaded: { tone: 'accent', icon: 'check', es: 'Subido', en: 'Uploaded' },
  in_review: { tone: 'warning', icon: 'clock', es: 'En revisión', en: 'In review' },
  approved: { tone: 'success', icon: 'check-circle', es: 'Aprobado', en: 'Approved' },
  rejected: { tone: 'danger', icon: 'x-circle', es: 'Rechazado', en: 'Rejected' },
};

export default function DocumentsScreen() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const { onboarding, setDocument } = usePartner();

  const requiredDone = DOCUMENTS.filter((d) => d.required).every(
    (d) => onboarding.documents[d.key] !== 'missing',
  );

  return (
    <Screen bottomInset={spacing['3xl']}>
      <StepHeader step={4} title={t('onb.docs.title')} subtitle={t('onb.docs.subtitle')} />

      <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
        {DOCUMENTS.map((doc) => {
          const status = onboarding.documents[doc.key];
          const meta = STATUS_META[status];
          return (
            <Card key={doc.key} style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
              <View
                style={{
                  width: 42, height: 42, borderRadius: radius.sm,
                  backgroundColor: status === 'missing' ? colors.surface : colors.accentTint,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Icon
                  name={meta.icon}
                  size={18}
                  color={status === 'missing' ? colors.textMuted : colors.accentInk}
                />
              </View>

              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Txt variant="bodyStrong">{loc(doc.label, lang)}</Txt>
                  {!doc.required ? (
                    <Txt variant="caption">· {t('common.optional')}</Txt>
                  ) : null}
                </View>
                <Txt variant="caption" style={{ marginTop: 2 }}>
                  {loc(doc.hint, lang)}
                </Txt>
                {status !== 'missing' ? (
                  <View style={{ marginTop: 6 }}>
                    <Badge label={lang === 'es' ? meta.es : meta.en} tone={meta.tone} />
                  </View>
                ) : null}
              </View>

              <Button
                label={status === 'missing' ? t('onb.docs.upload') : t('onb.docs.replace')}
                variant="secondary"
                size="sm"
                block={false}
                onPress={() => setDocument(doc.key, 'uploaded')}
              />
            </Card>
          );
        })}
      </View>

      <Txt variant="caption" style={{ marginTop: spacing.lg }}>
        {t('onb.docs.mockNote')}
      </Txt>

      <View style={{ marginTop: spacing.xl }}>
        <Button
          label={t('common.continue')}
          disabled={!requiredDone}
          iconRight="arrow-right"
          onPress={() => router.push('/onboarding/payout')}
        />
      </View>
    </Screen>
  );
}
