/**
 * Request · Build — "Here's what I understood": the inferred service + match
 * confidence, optional follow-up chips, and the when/where step. Video requests
 * show a "video received" card instead (admin review, no follow-ups).
 */
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Chip } from '@/components/ui/Chip';
import { RadioRow } from '@/components/ui/Rows';
import { Input } from '@/components/ui/Input';
import { LoadingBlock, Skeleton, MessageState } from '@/components/ui/States';
import { ServicePicker } from '@/components/ServicePicker';
import { categoryByKey } from '@/data/catalog';
import { loc } from '@/data/types';
import { useApp } from '@/state/AppStateContext';
import { useI18n } from '@/i18n/I18nContext';
import { colors, radius, spacing } from '@/theme/tokens';

const DATE_OPTS: { es: string; en: string; days: number }[] = [
  { es: 'Hoy', en: 'Today', days: 0 },
  { es: 'Mañana', en: 'Tomorrow', days: 1 },
  { es: 'En 3 días', en: 'In 3 days', days: 3 },
  { es: 'En 5 días', en: 'In 5 days', days: 5 },
  { es: 'En 1 semana', en: 'In 1 week', days: 7 },
];
const TIME_OPTS = ['09:00', '12:00', '15:00', '18:00'];

export default function BuildScreen() {
  const router = useRouter();
  const { t, lang } = useI18n();
  const { draft, patchDraft, setAnswer, forceError, toggleForceError } = useApp();
  const [thinking, setThinking] = useState(!draft.adminReview);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (!thinking) return;
    const id = setTimeout(() => setThinking(false), 900);
    return () => clearTimeout(id);
  }, [thinking]);

  // Reachable error state (brief requirement): the demo "force error" toggle
  // makes the mocked parse "fail" so the retry path is exercisable.
  const showError = !thinking && forceError && !draft.adminReview;
  const retry = () => {
    if (forceError) toggleForceError();
    setThinking(true);
  };

  const cat = draft.categoryKey ? categoryByKey[draft.categoryKey] : null;
  const matchPct = Math.round(draft.confidence * 100);
  const canContinue =
    draft.urgency === 'asap' || (draft.urgency === 'schedule' && !!draft.date && !!draft.time);

  const thinkingLabel =
    draft.mode === 'voice' ? t('req.thinking.voice') : draft.mode === 'photos' ? t('req.thinking.photo') : t('req.thinking.text');

  return (
    <Screen bottomInset={120}>
      <ScreenHeader back />

      {thinking ? (
        <View style={{ marginTop: spacing.xl, gap: spacing.lg }}>
          <LoadingBlock label={thinkingLabel} />
          <Skeleton height={20} width="70%" />
          <Skeleton height={14} width="90%" />
          <Skeleton height={14} width="55%" />
        </View>
      ) : showError ? (
        <View style={{ marginTop: spacing.xl }}>
          <MessageState
            icon="alert-circle"
            tone="danger"
            title={t('state.errorTitle')}
            body={t('state.errorBody')}
            cta={t('common.retry')}
            onCta={retry}
          />
        </View>
      ) : (
        <Animated.View entering={FadeInDown.duration(420)} style={{ marginTop: spacing.md, gap: spacing.lg }}>
          {draft.adminReview ? (
            // ── Video received ──
            <Card>
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <View style={{ width: 48, height: 48, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.accentDeep, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="video" size={22} color={colors.accentDeep} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt variant="eyebrow" color={colors.accentInk}>
                    {t('req.videoReceived.eyebrow')}
                  </Txt>
                  <Txt variant="headingSm" style={{ marginTop: 4 }}>
                    {t('req.videoReceived.title')}
                  </Txt>
                  <Txt variant="bodySm" style={{ marginTop: 6 }}>
                    {t('req.videoReceived.body')}
                  </Txt>
                </View>
              </View>
            </Card>
          ) : (
            // ── Understanding card ──
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md }}>
                <View style={{ width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.accentTint, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={cat?.icon ?? 'grid'} size={22} color={colors.accentInk} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Txt variant="eyebrow">{t('req.understand.eyebrow')}</Txt>
                    <Badge label={`${matchPct}% ${t('req.understand.match')}`} tone={draft.confidence >= 0.7 ? 'accent' : 'warning'} />
                  </View>
                  <Txt variant="headingSm" style={{ marginTop: 4 }}>
                    {loc(draft.service, lang)}
                  </Txt>
                  <Txt variant="caption" style={{ marginTop: 2 }}>
                    {cat ? loc(cat.label, lang) : ''}
                  </Txt>
                </View>
              </View>
              {draft.summary ? (
                <Txt variant="bodySm" style={{ fontStyle: 'italic' }}>
                  {loc(draft.summary, lang)}
                </Txt>
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md }}>
                <Icon name="refresh-cw" size={14} color={colors.accentDeep} />
                <Txt variant="bodySmStrong" color={colors.accentInk} onPress={() => setPickerOpen(true)}>
                  {t('req.understand.change')}
                </Txt>
              </View>
            </Card>
          )}

          {/* Follow-ups (text/manual only) */}
          {!draft.adminReview && draft.followups.length > 0 ? (
            <View style={{ gap: spacing.md }}>
              <View>
                <Txt variant="headingSm">{t('req.followups.title')}</Txt>
                <Txt variant="caption" style={{ marginTop: 2 }}>
                  {t('req.followups.sub')}
                </Txt>
              </View>
              {draft.followups.map((f) => (
                <View key={f.key} style={{ gap: spacing.sm }}>
                  <Txt variant="bodySmStrong">{loc(f.q, lang)}</Txt>
                  {f.chips && f.chips.length > 0 ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                      {f.chips.map((chip) => {
                        const label = loc(chip, lang);
                        return <Chip key={label} label={label} active={draft.answers[f.key] === label} onPress={() => setAnswer(f.key, label)} />;
                      })}
                    </View>
                  ) : (
                    <Input placeholder={t('common.optional')} value={draft.answers[f.key] ?? ''} onChangeText={(v) => patchDraft({ answers: { ...draft.answers, [f.key]: v } })} />
                  )}
                </View>
              ))}
            </View>
          ) : null}

          {/* When & where */}
          <View style={{ gap: spacing.md }}>
            <Txt variant="headingSm">{t('req.when.title')}</Txt>
            <RadioRow
              selected={draft.urgency === 'asap'}
              onPress={() => patchDraft({ urgency: 'asap', date: null, time: null, leadDays: 0 })}
              icon="zap"
              title={t('req.when.asap')}
            />
            <RadioRow
              selected={draft.urgency === 'schedule'}
              onPress={() => patchDraft({ urgency: 'schedule' })}
              icon="calendar"
              title={t('req.when.schedule')}
            />
            {draft.urgency === 'schedule' ? (
              <Animated.View entering={FadeInDown.duration(260)} style={{ gap: spacing.md }}>
                <View>
                  <Txt variant="caption" style={{ marginBottom: spacing.sm }}>
                    {t('req.when.date')}
                  </Txt>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                    {DATE_OPTS.map((d) => {
                      const label = loc(d, lang);
                      return <Chip key={d.days} label={label} active={draft.date === label} onPress={() => patchDraft({ date: label, leadDays: d.days })} />;
                    })}
                  </View>
                </View>
                <View>
                  <Txt variant="caption" style={{ marginBottom: spacing.sm }}>
                    {t('req.when.time')}
                  </Txt>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                    {TIME_OPTS.map((tm) => (
                      <Chip key={tm} label={tm} active={draft.time === tm} onPress={() => patchDraft({ time: tm })} />
                    ))}
                  </View>
                </View>
              </Animated.View>
            ) : null}
          </View>

          <Button label={t('common.next')} icon="arrow-right" disabled={!canContinue} onPress={() => router.push('/request/address')} />
        </Animated.View>
      )}

      <ServicePicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(categoryKey, sub) => {
          patchDraft({
            categoryKey: categoryKey as typeof draft.categoryKey,
            subKey: sub.key,
            service: { es: sub.services.es[0], en: sub.services.en[0] },
            summary: sub.label,
            confidence: 1,
            followups: sub.followups,
            answers: {},
          });
          setPickerOpen(false);
        }}
      />
    </Screen>
  );
}
