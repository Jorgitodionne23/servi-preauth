/**
 * SERVI wordmark — "SERVI" in Outfit ExtraBold + the signature square dot,
 * with the partner-side "Partner" lockup. Rendered in code (no PNG) so it
 * scales crisply on every screen.
 *
 * The "Partner" tag is intentionally quiet: a specialist opens this app twenty
 * times a day and doesn't need to be shouted at about which product they're in.
 */
import { Text, View } from 'react-native';
import { colors } from '@/theme/tokens';
import { fonts } from '@/theme/typography';

export function ServiLogo({
  size = 26,
  color = colors.text,
  partner = false,
}: {
  size?: number;
  color?: string;
  partner?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 7 }}>
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
      {partner ? (
        <Text
          style={{
            fontFamily: fonts.bodySemi,
            fontSize: size * 0.52,
            letterSpacing: 0.2,
            color: colors.textMuted,
            marginBottom: size * 0.1,
          }}
        >
          Partner
        </Text>
      ) : null}
    </View>
  );
}
