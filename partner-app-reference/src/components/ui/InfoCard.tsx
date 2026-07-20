/**
 * InfoCard — icon + title + body explainer block. Used heavily by the
 * payment / pre-authorization reference UI.
 */
import { View } from 'react-native';
import { Txt } from './Text';
import { Icon, type FeatherName } from './Icon';
import { colors, radius, spacing } from '@/theme/tokens';

export function InfoCard({
  icon,
  title,
  body,
  tone = 'neutral',
}: {
  icon: FeatherName;
  title: string;
  body: string;
  tone?: 'neutral' | 'accent';
}) {
  const tint = tone === 'accent' ? colors.accentTint : colors.surface;
  const fg = tone === 'accent' ? colors.accentInk : colors.accentDeep;
  return (
    <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: radius.md,
          backgroundColor: tint,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={18} color={fg} />
      </View>
      <View style={{ flex: 1, paddingTop: 2 }}>
        <Txt variant="bodyStrong">{title}</Txt>
        <Txt variant="bodySm" style={{ marginTop: 3 }}>
          {body}
        </Txt>
      </View>
    </View>
  );
}
