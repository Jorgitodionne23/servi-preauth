/**
 * Account · Saved addresses — list, set-default, and add new CDMX addresses.
 * Mirrors the web account address book (in-memory in the prototype).
 */
import { useState } from 'react';
import { View } from 'react-native';

import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Field } from '@/components/ui/Input';
import { PressableScale } from '@/components/ui/Pressable';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { useApp } from '@/state/AppStateContext';
import { useI18n } from '@/i18n/I18nContext';
import { colors, radius, spacing } from '@/theme/tokens';

export default function AddressesScreen() {
  const { t } = useI18n();
  const { addresses, addAddress, setDefaultAddress } = useApp();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState({ label: '', line1: '', neighborhood: '' });

  const save = () => {
    if (!form.line1.trim()) return;
    addAddress({
      label: form.label.trim() || 'Dirección',
      line1: form.line1.trim(),
      neighborhood: form.neighborhood.trim() || 'Santa Fe',
      city: 'Cuajimalpa, CDMX',
      isDefault: addresses.length === 0,
    });
    setForm({ label: '', line1: '', neighborhood: '' });
    setSheetOpen(false);
  };

  return (
    <Screen bottomInset={spacing.xl}>
      <ScreenHeader back title={t('account.addresses')} />
      <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
        {addresses.map((a) => (
          <Card key={a.id} style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
              <View style={{ width: 42, height: 42, borderRadius: radius.sm, backgroundColor: colors.accentTint, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="map-pin" size={18} color={colors.accentInk} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Txt variant="bodyStrong">{a.label}</Txt>
                  {a.isDefault ? <Badge label={t('account.default')} tone="accent" /> : null}
                </View>
                <Txt variant="caption" style={{ marginTop: 2 }}>
                  {a.line1} · {a.neighborhood} · {a.city}
                </Txt>
              </View>
            </View>
            {!a.isDefault ? (
              <PressableScale onPress={() => setDefaultAddress(a.id)} haptic={false} style={{ alignSelf: 'flex-start' }}>
                <Txt variant="bodySmStrong" color={colors.accentInk}>
                  {t('account.setDefault')}
                </Txt>
              </PressableScale>
            ) : null}
          </Card>
        ))}

        <Button label={t('req.address.add')} variant="secondary" icon="plus" onPress={() => setSheetOpen(true)} />
      </View>

      <BottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title={t('req.address.add')}>
        <View style={{ gap: spacing.lg }}>
          <Field label={t('address.field.label')}>
            <Input placeholder="Casa, Oficina…" value={form.label} onChangeText={(v) => setForm((f) => ({ ...f, label: v }))} />
          </Field>
          <Field label={t('address.field.street')}>
            <Input placeholder="Av. Santa Fe 482, Piso 7" value={form.line1} onChangeText={(v) => setForm((f) => ({ ...f, line1: v }))} />
          </Field>
          <Field label={t('address.field.colonia')}>
            <Input placeholder="Santa Fe" value={form.neighborhood} onChangeText={(v) => setForm((f) => ({ ...f, neighborhood: v }))} />
          </Field>
          <Button label={t('common.save')} onPress={save} disabled={!form.line1.trim()} />
        </View>
      </BottomSheet>
    </Screen>
  );
}
