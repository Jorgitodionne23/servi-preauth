/**
 * Screen + ScreenHeader — consistent safe-area page scaffold. Constrains content
 * to a phone-width column even on wide web viewports so it never reads as a
 * "resized website".
 */
import { ReactNode } from 'react';
import { ScrollView, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { PressableScale } from './Pressable';
import { Txt } from './Text';
import { Icon } from './Icon';
import { colors, layout, spacing } from '@/theme/tokens';

type ScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  bg?: string;
  /** Extra bottom padding so content clears the tab bar / CTA. */
  bottomInset?: number;
};

export function Screen({
  children,
  scroll = true,
  padded = true,
  style,
  contentStyle,
  bg = colors.bg,
  bottomInset = 0,
}: ScreenProps) {
  const inner: ViewStyle = {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: padded ? layout.screenPaddingX : 0,
    paddingBottom: bottomInset,
  };

  if (!scroll) {
    return (
      <View style={[{ flex: 1, backgroundColor: bg }, style]}>
        <View style={[{ flex: 1 }, inner, contentStyle]}>{children}</View>
      </View>
    );
  }

  return (
    <ScrollView
      style={[{ flex: 1, backgroundColor: bg }, style]}
      contentContainerStyle={[inner, { flexGrow: 1 }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

type HeaderProps = {
  title?: string;
  subtitle?: string;
  back?: boolean;
  onBack?: () => void;
  right?: ReactNode;
  large?: boolean;
};

export function ScreenHeader({ title, subtitle, back, onBack, right, large }: HeaderProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={{ paddingTop: insets.top + spacing.sm }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 44,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 }}>
          {back ? (
            <PressableScale
              onPress={onBack ?? (() => router.back())}
              hitSlop={layout.hitSlop}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.surface,
              }}
            >
              <Icon name="arrow-left" size={20} color={colors.text} />
            </PressableScale>
          ) : null}
          {title && !large ? (
            <Txt variant="headingMd" numberOfLines={1} style={{ flex: 1 }}>
              {title}
            </Txt>
          ) : null}
        </View>
        {right}
      </View>
      {large && title ? (
        <View style={{ marginTop: spacing.md }}>
          <Txt variant="displayLg">{title}</Txt>
          {subtitle ? (
            <Txt variant="body" style={{ marginTop: 6 }}>
              {subtitle}
            </Txt>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
