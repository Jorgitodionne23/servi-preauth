/**
 * Input + Field — clean text inputs with 1.5px border + teal focus ring,
 * matching the web input system.
 */
import { useState } from 'react';
import { TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { Txt } from './Text';
import { Icon, type FeatherName } from './Icon';
import { colors, radius, spacing } from '@/theme/tokens';
import { fonts } from '@/theme/typography';

type Props = TextInputProps & {
  icon?: FeatherName;
  containerStyle?: ViewStyle;
  invalid?: boolean;
};

export function Input({ icon, containerStyle, invalid, style, onFocus, onBlur, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          backgroundColor: colors.bgElevated,
          borderRadius: radius.md,
          borderWidth: 1.5,
          borderColor: invalid ? colors.danger : focused ? colors.accentDeep : colors.borderInput,
          paddingHorizontal: 14,
          minHeight: 52,
        },
        focused ? { shadowColor: colors.accent, shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } } : null,
        containerStyle,
      ]}
    >
      {icon ? <Icon name={icon} size={18} color={colors.textMuted} /> : null}
      <TextInput
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        placeholderTextColor={colors.textMuted}
        style={[
          {
            flex: 1,
            fontFamily: fonts.body,
            fontSize: 16,
            color: colors.text,
            paddingVertical: 14,
          },
          style,
        ]}
      />
    </View>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Txt variant="label">{label}</Txt>
      {children}
      {hint ? <Txt variant="caption">{hint}</Txt> : null}
    </View>
  );
}
