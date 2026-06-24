/**
 * Request · Address — pick a saved CDMX address, use current location
 * (simulated), or add a new one. Mirrors the web structured address book.
 */
import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { RadioRow } from '@/components/ui/Rows';
import { PressableScale } from '@/components/ui/Pressable';
import { Icon } from '@/components/ui/Icon';
import { Input, Field } from '@/components/ui/Input';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { useApp } from '@/state/AppStateContext';
import { useI18n } from '@/i18n/I18nContext';
import { colors, radius, spacing } from '@/theme/tokens';

export default function AddressScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { addresses, draft, patchDraft, addAddress } = useApp();
  const [locating, setLocating] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState({ label: '', line1: '', neighborhood: '' });

  const useCurrent = () => {
    setLocating(true);
    setTimeout(() => {
      setLocating(false);
      patchDraft({ addressId: null, addressText: 'Av. Santa Fe 482, Santa Fe, Cuajimalpa' });
    }, 900);
  };

  const saveNew = () => {
    if (!form.line1.trim()) return;
    const created = addAddress({
      label: form.label.trim() || 'Dirección',
      line1: form.line1.trim(),
      neighborhood: form.neighborhood.trim() || 'Santa Fe',
      city: 'Cuajimalpa, CDMX',
      isDefault: addresses.length === 0,
    });
    patchDraft({ addressId: created.id, addressText: '' });
    setForm({ label: '', line1: '', neighborhood: '' });
    setSheetOpen(false);
  };

  const canContinue = !!draft.addressId || draft.addressText.trim().length > 0;

  return (
    <Screen bottomInset={120}>
      <ScreenHeader back />
      <Txt variant="displayLg" style={{ marginTop: spacing.sm }}>
        {t('req.address.label')}
      </Txt>

      <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
        {addresses.map((a) => (
          <RadioRow
            key={a.id}
            selected={draft.addressId === a.id}
            onPress={() => patchDraft({ addressId: a.id, addressText: '' })}
            icon="map-pin"
            title={a.label}
            subtitle={`${a.line1} · ${a.neighborhood}`}
          />
        ))}

        {draft.addressText ? (
          <RadioRow
            selected={!draft.addressId}
            onPress={() => {}}
            icon="navigation"
            title={t('req.address.useCurrent')}
            subtitle={draft.addressText}
          />
        ) : null}

        <PressableScale
          onPress={useCurrent}
          haptic={false}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md }}
        >
          <View style={{ width: 38, height: 38, borderRadius: radius.sm, backgroundColor: colors.accentTint, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="navigation" size={18} color={colors.accentInk} />
          </View>
          <Txt variant="bodyStrong" color={colors.accentInk}>
            {locating ? t('req.address.locating') : t('req.address.useCurrent')}
          </Txt>
        </PressableScale>

        <PressableScale
          onPress={() => setSheetOpen(true)}
          haptic={false}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md }}
        >
          <View style={{ width: 38, height: 38, borderRadius: radius.sm, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="plus" size={18} color={colors.text} />
          </View>
          <Txt variant="bodyStrong">{t('req.address.add')}</Txt>
        </PressableScale>
      </View>

      <View style={{ marginTop: spacing.xl }}>
        <Button label={t('common.next')} icon="arrow-right" disabled={!canContinue} onPress={() => router.push('/request/review')} />
      </View>

      <BottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title={t('req.address.add')}>
        <View style={{ gap: spacing.lg }}>
          <Field label={t('account.addresses')}>
            <Input placeholder="Casa, Oficina…" value={form.label} onChangeText={(v) => setForm((f) => ({ ...f, label: v }))} />
          </Field>
          <Field label="Calle y número">
            <Input placeholder="Av. Santa Fe 482, Piso 7" value={form.line1} onChangeText={(v) => setForm((f) => ({ ...f, line1: v }))} />
          </Field>
          <Field label="Colonia">
            <Input placeholder="Santa Fe" value={form.neighborhood} onChangeText={(v) => setForm((f) => ({ ...f, neighborhood: v }))} />
          </Field>
          <Button label={t('common.save')} onPress={saveNew} disabled={!form.line1.trim()} />
        </View>
      </BottomSheet>
    </Screen>
  );
}
