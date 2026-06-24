/**
 * Help & contact — SERVI support. Contact routes to email (mirrors the web
 * CONTACT_MODE='email' stopgap while the WhatsApp number is replaced). The
 * email button is a reference no-op in the prototype.
 */
import { useState } from 'react';
import { View } from 'react-native';

import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { Card, Divider } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/Pressable';
import { useI18n } from '@/i18n/I18nContext';
import { colors, radius, spacing } from '@/theme/tokens';

const CONTACT_EMAIL = 'serv.clientserv@gmail.com';

const FAQ: { q: { es: string; en: string }; a: { es: string; en: string } }[] = [
  {
    q: { es: '¿Cuándo se me cobra?', en: 'When am I charged?' },
    a: {
      es: 'Pre-autorizamos (retenemos) tu tarjeta y solo cobramos después de completar el servicio.',
      en: 'We pre-authorize (hold) your card and only charge after the service is completed.',
    },
  },
  {
    q: { es: '¿Cómo asignan a mi especialista?', en: 'How is my specialist matched?' },
    a: {
      es: 'Un coordinador de SERVI revisa tu solicitud y asigna a un especialista verificado de tu zona.',
      en: 'A SERVI coordinator reviews your request and assigns a verified specialist near you.',
    },
  },
  {
    q: { es: '¿Necesito guardar una tarjeta?', en: 'Do I need to save a card?' },
    a: {
      es: 'Para reservas con 5+ días de anticipación y visitas de cotización, sí. Para servicios pronto, puedes pagar por enlace.',
      en: 'For bookings 5+ days out and quote visits, yes. For soon services you can pay via link.',
    },
  },
];

function FaqRow({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <PressableScale onPress={() => setOpen((o) => !o)} haptic={false} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md }}>
        <Txt variant="bodyStrong" style={{ flex: 1 }}>
          {q}
        </Txt>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
      </PressableScale>
      {open ? (
        <Txt variant="bodySm" style={{ paddingBottom: spacing.md }}>
          {a}
        </Txt>
      ) : null}
    </View>
  );
}

export default function HelpScreen() {
  const { t, lang } = useI18n();

  return (
    <Screen bottomInset={spacing.xl}>
      <ScreenHeader back title={t('help.title')} />
      <Txt variant="body" style={{ marginTop: spacing.md }}>
        {t('help.sub')}
      </Txt>

      <Card style={{ marginTop: spacing.lg, gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.accentTint, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="mail" size={20} color={colors.accentInk} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt variant="bodyStrong">{CONTACT_EMAIL}</Txt>
            <Txt variant="caption">Santa Fe, Cuajimalpa, CDMX</Txt>
          </View>
        </View>
        <Button label={t('help.email')} icon="mail" onPress={() => {}} />
      </Card>

      <Txt variant="eyebrow" style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>
        {t('help.faqTitle')}
      </Txt>
      <Card padded={false}>
        <View style={{ paddingHorizontal: spacing.lg }}>
          {FAQ.map((item, i) => (
            <View key={i}>
              <FaqRow q={item.q[lang]} a={item.a[lang]} />
              {i < FAQ.length - 1 ? <Divider /> : null}
            </View>
          ))}
        </View>
      </Card>
    </Screen>
  );
}
