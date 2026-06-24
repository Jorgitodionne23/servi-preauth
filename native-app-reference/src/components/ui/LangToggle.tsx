/**
 * LangToggle — compact ES/EN pill, Spanish default. Mirrors the web navbar
 * language switch.
 */
import { View } from 'react-native';
import { PressableScale } from './Pressable';
import { Txt } from './Text';
import { useI18n } from '@/i18n/I18nContext';
import { colors, radius } from '@/theme/tokens';

export function LangToggle() {
  const { lang, toggle } = useI18n();
  return (
    <PressableScale
      onPress={toggle}
      scaleTo={0.94}
      haptic={false}
      accessibilityLabel="Toggle language"
      style={{
        flexDirection: 'row',
        backgroundColor: colors.surface,
        borderRadius: radius.pill,
        padding: 3,
      }}
    >
      {(['es', 'en'] as const).map((l) => {
        const active = lang === l;
        return (
          <View
            key={l}
            style={{
              paddingHorizontal: 11,
              paddingVertical: 5,
              borderRadius: radius.pill,
              backgroundColor: active ? colors.ink : 'transparent',
            }}
          >
            <Txt variant="caption" color={active ? colors.textInverse : colors.textMuted} style={{ textTransform: 'uppercase' }}>
              {l}
            </Txt>
          </View>
        );
      })}
    </PressableScale>
  );
}

export function Avatar({ initials, onPress, size = 40 }: { initials: string; onPress?: () => void; size?: number }) {
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.92}
      haptic={false}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.accentTint,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Txt variant="bodySmStrong" color={colors.accentInk}>
        {initials}
      </Txt>
    </PressableScale>
  );
}
