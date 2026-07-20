/**
 * Documents — verification status after onboarding.
 *
 * Read-mostly. The one interaction that matters is re-uploading a rejected
 * document, so rejected rows are the only ones with a prominent action and an
 * explanation of what was wrong.
 */
import { View } from 'react-native';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Icon, type FeatherName } from '@/components/ui/Icon';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LangToggle } from '@/components/ui/LangToggle';
import { usePartner } from '@/state/PartnerStateContext';
import { useI18n } from '@/i18n/I18nContext';
import { colors, radius, spacing } from '@/theme/tokens';
import { loc, type DocumentStatus } from '@/data/types';

const STATUS_META: Record<DocumentStatus, { tone: BadgeTone; icon: FeatherName; es: string; en: string }> = {
  missing: { tone: 'neutral', icon: 'upload', es: 'Falta', en: 'Missing' },
  uploaded: { tone: 'accent', icon: 'check', es: 'Subido', en: 'Uploaded' },
  in_review: { tone: 'warning', icon: 'clock', es: 'En revisión', en: 'In review' },
  approved: { tone: 'success', icon: 'check-circle', es: 'Aprobado', en: 'Approved' },
  rejected: { tone: 'danger', icon: 'x-circle', es: 'Rechazado', en: 'Rejected' },
};

export default function DocumentsStatusScreen() {
  const { t, lang } = useI18n();
  const { session } = usePartner();
  const s = session.specialist;
  if (!s) return null;

  const approved = s.documents.filter((d) => d.status === 'approved').length;

  return (
    <Screen bottomInset={spacing['3xl']}>
      <ScreenHeader back title={t('prof.documents')} right={<LangToggle />} />

      <Card style={{ marginTop: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View
          style={{
            width: 42, height: 42, borderRadius: radius.sm,
            backgroundColor: s.status === 'verified' ? colors.successTint : colors.warningTint,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Icon
            name="shield"
            size={19}
            color={s.status === 'verified' ? colors.successInk : colors.warningInk}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Txt variant="bodyStrong">
            {s.status === 'verified' ? t('prof.verified') : t('prof.pending')}
          </Txt>
          <Txt variant="caption" style={{ marginTop: 2 }}>
            {approved}/{s.documents.length}
          </Txt>
        </View>
      </Card>

      <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
        {s.documents.map((doc) => {
          const meta = STATUS_META[doc.status];
          return (
            <Card key={doc.key} style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
              <View
                style={{
                  width: 40, height: 40, borderRadius: radius.sm,
                  backgroundColor: doc.status === 'approved' ? colors.successTint : colors.surface,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Icon
                  name={meta.icon}
                  size={17}
                  color={doc.status === 'approved' ? colors.successInk : colors.textMuted}
                />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Txt variant="bodyStrong">{loc(doc.label, lang)}</Txt>
                <Txt variant="caption">{loc(doc.hint, lang)}</Txt>
                <Badge label={lang === 'es' ? meta.es : meta.en} tone={meta.tone} />
              </View>
              {doc.status === 'missing' || doc.status === 'rejected' ? (
                <Button label={t('onb.docs.upload')} variant="secondary" size="sm" block={false} />
              ) : null}
            </Card>
          );
        })}
      </View>

      <Txt variant="caption" style={{ marginTop: spacing.lg }}>
        {t('onb.docs.mockNote')}
      </Txt>
    </Screen>
  );
}
