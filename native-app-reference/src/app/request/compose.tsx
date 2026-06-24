/**
 * Request · Compose — capture references for the non-text modes (voice / photos
 * / video). These simulate capture with timers + animated waveforms; no real
 * mic/camera/upload (a production build would wire getUserMedia + R2 uploads).
 * Text mode falls back to the prompt box.
 */
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/Pressable';
import { SmartRequestBox } from '@/components/SmartRequestBox';
import { Waveform } from '@/components/Waveform';
import { useApp } from '@/state/AppStateContext';
import { useI18n } from '@/i18n/I18nContext';
import { colors, radius, spacing } from '@/theme/tokens';

type VoicePhase = 'idle' | 'recording' | 'done';

export default function ComposeScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { draft, startFromText, patchDraft } = useApp();
  const [text, setText] = useState('');
  const [voicePhase, setVoicePhase] = useState<VoicePhase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [photoCount, setPhotoCount] = useState(0);
  const [videoCaptured, setVideoCaptured] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const mode = draft.mode;

  useEffect(() => {
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  const startVoice = () => {
    setVoicePhase('recording');
    setElapsed(0);
    timer.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  };
  const stopVoice = () => {
    if (timer.current) clearInterval(timer.current);
    setVoicePhase('done');
  };

  const goBuild = () => router.replace('/request/build');

  const switchToText = () => patchDraft({ mode: 'text' });

  return (
    <Screen bottomInset={spacing.xl}>
      <ScreenHeader
        right={
          <PressableScale onPress={() => router.back()} haptic={false} style={closeBtn}>
            <Icon name="x" size={18} color={colors.text} />
          </PressableScale>
        }
      />
      <Txt variant="displayLg" style={{ marginTop: spacing.sm }}>
        {t('req.compose.title')}
      </Txt>

      {mode !== 'text' ? (
        <PressableScale onPress={switchToText} haptic={false} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.lg }}>
          <Icon name="edit-3" size={15} color={colors.accentDeep} />
          <Txt variant="bodySmStrong" color={colors.accentInk}>
            {t('req.mode.text')}
          </Txt>
        </PressableScale>
      ) : null}

      {/* TEXT */}
      {mode === 'text' ? (
        <View style={{ marginTop: spacing.lg }}>
          <SmartRequestBox
            value={text}
            onChangeText={setText}
            placeholder={t('home.inputPlaceholder')}
            autoFocus
            onSubmit={() => {
              if (!text.trim()) return;
              startFromText(text.trim(), 'text');
              goBuild();
            }}
          />
        </View>
      ) : null}

      {/* VOICE */}
      {mode === 'voice' ? (
        <Animated.View entering={FadeIn} style={[panel, { marginTop: spacing.xl }]}>
          <PressableScale
            onPress={voicePhase === 'recording' ? stopVoice : voicePhase === 'idle' ? startVoice : undefined}
            scaleTo={0.92}
            style={{
              width: 84,
              height: 84,
              borderRadius: 42,
              backgroundColor: voicePhase === 'recording' ? colors.accent : colors.ink,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name={voicePhase === 'recording' ? 'square' : 'mic'} size={30} color={voicePhase === 'recording' ? colors.accentInk : colors.textInverse} />
          </PressableScale>
          <Waveform active={voicePhase === 'recording'} />
          {voicePhase === 'recording' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger }} />
              <Txt variant="bodyStrong">{`0:${String(elapsed).padStart(2, '0')} / 1:00`}</Txt>
            </View>
          ) : voicePhase === 'done' ? (
            <Txt variant="caption" center>
              {t('req.voice.note')}
            </Txt>
          ) : (
            <Txt variant="caption" center>
              {t('req.voice.hint')}
            </Txt>
          )}
          {voicePhase === 'done' ? (
            <View style={{ flexDirection: 'row', gap: spacing.md, width: '100%' }}>
              <Button label={t('req.voice.rerecord')} variant="secondary" size="md" onPress={() => setVoicePhase('idle')} style={{ flex: 1 }} />
              <Button label={t('req.voice.use')} size="md" onPress={goBuild} style={{ flex: 1 }} />
            </View>
          ) : null}
        </Animated.View>
      ) : null}

      {/* PHOTOS */}
      {mode === 'photos' ? (
        <Animated.View entering={FadeIn} style={[panel, { marginTop: spacing.xl }]}>
          <View style={iconBox}>
            <Icon name="camera" size={24} color={colors.accentInk} />
          </View>
          {photoCount === 0 ? (
            <>
              <Txt variant="bodyStrong" center>
                {t('req.photo.empty')}
              </Txt>
              <Txt variant="caption" center>
                {t('req.photo.note')}
              </Txt>
              <View style={{ flexDirection: 'row', gap: spacing.md, width: '100%' }}>
                <Button label={t('req.photo.choose')} variant="secondary" size="md" icon="image" onPress={() => setPhotoCount(2)} style={{ flex: 1 }} />
                <Button label={t('req.photo.sample')} size="md" onPress={() => setPhotoCount(1)} style={{ flex: 1 }} />
              </View>
            </>
          ) : (
            <>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {Array.from({ length: photoCount }).map((_, i) => (
                  <View key={i} style={{ width: 76, height: 76, borderRadius: radius.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="image" size={22} color={colors.textMuted} />
                  </View>
                ))}
                {photoCount < 5 ? (
                  <PressableScale onPress={() => setPhotoCount((c) => c + 1)} style={{ width: 76, height: 76, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.borderInput, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="plus" size={20} color={colors.textMuted} />
                  </PressableScale>
                ) : null}
              </View>
              <Button label={`${t('common.continue')} · ${photoCount}`} icon="arrow-right" onPress={goBuild} />
            </>
          )}
        </Animated.View>
      ) : null}

      {/* VIDEO */}
      {mode === 'video' ? (
        <Animated.View entering={FadeIn} style={[panel, { marginTop: spacing.xl }]}>
          <View style={iconBox}>
            <Icon name="video" size={24} color={colors.accentInk} />
          </View>
          {!videoCaptured ? (
            <>
              <Txt variant="bodyStrong" center>
                {t('req.video.empty')}
              </Txt>
              <Txt variant="caption" center>
                {t('req.video.note')}
              </Txt>
              <View style={{ flexDirection: 'row', gap: spacing.md, width: '100%' }}>
                <Button label={t('req.video.upload')} variant="secondary" size="md" icon="upload" onPress={() => setVideoCaptured(true)} style={{ flex: 1 }} />
                <Button label={t('req.video.record')} size="md" icon="video" onPress={() => setVideoCaptured(true)} style={{ flex: 1 }} />
              </View>
            </>
          ) : (
            <>
              <View style={{ width: 76, height: 76, borderRadius: radius.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="film" size={24} color={colors.textMuted} />
              </View>
              <Button label={t('common.continue')} icon="arrow-right" onPress={goBuild} />
            </>
          )}
        </Animated.View>
      ) : null}
    </Screen>
  );
}

const closeBtn = {
  width: 40,
  height: 40,
  borderRadius: 20,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  backgroundColor: colors.surface,
};

const panel = {
  alignItems: 'center' as const,
  gap: spacing.lg,
  backgroundColor: colors.bgElevated,
  borderRadius: radius.xl,
  borderWidth: 1,
  borderColor: colors.border,
  padding: spacing.xl,
};

const iconBox = {
  width: 52,
  height: 52,
  borderRadius: radius.md,
  backgroundColor: colors.accentTint,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};
