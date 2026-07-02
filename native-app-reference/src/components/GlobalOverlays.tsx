/**
 * GlobalOverlays — app-wide transient surfaces mounted above every screen.
 * Currently the offline banner, driven by the demo `offline` toggle in
 * AppState (Account → Demo). A production app would source this from NetInfo.
 */
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OfflineBanner } from './ui/States';
import { useApp } from '@/state/AppStateContext';
import { useI18n } from '@/i18n/I18nContext';
import { layout, spacing } from '@/theme/tokens';

export function GlobalOverlays() {
  const insets = useSafeAreaInsets();
  const { offline } = useApp();
  const { t } = useI18n();

  if (!offline) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: insets.top + spacing.sm,
        left: 0,
        right: 0,
        alignItems: 'center',
        paddingHorizontal: layout.screenPaddingX,
      }}
    >
      <View style={{ width: '100%', maxWidth: layout.maxContentWidth }}>
        <OfflineBanner visible={offline} label={t('state.offlineTitle')} detail={t('state.offlineBody')} />
      </View>
    </View>
  );
}
