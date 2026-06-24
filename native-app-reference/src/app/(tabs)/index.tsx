/**
 * HOME — Smart Request entry. The first screen is usable product UI:
 * "Describe, show, or say what you need" + category shortcuts + active order
 * dock. Not a marketing page.
 */
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Text';
import { Icon, type FeatherName } from '@/components/ui/Icon';
import { ServiLogo } from '@/components/ui/ServiLogo';
import { LangToggle, Avatar } from '@/components/ui/LangToggle';
import { PressableScale } from '@/components/ui/Pressable';
import { SmartRequestBox } from '@/components/SmartRequestBox';
import { CategoryShortcut } from '@/components/CategoryCard';
import { ActiveOrderDock } from '@/components/ActiveOrderDock';
import { catalog, findSub } from '@/data/catalog';
import { loc } from '@/data/types';
import { useApp } from '@/state/AppStateContext';
import { useI18n } from '@/i18n/I18nContext';
import { colors, radius, spacing } from '@/theme/tokens';

const POPULAR: { cat: string; sub: string }[] = [
  { cat: 'repair', sub: 'plumbing' },
  { cat: 'cleaning', sub: 'home-cleaning' },
  { cat: 'repair', sub: 'electrical' },
  { cat: 'wellness', sub: 'massage' },
];

function ModeTile({ icon, label, sub, onPress }: { icon: FeatherName; label: string; sub: string; onPress: () => void }) {
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.96}
      style={{
        flex: 1,
        backgroundColor: colors.bgElevated,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.md,
        alignItems: 'center',
        gap: 8,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: radius.md,
          backgroundColor: colors.accentTint,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={19} color={colors.accentInk} />
      </View>
      <Txt variant="bodySmStrong" center>
        {label}
      </Txt>
      <Txt variant="caption" center numberOfLines={1}>
        {sub}
      </Txt>
    </PressableScale>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, lang } = useI18n();
  const { session, activeOrder, startFromText, startInMode, startFromService } = useApp();
  const [text, setText] = useState('');

  const user = session.user;

  const submitText = () => {
    const value = text.trim();
    if (!value) return;
    startFromText(value, 'text');
    setText('');
    router.push('/request/build');
  };

  const openMode = (mode: 'voice' | 'photos' | 'video') => {
    startInMode(mode);
    router.push('/request/compose');
  };

  const openPopular = (catKey: string, subKey: string) => {
    const sub = findSub(catKey, subKey);
    if (!sub) return;
    startFromService(catKey, subKey, sub.services.es[0], sub.services.en[0]);
    router.push('/request/build');
  };

  return (
    <Screen bottomInset={insets.bottom + 96}>
      {/* Top bar */}
      <View
        style={{
          paddingTop: insets.top + spacing.sm,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View>
          <Txt variant="caption">{t('home.greeting')}{user ? ',' : ''}</Txt>
          <View style={{ marginTop: 2 }}>
            {user ? <Txt variant="headingMd">{user.firstName}</Txt> : <ServiLogo size={24} />}
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <LangToggle />
          <Avatar initials={user ? user.firstName[0] + user.lastName[0] : 'SE'} onPress={() => router.push('/(tabs)/account')} />
        </View>
      </View>

      {/* Smart Request hero */}
      <Animated.View entering={FadeInDown.duration(420)} style={{ marginTop: spacing.xl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: spacing.md }}>
          <Icon name="zap" size={15} color={colors.accentDeep} />
          <Txt variant="eyebrow" color={colors.accentInk}>
            {t('home.eyebrow')}
          </Txt>
        </View>
        <Txt variant="displayXl">{t('home.title')}</Txt>
        <Txt variant="body" style={{ marginTop: spacing.sm }}>
          {t('home.subtitle')}
        </Txt>

        <View style={{ marginTop: spacing.lg }}>
          <SmartRequestBox
            value={text}
            onChangeText={setText}
            onSubmit={submitText}
            placeholder={t('home.inputPlaceholder')}
          />
        </View>

        <Txt variant="caption" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
          {t('home.orRequestAnother')}
        </Txt>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <ModeTile icon="mic" label={t('home.mode.voice')} sub={t('home.mode.voiceSub')} onPress={() => openMode('voice')} />
          <ModeTile icon="camera" label={t('home.mode.photo')} sub={t('home.mode.photoSub')} onPress={() => openMode('photos')} />
          <ModeTile icon="video" label={t('home.mode.video')} sub={t('home.mode.videoSub')} onPress={() => openMode('video')} />
        </View>
      </Animated.View>

      {/* Active order dock */}
      {activeOrder ? (
        <Animated.View entering={FadeInDown.duration(420).delay(80)} style={{ marginTop: spacing.xl }}>
          <ActiveOrderDock order={activeOrder} />
        </Animated.View>
      ) : null}

      {/* Category shortcuts */}
      <View style={{ marginTop: spacing['2xl'] }}>
        <Txt variant="headingMd" style={{ marginBottom: spacing.md }}>
          {t('home.categoriesTitle')}
        </Txt>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.md, paddingRight: spacing.lg }}
        >
          {catalog.map((c) => (
            <CategoryShortcut key={c.key} category={c} onPress={() => router.push(`/browse/${c.key}`)} />
          ))}
        </ScrollView>
      </View>

      {/* Popular near you */}
      <View style={{ marginTop: spacing['2xl'] }}>
        <Txt variant="headingMd" style={{ marginBottom: spacing.md }}>
          {t('home.popularTitle')}
        </Txt>
        <View style={{ gap: spacing.sm }}>
          {POPULAR.map(({ cat, sub }) => {
            const s = findSub(cat, sub);
            if (!s) return null;
            return (
              <PressableScale
                key={`${cat}-${sub}`}
                onPress={() => openPopular(cat, sub)}
                scaleTo={0.98}
                haptic={false}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  backgroundColor: colors.bgElevated,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: spacing.md,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: radius.sm,
                    backgroundColor: colors.surface,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name={s.icon} size={18} color={colors.accentDeep} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt variant="bodySmStrong">{s.services[lang][0]}</Txt>
                  <Txt variant="caption" style={{ marginTop: 1 }}>
                    {loc(s.label, lang)}
                  </Txt>
                </View>
                <Icon name="arrow-up-right" size={18} color={colors.textMuted} />
              </PressableScale>
            );
          })}
        </View>
      </View>
    </Screen>
  );
}
