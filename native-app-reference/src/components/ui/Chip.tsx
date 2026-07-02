/**
 * Chip — pill selector. Active state = ink fill / white text (web `.chip` active).
 */
import { PressableScale } from './Pressable';
import { Txt } from './Text';
import { Icon, type FeatherName } from './Icon';
import { colors, radius } from '@/theme/tokens';

type Props = {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: FeatherName;
};

export function Chip({ label, active = false, onPress, icon }: Props) {
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.95}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: active ? colors.ink : colors.borderInput,
        backgroundColor: active ? colors.ink : colors.bgElevated,
      }}
    >
      {icon ? <Icon name={icon} size={14} color={active ? colors.textInverse : colors.textSecondary} /> : null}
      <Txt variant="bodySmStrong" color={active ? colors.textInverse : colors.text}>
        {label}
      </Txt>
    </PressableScale>
  );
}
