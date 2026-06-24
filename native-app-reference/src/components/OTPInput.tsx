/**
 * OTPInput — 6-cell code entry. A single hidden TextInput drives six visual
 * cells (the common RN pattern). Reference only — no real SMS/email codes.
 */
import { useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Txt } from './ui/Text';
import { colors, radius } from '@/theme/tokens';

const LEN = 6;

export function OTPInput({ value, onChange, autoFocus }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  const ref = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  return (
    <Pressable onPress={() => ref.current?.focus()}>
      <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'space-between' }}>
        {Array.from({ length: LEN }).map((_, i) => {
          const char = value[i] ?? '';
          const active = focused && i === value.length;
          return (
            <View
              key={i}
              style={{
                flex: 1,
                aspectRatio: 0.82,
                borderRadius: radius.md,
                borderWidth: 1.5,
                borderColor: active ? colors.accentDeep : char ? colors.text : colors.borderInput,
                backgroundColor: colors.bgElevated,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Txt variant="headingMd">{char}</Txt>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(v) => onChange(v.replace(/[^0-9]/g, '').slice(0, LEN))}
        keyboardType="number-pad"
        maxLength={LEN}
        autoFocus={autoFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
      />
    </Pressable>
  );
}
