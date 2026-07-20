/**
 * Job completion — the last thing a specialist touches on site.
 *
 * Completion is a payment-triggering event (it's what lets SERVI capture the
 * client's hold), so it gets a deliberate confirmation rather than being the
 * fourth tap in the stepper. Two things are collected on the way:
 *
 *   • Evidence photos — framed as protection FOR the specialist, not as
 *     surveillance of them. That framing is the difference between people
 *     using it and people resenting it.
 *   • A private rating of the client — the reciprocity that makes a two-sided
 *     marketplace feel two-sided.
 *
 * Fires `POST /api/provider/checkin { event: 'completed' }`.
 */
import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Text';
import { Card, Divider } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Input, Field } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { MessageState } from '@/components/ui/States';
import { PressableScale } from '@/components/ui/Pressable';
import { usePartner } from '@/state/PartnerStateContext';
import { useI18n } from '@/i18n/I18nContext';
import { colors, radius, spacing } from '@/theme/tokens';
import { money } from '@/theme/partner';
import { dateLabel, nextPayoutDate } from '@/data/time';

export default function CompleteJobScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang } = useI18n();
  const router = useRouter();
  const { getJob, checkIn } = usePartner();

  const [photos, setPhotos] = useState(0);
  const [notes, setNotes] = useState('');
  const [rating, setRating] = useState(0);
  const [done, setDone] = useState(false);

  const job = getJob(String(id));
  if (!job) {
    return (
      <Screen>
        <ScreenHeader back title={t('done.title')} />
        <MessageState icon="alert-circle" title="404" tone="danger" />
      </Screen>
    );
  }

  const extras = job.priceChanges
    .filter((pc) => pc.status === 'approved' || pc.status === 'paid')
    .reduce((s, pc) => s + pc.providerAmountCents, 0);
  const total = job.payoutCents + extras;

  if (done) {
    return (
      <Screen>
        <ScreenHeader back title={t('done.title')} />
        <View style={{ flex: 1, justifyContent: 'center', gap: spacing.xl }}>
          <MessageState
            icon="check-circle"
            title={t('done.finished')}
            body={t('done.finishedBody', { amount: money(total) })}
          />
          <Card style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Txt variant="bodySm">{t('earn.nextPayout')}</Txt>
              <Txt variant="bodySmStrong">{dateLabel(nextPayoutDate(), lang)}</Txt>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Txt variant="bodySm">{t('offer.youEarn')}</Txt>
              <Txt variant="headingSm">{money(total)}</Txt>
            </View>
          </Card>
          <Button label={t('common.done')} onPress={() => router.dismissAll()} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen bottomInset={spacing['3xl']}>
      <ScreenHeader back title={t('done.title')} />

      <Txt variant="body" style={{ marginTop: spacing.lg }}>
        {t('done.subtitle')}
      </Txt>

      {/* Evidence */}
      <Card style={{ marginTop: spacing.xl, gap: spacing.md }}>
        <Txt variant="headingSm">{t('done.photos')}</Txt>
        <Txt variant="bodySm">{t('done.photosHint')}</Txt>
        <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
          {Array.from({ length: photos }).map((_, i) => (
            <View
              key={i}
              style={{
                width: 72, height: 72, borderRadius: radius.sm,
                backgroundColor: colors.accentTint,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Icon name="image" size={20} color={colors.accentInk} />
            </View>
          ))}
          <PressableScale
            onPress={() => setPhotos((n) => Math.min(6, n + 1))}
            scaleTo={0.94}
            style={{
              width: 72, height: 72, borderRadius: radius.sm,
              borderWidth: 1.5, borderColor: colors.borderInput, borderStyle: 'dashed',
              alignItems: 'center', justifyContent: 'center', gap: 3,
            }}
          >
            <Icon name="plus" size={18} color={colors.textMuted} />
            <Txt variant="caption" style={{ fontSize: 10 }}>
              {t('done.addPhoto')}
            </Txt>
          </PressableScale>
        </View>
      </Card>

      {/* Notes */}
      <View style={{ marginTop: spacing.lg }}>
        <Field label={t('done.notes')}>
          <Input
            value={notes}
            onChangeText={setNotes}
            placeholder={t('done.notesPlaceholder')}
            multiline
            numberOfLines={3}
            style={{ minHeight: 80, textAlignVertical: 'top' }}
            containerStyle={{ alignItems: 'flex-start', paddingTop: 4 }}
          />
        </Field>
      </View>

      {/* Rate the client */}
      <Card style={{ marginTop: spacing.lg, gap: spacing.md }}>
        <Txt variant="headingSm">{t('done.rate')}</Txt>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <PressableScale key={n} onPress={() => setRating(n)} scaleTo={0.88}>
              <Icon
                name="star"
                size={30}
                color={n <= rating ? colors.warning : colors.borderStrong}
              />
            </PressableScale>
          ))}
        </View>
        <Txt variant="caption">{t('done.rateHint')}</Txt>
      </Card>

      {/* Payment summary + confirm */}
      <Card style={{ marginTop: spacing.lg, gap: spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Txt variant="bodyStrong">{t('offer.youEarn')}</Txt>
          <Txt variant="displayLg">{money(total)}</Txt>
        </View>
        {extras > 0 ? (
          <>
            <Divider />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Txt variant="bodySm">{t('pc.title')}</Txt>
              <Txt variant="bodySmStrong" color={colors.successInk}>
                +{money(extras)}
              </Txt>
            </View>
          </>
        ) : null}
      </Card>

      <View style={{ marginTop: spacing.xl }}>
        <Button
          label={t('done.finish')}
          icon="check-circle"
          onPress={() => {
            checkIn(job.id, 'completed');
            setDone(true);
          }}
        />
      </View>
    </Screen>
  );
}
