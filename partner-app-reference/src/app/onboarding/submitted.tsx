/**
 * Application submitted.
 *
 * The wait between applying and being verified is where partner funnels leak.
 * So this screen does two things beyond confirming: it gives a concrete time
 * window (24–48 h) and a named channel (WhatsApp), and it lets them into the
 * app anyway. Someone who explores the earnings screen while waiting is far
 * more likely to still be there when verification lands.
 */
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { useI18n } from '@/i18n/I18nContext';
import { colors, radius, spacing } from '@/theme/tokens';

export default function SubmittedScreen() {
  const { t } = useI18n();
  const router = useRouter();

  return (
    <Screen scroll={false}>
      <ScreenHeader />
      <View style={{ flex: 1, justifyContent: 'center', gap: spacing.xl }}>
        <View style={{ alignItems: 'center', gap: spacing.lg }}>
          <View
            style={{
              width: 76, height: 76, borderRadius: 24,
              backgroundColor: colors.successTint,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Icon name="check" size={34} color={colors.successInk} />
          </View>
          <Txt variant="displayLg" center>
            {t('onb.submitted.title')}
          </Txt>
          <Txt variant="body" center style={{ maxWidth: 320 }}>
            {t('onb.submitted.body')}
          </Txt>
        </View>

        <Card style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
          <View
            style={{
              width: 40, height: 40, borderRadius: radius.sm,
              backgroundColor: colors.warningTint,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Icon name="clock" size={18} color={colors.warningInk} />
          </View>
          <Txt variant="bodySm" style={{ flex: 1 }}>
            {t('today.pendingVerificationBody')}
          </Txt>
        </Card>

        <Button
          label={t('onb.submitted.explore')}
          onPress={() => router.replace('/(tabs)')}
        />
      </View>
    </Screen>
  );
}
