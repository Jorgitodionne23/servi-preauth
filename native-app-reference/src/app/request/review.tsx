/**
 * Request · Review — final confirmation. Summary + "what happens next" + an
 * ACCURATE payment/pre-authorization reference (card hold not charge, payment
 * link, saved-card consent, auto pre-auth ~24h, 5-day rule, visits). A preview
 * toggle lets you see each pre-auth path. NO Stripe — explanation only.
 */
import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Text';
import { Icon, type FeatherName } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Card, Surface, Divider } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { InfoCard } from '@/components/ui/InfoCard';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Chip } from '@/components/ui/Chip';
import { categoryByKey } from '@/data/catalog';
import { computePaymentPlan } from '@/data/paymentModel';
import { loc } from '@/data/types';
import { useApp } from '@/state/AppStateContext';
import { useI18n } from '@/i18n/I18nContext';
import { colors, spacing } from '@/theme/tokens';
import type { StringKey } from '@/i18n/strings';

const CONCEPT: Record<string, { icon: FeatherName; title: StringKey; body: StringKey }> = {
  hold: { icon: 'credit-card', title: 'pay.hold.title', body: 'pay.hold.body' },
  link: { icon: 'link', title: 'pay.link.title', body: 'pay.link.body' },
  saved: { icon: 'shield', title: 'pay.saved.title', body: 'pay.saved.body' },
  auto: { icon: 'clock', title: 'pay.auto.title', body: 'pay.auto.body' },
  fiveday: { icon: 'calendar', title: 'pay.fiveday.title', body: 'pay.fiveday.body' },
  visit: { icon: 'eye', title: 'pay.visit.title', body: 'pay.visit.body' },
};

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.md }}>
      <Txt variant="caption" style={{ width: 84 }}>
        {label}
      </Txt>
      <Txt variant="bodySmStrong" style={{ flex: 1 }}>
        {value}
      </Txt>
    </View>
  );
}

export default function ReviewScreen() {
  const router = useRouter();
  const { t, lang } = useI18n();
  const { draft, addresses, session, submitRequest, resetDraft } = useApp();

  const hasRealCard = !!session.user?.card?.consentOnFile;
  const [cardPreview, setCardPreview] = useState<'saved' | 'none'>(hasRealCard ? 'saved' : 'none');
  const [isVisit, setIsVisit] = useState(false);

  const cat = draft.categoryKey ? categoryByKey[draft.categoryKey] : null;
  const addr = addresses.find((a) => a.id === draft.addressId);
  const whereText = addr ? `${addr.label} · ${addr.line1}` : draft.addressText || '—';
  const whenText =
    draft.urgency === 'asap' ? t('req.when.asap') : `${draft.date ?? ''} · ${draft.time ?? ''}`.trim();
  const answers = Object.values(draft.answers).filter(Boolean);

  const plan = computePaymentPlan({
    hasSavedCardWithConsent: cardPreview === 'saved',
    leadDays: draft.leadDays,
    isAsap: draft.urgency === 'asap',
    isVisit,
  });

  const submit = () => {
    const id = submitRequest();
    resetDraft();
    router.replace(`/request/submitted?id=${id}`);
  };

  return (
    <Screen bottomInset={150}>
      <ScreenHeader back />
      <Txt variant="displayLg" style={{ marginTop: spacing.sm }}>
        {t('req.review.title')}
      </Txt>

      {/* Summary */}
      <Surface style={{ marginTop: spacing.xl, gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name={cat?.icon ?? 'grid'} size={18} color={colors.accentDeep} />
          <Txt variant="bodyStrong">{t('req.review.summary')}</Txt>
        </View>
        <Divider />
        <SummaryRow label={t('req.review.service')} value={loc(draft.service, lang) || '—'} />
        {cat ? <SummaryRow label={t('req.review.category')} value={loc(cat.label, lang)} /> : null}
        {answers.length ? <SummaryRow label={t('req.review.details')} value={answers.join(' · ')} /> : null}
        <SummaryRow label={t('req.review.when')} value={whenText} />
        <SummaryRow label={t('req.review.where')} value={whereText} />
      </Surface>

      {/* What happens next */}
      <Card style={{ marginTop: spacing.lg, gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Txt variant="headingSm">{t('req.review.next.title')}</Txt>
          <Badge label={t('req.review.next.eta')} tone="accent" icon="clock" />
        </View>
        {[
          { icon: 'users' as FeatherName, label: t('req.review.next.step1') },
          { icon: 'tag' as FeatherName, label: t('req.review.next.step2') },
          { icon: 'message-circle' as FeatherName, label: t('req.review.next.step3') },
        ].map((s, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Txt variant="bodySmStrong">{i + 1}</Txt>
            </View>
            <Icon name={s.icon} size={16} color={colors.textMuted} />
            <Txt variant="bodySm" color={colors.text} style={{ flex: 1 }}>
              {s.label}
            </Txt>
          </View>
        ))}
      </Card>

      {/* Payment / pre-auth reference */}
      <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Txt variant="headingSm">{t('pay.title')}</Txt>
          <Badge label={t('pay.refDisclaimer')} tone="warning" icon="info" />
        </View>

        <SegmentedControl
          segments={[
            { key: 'saved', label: t('pay.savedCard') },
            { key: 'none', label: t('pay.noCard') },
          ]}
          value={cardPreview}
          onChange={(k) => setCardPreview(k as 'saved' | 'none')}
        />

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' }}>
          <Txt variant="caption">{lang === 'es' ? 'Previsualizar:' : 'Preview:'}</Txt>
          <Chip
            label={lang === 'es' ? 'Visita de cotización' : 'Quote visit'}
            icon="eye"
            active={isVisit}
            onPress={() => setIsVisit((v) => !v)}
          />
        </View>

        <Card style={{ gap: spacing.lg }}>
          {plan.kind === 'needs_saved_card' ? (
            <View style={{ gap: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon name="lock" size={18} color={colors.danger} />
                <Txt variant="bodyStrong" color={colors.danger}>
                  {t('status.blocked')}
                </Txt>
              </View>
              {plan.conceptKeys.map((k) => (
                <InfoCard key={k} icon={CONCEPT[k].icon} title={t(CONCEPT[k].title)} body={t(CONCEPT[k].body)} />
              ))}
            </View>
          ) : (
            plan.conceptKeys.map((k, i) => (
              <InfoCard key={k} icon={CONCEPT[k].icon} title={t(CONCEPT[k].title)} body={t(CONCEPT[k].body)} tone={i === 0 ? 'accent' : 'neutral'} />
            ))
          )}
          <Divider />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="info" size={14} color={colors.accentDeep} />
            <Txt variant="bodySmStrong" color={colors.accentInk} onPress={() => router.push('/payment-info')}>
              {t('pay.title')}
            </Txt>
          </View>
        </Card>
      </View>

      {/* Send */}
      <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
        <Button label={t('req.review.send')} icon="send" onPress={submit} />
        <Txt variant="caption" center style={{ paddingHorizontal: spacing.lg }}>
          {t('req.review.fineprint')}
        </Txt>
      </View>
    </Screen>
  );
}
