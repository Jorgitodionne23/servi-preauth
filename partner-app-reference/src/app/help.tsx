/**
 * Help — support contact + the five questions that actually get asked.
 *
 * Contact goes to email, matching the web app's `CONTACT_MODE='email'` stopgap
 * (see ../../../CLAUDE.md — the old WhatsApp business number was resold). When
 * the new number is live, this becomes a WhatsApp link.
 *
 * The safety callout sits above the FAQ, not buried in it: "leave the site if
 * you feel unsafe" is the one instruction that can't wait for someone to scroll.
 */
import { useState } from 'react';
import { Linking, View } from 'react-native';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Text';
import { Card, Divider } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/Pressable';
import { LangToggle } from '@/components/ui/LangToggle';
import { useI18n } from '@/i18n/I18nContext';
import { colors, radius, spacing } from '@/theme/tokens';
import type { StringKey } from '@/i18n/strings';

const SUPPORT_EMAIL = 'serv.clientserv@gmail.com';

const FAQ: { q: StringKey; a: StringKey }[] = [
  { q: 'faq.q1', a: 'faq.a1' },
  { q: 'faq.q2', a: 'faq.a2' },
  { q: 'faq.q3', a: 'faq.a3' },
  { q: 'faq.q4', a: 'faq.a4' },
  { q: 'faq.q5', a: 'faq.a5' },
];

export default function HelpScreen() {
  const { t } = useI18n();
  const [open, setOpen] = useState<string | null>(null);

  return (
    <Screen bottomInset={spacing['3xl']}>
      <ScreenHeader back title={t('help.title')} right={<LangToggle />} />

      {/* Safety first, literally */}
      <Card
        style={{
          marginTop: spacing.lg,
          gap: spacing.md,
          backgroundColor: colors.dangerTint,
          borderColor: colors.dangerTint,
        }}
        elevated={false}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Icon name="alert-triangle" size={19} color={colors.dangerInk} />
          <Txt variant="bodyStrong" color={colors.dangerInk} style={{ flex: 1 }}>
            {t('help.urgent')}
          </Txt>
        </View>
        <Txt variant="bodySm" color={colors.dangerInk}>
          {t('help.urgentBody')}
        </Txt>
        <Button
          label={t('help.report')}
          variant="danger"
          size="md"
          icon="flag"
          onPress={() =>
            Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Reporte%20urgente%20-%20SERVI%20Partner`).catch(() => {})
          }
        />
      </Card>

      {/* Support */}
      <Card style={{ marginTop: spacing.lg, gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View
            style={{
              width: 42, height: 42, borderRadius: radius.sm,
              backgroundColor: colors.accentTint,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Icon name="mail" size={19} color={colors.accentInk} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt variant="bodyStrong">{t('help.contactTitle')}</Txt>
            <Txt variant="caption" style={{ marginTop: 2 }}>
              {SUPPORT_EMAIL}
            </Txt>
          </View>
        </View>
        <Txt variant="bodySm">{t('help.contactBody')}</Txt>
        <Button
          label={t('help.email')}
          variant="secondary"
          size="md"
          icon="mail"
          onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {})}
        />
      </Card>

      {/* FAQ */}
      <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
        <Txt variant="headingMd">{t('help.faq')}</Txt>
        <Card style={{ gap: 0 }}>
          {FAQ.map((item, i) => (
            <View key={item.q}>
              {i > 0 ? <Divider /> : null}
              <PressableScale
                onPress={() => setOpen(open === item.q ? null : item.q)}
                scaleTo={0.995}
                haptic={false}
                style={{ paddingVertical: 14, gap: spacing.sm }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <Txt variant="bodyStrong" style={{ flex: 1 }}>
                    {t(item.q)}
                  </Txt>
                  <Icon
                    name={open === item.q ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={colors.textMuted}
                  />
                </View>
                {open === item.q ? <Txt variant="bodySm">{t(item.a)}</Txt> : null}
              </PressableScale>
            </View>
          ))}
        </Card>
      </View>

      <Txt variant="caption" center style={{ marginTop: spacing.xl }}>
        {t('proto.banner')}
      </Txt>
    </Screen>
  );
}
