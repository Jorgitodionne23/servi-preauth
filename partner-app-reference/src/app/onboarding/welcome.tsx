/**
 * Welcome — the recruitment pitch, and the app's true entry point for anyone
 * without an account.
 *
 * Leads with the three things a working specialist in CDMX actually complains
 * about: not getting paid, losing a cut, and hunting for clients. SERVI's
 * genuine answer to the middle one — you keep 100%, the client pays the fee —
 * is stated up front rather than buried in a fee schedule, because it's the
 * claim most likely to be disbelieved and most likely to convert.
 */
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Icon, type FeatherName } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LangToggle } from '@/components/ui/LangToggle';
import { ServiLogo } from '@/components/ui/ServiLogo';
import { useI18n } from '@/i18n/I18nContext';
import { colors, radius, spacing } from '@/theme/tokens';
import type { StringKey } from '@/i18n/strings';

const PILLARS: { icon: FeatherName; title: StringKey; body: StringKey }[] = [
  { icon: 'shield', title: 'onb.welcome.p1t', body: 'onb.welcome.p1b' },
  { icon: 'dollar-sign', title: 'onb.welcome.p2t', body: 'onb.welcome.p2b' },
  { icon: 'users', title: 'onb.welcome.p3t', body: 'onb.welcome.p3b' },
];

export default function WelcomeScreen() {
  const { t } = useI18n();
  const router = useRouter();

  return (
    <Screen bottomInset={spacing['3xl']}>
      <ScreenHeader right={<LangToggle />} />
      <View style={{ marginTop: spacing.sm }}>
        <ServiLogo size={24} partner />
      </View>

      <View style={{ marginTop: spacing['2xl'] }}>
        <Badge label={t('onb.welcome.eyebrow')} tone="accent" icon="award" />
        <Txt variant="displayXl" style={{ marginTop: spacing.md }}>
          {t('onb.welcome.title')}
        </Txt>
        <Txt variant="body" style={{ marginTop: spacing.md }}>
          {t('onb.welcome.subtitle')}
        </Txt>
      </View>

      <View style={{ marginTop: spacing['2xl'], gap: spacing.md }}>
        {PILLARS.map((p) => (
          <Card key={p.title} style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
            <View
              style={{
                width: 42, height: 42, borderRadius: radius.md,
                backgroundColor: colors.accentTint,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Icon name={p.icon} size={19} color={colors.accentInk} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt variant="bodyStrong">{t(p.title)}</Txt>
              <Txt variant="bodySm" style={{ marginTop: 3 }}>
                {t(p.body)}
              </Txt>
            </View>
          </Card>
        ))}
      </View>

      <View style={{ marginTop: spacing['2xl'], gap: spacing.md }}>
        <Button
          label={t('onb.welcome.cta')}
          iconRight="arrow-right"
          onPress={() => router.push('/onboarding/identity')}
        />
        <Txt variant="caption" center>
          {t('onb.welcome.time')}
        </Txt>
        <Button
          label={t('onb.welcome.signin')}
          variant="ghost"
          size="md"
          onPress={() => router.push('/auth/phone')}
        />
      </View>

      <Txt variant="caption" center style={{ marginTop: spacing.xl }}>
        {t('proto.banner')}
      </Txt>
    </Screen>
  );
}
