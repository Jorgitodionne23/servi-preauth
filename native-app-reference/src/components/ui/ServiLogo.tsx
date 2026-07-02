/**
 * SERVI wordmark — "SERVI" in Outfit ExtraBold + the signature square dot.
 * Rendered in code (no PNG) so it scales crisply on every screen.
 */
import { Text, View } from 'react-native';
import { colors } from '@/theme/tokens';
import { fonts } from '@/theme/typography';

export function ServiLogo({ size = 26, color = colors.text }: { size?: number; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
      <Text
        style={{
          fontFamily: fonts.displayBold,
          fontSize: size,
          letterSpacing: 0.3,
          color,
        }}
      >
        SERVI
      </Text>
      <View
        style={{
          width: size * 0.16,
          height: size * 0.16,
          borderRadius: 2,
          backgroundColor: color,
          marginLeft: 3,
          marginBottom: size * 0.14,
        }}
      />
    </View>
  );
}
