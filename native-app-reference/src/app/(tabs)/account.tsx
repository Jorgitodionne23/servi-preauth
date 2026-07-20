/**
 * ACCOUNT — profile, saved addresses, payment-method reference, order history,
 * language, help, partner CTA, and logout. Guest state shows a sign-in prompt.
 */
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { Card, Divider } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ListRow } from '@/components/ui/Rows';
import { LangToggle } from '@/components/ui/LangToggle';
import { MessageState } from '@/components/ui/States';
import { useApp } from '@/state/AppStateContext';
import { useI18n } from '@/i18n/I18nContext';
import { colors, spacing } from '@/theme/tokens';

export default function AccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, tn } = useI18n();
  const { session, addresses, orders, signOut, offline, forceError, toggleOffline, toggleForceError, advancePhase } = useApp();
  const user = session.user;
  const onLabel = t('account.on');
  const offLabel = t('account.off');

  return (
    <Screen bottomInset={insets.bottom + 96}>
      <View style={{ paddingTop: insets.top + spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg }}>
        <Txt variant="displayLg">{t('account.title')}</Txt>
        <LangToggle />
      </View>

      {!user ? (
        <Card style={{ gap: spacing.lg }}>
          <MessageState icon="user" title={t('account.guest')} body={t('account.signInPrompt')} />
          <Button label={t('account.signIn')} icon="log-in" onPress={() => router.push('/auth/identifier')} />
        </Card>
      ) : (
        <>
          {/* Profile */}
          <Card style={{ gap: spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: colors.accentTint, alignItems: 'center', justifyContent: 'center' }}>
                <Txt variant="headingMd" color={colors.accentInk}>
                  {user.firstName[0]}
                  {user.lastName[0]}
                </Txt>
              </View>
              <View style={{ flex: 1 }}>
                <Txt variant="headingSm">
                  {user.firstName} {user.lastName}
                </Txt>
                <Txt variant="caption" style={{ marginTop: 2 }}>
                  {user.phone}
                </Txt>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
              {user.phoneVerified ? <Badge label={t('account.phoneVerified')} tone="success" icon="check-circle" /> : null}
              {user.emailVerified ? <Badge label={t('account.emailVerified')} tone="success" icon="check-circle" /> : <Badge label={t('auth.gate.title')} tone="warning" icon="alert-circle" />}
            </View>
          </Card>

          {/* Saved payment method (reference) */}
          <Card style={{ marginTop: spacing.lg, gap: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Txt variant="eyebrow">{t('account.payment')}</Txt>
              <Badge label={t('pay.refDisclaimer')} tone="warning" icon="info" />
            </View>
            {user.card ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <View style={{ width: 46, height: 32, borderRadius: 6, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="credit-card" size={16} color={colors.textInverse} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt variant="bodyStrong" style={{ textTransform: 'capitalize' }}>
                    {user.card.brand} ···· {user.card.last4}
                  </Txt>
                  <Txt variant="caption">{t('account.cardExp')} {user.card.exp}</Txt>
                </View>
                {user.card.consentOnFile ? <Badge label={t('account.consentOnFile')} tone="accent" icon="shield" /> : null}
              </View>
            ) : (
              <Txt variant="bodySm">{t('pay.noCard')}</Txt>
            )}
            <Txt variant="bodySmStrong" color={colors.accentInk} onPress={() => router.push('/payment-info')}>
              {t('pay.title')} →
            </Txt>
          </Card>

          {/* Settings list */}
          <Card style={{ marginTop: spacing.lg }} padded={false}>
            <View style={{ paddingHorizontal: spacing.lg }}>
              <ListRow icon="map-pin" title={t('account.addresses')} subtitle={tn('account.savedCount', addresses.length)} onPress={() => router.push('/account/addresses')} />
              <Divider />
              <ListRow icon="clipboard" title={t('account.history')} subtitle={tn('account.ordersCount', orders.length)} onPress={() => router.push('/(tabs)/orders')} />
              <Divider />
              <ListRow
                icon="globe"
                title={t('account.language')}
                right={<LangToggle />}
              />
              <Divider />
              <ListRow icon="help-circle" title={t('account.help')} onPress={() => router.push('/help')} />
            </View>
          </Card>

          {/* Demo states — prototype-only toggles to exercise offline + error UI */}
          <Txt variant="eyebrow" style={{ marginTop: spacing.xl, marginLeft: spacing.xs, marginBottom: spacing.sm }}>
            {t('account.demo.title')}
          </Txt>
          <Card padded={false}>
            <View style={{ paddingHorizontal: spacing.lg }}>
              <ListRow
                icon="wifi-off"
                title={t('account.demo.offline')}
                subtitle={t('account.demo.offlineSub')}
                right={<Badge label={offline ? onLabel : offLabel} tone={offline ? 'success' : 'neutral'} dot />}
                onPress={toggleOffline}
              />
              <Divider />
              <ListRow
                icon="alert-circle"
                title={t('account.demo.error')}
                subtitle={t('account.demo.errorSub')}
                right={<Badge label={forceError ? onLabel : offLabel} tone={forceError ? 'danger' : 'neutral'} dot />}
                onPress={toggleForceError}
              />
              <Divider />
              <ListRow
                icon="navigation"
                title={t('account.demo.advance')}
                subtitle={t('account.demo.advanceSub')}
                onPress={() => advancePhase('SV-204701')}
              />
            </View>
          </Card>

          {/* Partner CTA (secondary) */}
          <Card style={{ marginTop: spacing.lg }} padded={false}>
            <View style={{ paddingHorizontal: spacing.lg }}>
              <ListRow icon="briefcase" iconTone={colors.accentInk} title={t('account.partner')} subtitle={t('account.partnerSub')} onPress={() => router.push('/partner')} />
            </View>
          </Card>

          {/* Logout */}
          <View style={{ marginTop: spacing.lg }}>
            <Button label={t('account.logout')} variant="ghost" icon="log-out" onPress={signOut} />
          </View>
        </>
      )}

      <Txt variant="caption" center style={{ marginTop: spacing.xl }}>
        SERVI · {t('account.footer')}
      </Txt>
    </Screen>
  );
}
