/**
 * Deposit history. Each row expands to the jobs it covered — the question
 * behind "why is this deposit $1,940?" is always "which jobs is that?".
 */
import { useState } from 'react';
import { View } from 'react-native';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Text';
import { Card, Divider } from '@/components/ui/Card';
import { MessageState } from '@/components/ui/States';
import { LangToggle } from '@/components/ui/LangToggle';
import { PayoutRow } from '@/components/Money';
import { usePartner } from '@/state/PartnerStateContext';
import { useI18n } from '@/i18n/I18nContext';
import { colors, spacing } from '@/theme/tokens';
import { money } from '@/theme/partner';
import { loc } from '@/data/types';

export default function PayoutsScreen() {
  const { t, lang } = useI18n();
  const { payouts, getJob } = usePartner();
  const [open, setOpen] = useState<string | null>(null);

  return (
    <Screen bottomInset={spacing['3xl']}>
      <ScreenHeader back title={t('payout.title')} right={<LangToggle />} />

      {payouts.length === 0 ? (
        <Card style={{ marginTop: spacing.lg }}>
          <MessageState icon="credit-card" title={t('payout.empty')} body={t('payout.emptyBody')} />
        </Card>
      ) : (
        <Card style={{ marginTop: spacing.lg, gap: 0 }}>
          {payouts.map((p, i) => (
            <View key={p.id}>
              {i > 0 ? <Divider /> : null}
              <PayoutRow payout={p} onPress={() => setOpen(open === p.id ? null : p.id)} />

              {open === p.id ? (
                <View
                  style={{
                    gap: spacing.sm,
                    paddingBottom: spacing.md,
                    paddingLeft: 50,
                  }}
                >
                  {p.jobIds.map((jid) => {
                    const job = getJob(jid);
                    return (
                      <View
                        key={jid}
                        style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}
                      >
                        <Txt variant="bodySm" style={{ flex: 1 }} numberOfLines={1}>
                          {job ? loc(job.service, lang) : jid}
                        </Txt>
                        <Txt variant="bodySmStrong">
                          {job ? money(job.payoutCents) : '—'}
                        </Txt>
                      </View>
                    );
                  })}
                  {p.feeCents > 0 ? (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Txt variant="bodySm" color={colors.dangerInk}>
                        {t('payout.instant')}
                      </Txt>
                      <Txt variant="bodySmStrong" color={colors.dangerInk}>
                        −{money(p.feeCents)}
                      </Txt>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}
