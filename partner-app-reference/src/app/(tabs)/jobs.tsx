/**
 * Jobs — three segments: Available (offers), Scheduled, History.
 *
 * Available leads because it's the only segment with a deadline. History is
 * grouped by nothing and sorted newest-first: specialists look up a past job to
 * settle a question about payment, so recency beats any clever grouping.
 */
import { useState } from 'react';
import { View } from 'react-native';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { MessageState } from '@/components/ui/States';
import { LangToggle } from '@/components/ui/LangToggle';
import { OfferCard } from '@/components/OfferCard';
import { JobCard } from '@/components/JobCard';
import { usePartner } from '@/state/PartnerStateContext';
import { useI18n } from '@/i18n/I18nContext';
import { layout, spacing } from '@/theme/tokens';

type Seg = 'offers' | 'upcoming' | 'history';

export default function JobsScreen() {
  const { t } = useI18n();
  const { offers, upcoming, history, acceptOffer, declineOffer, onDuty } = usePartner();
  const [seg, setSeg] = useState<Seg>('offers');

  return (
    <Screen bottomInset={layout.tabBarHeight + 48}>
      <ScreenHeader title={t('jobs.title')} right={<LangToggle />} />

      <View style={{ marginTop: spacing.lg }}>
        <SegmentedControl
          value={seg}
          onChange={(k) => setSeg(k as Seg)}
          segments={[
            { key: 'offers', label: `${t('jobs.segOffers')}${offers.length ? ` (${offers.length})` : ''}` },
            { key: 'upcoming', label: t('jobs.segUpcoming') },
            { key: 'history', label: t('jobs.segHistory') },
          ]}
        />
      </View>

      <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
        {seg === 'offers' ? (
          offers.length === 0 ? (
            <Card>
              <MessageState
                icon={onDuty ? 'inbox' : 'moon'}
                title={onDuty ? t('today.emptyOffers') : t('today.offDuty')}
                body={onDuty ? t('today.emptyOffersBody') : t('today.offDutyHint')}
              />
            </Card>
          ) : (
            offers.map((job) => (
              <OfferCard
                key={job.id}
                job={job}
                onAccept={() => acceptOffer(job.id)}
                onDecline={() => declineOffer(job.id)}
              />
            ))
          )
        ) : null}

        {seg === 'upcoming' ? (
          upcoming.length === 0 ? (
            <Card>
              <MessageState
                icon="calendar"
                title={t('jobs.emptyUpcoming')}
                body={t('jobs.emptyUpcomingBody')}
              />
            </Card>
          ) : (
            upcoming.map((job) => <JobCard key={job.id} job={job} />)
          )
        ) : null}

        {seg === 'history' ? (
          history.length === 0 ? (
            <Card>
              <MessageState
                icon="clock"
                title={t('jobs.emptyHistory')}
                body={t('jobs.emptyHistoryBody')}
              />
            </Card>
          ) : (
            history.map((job) => <JobCard key={job.id} job={job} />)
          )
        ) : null}
      </View>

      <Txt variant="caption" center style={{ marginTop: spacing.xl }}>
        {t('proto.banner')}
      </Txt>
    </Screen>
  );
}
