/**
 * SmartRequestBox — the prompt box from the web Smart Request "compose" phase:
 * a rounded card with a multiline textarea and a bottom bar (attach + send).
 * The send button turns teal-accent once there's text. Focus shows a teal ring.
 */
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { PressableScale } from './ui/Pressable';
import { Icon } from './ui/Icon';
import { colors, radius, spacing } from '@/theme/tokens';
import { fonts } from '@/theme/typography';

export function SmartRequestBox({
  value,
  onChangeText,
  onSubmit,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChangeText: (s: string) => void;
  onSubmit: () => void;
  placeholder: string;
  autoFocus?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const hasText = value.trim().length > 0;

  return (
    <View
      style={{
        backgroundColor: colors.bgElevated,
        borderRadius: radius.xl,
        borderWidth: 1.5,
        borderColor: focused ? colors.accentDeep : colors.borderInput,
        padding: spacing.lg,
        ...(focused
          ? { shadowColor: colors.accent, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } }
          : {}),
      }}
    >
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline
        autoFocus={autoFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          fontFamily: fonts.body,
          fontSize: 17,
          lineHeight: 24,
          color: colors.text,
          minHeight: 76,
          textAlignVertical: 'top',
        }}
      />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: spacing.md,
        }}
      >
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.borderInput,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="plus" size={18} color={colors.textMuted} />
        </View>
        <PressableScale
          onPress={hasText ? onSubmit : undefined}
          disabled={!hasText}
          scaleTo={0.9}
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.md,
            backgroundColor: hasText ? colors.accent : colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="arrow-right" size={20} color={hasText ? colors.accentInk : colors.textMuted} />
        </PressableScale>
      </View>
    </View>
  );
}
