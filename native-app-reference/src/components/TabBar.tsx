/**
 * CustomTabBar — frosted, ink-on-light bottom navigation. Native-feeling: an
 * active pill highlight, blur background, safe-area aware. Driven by
 * expo-router's Tabs via the `tabBar` prop.
 */
import type { ComponentProps } from 'react';
import { Platform, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Tabs } from 'expo-router';
import { PressableScale } from './ui/Pressable';
import { Txt } from './ui/Text';
import { Icon, type FeatherName } from './ui/Icon';
import { useI18n } from '@/i18n/I18nContext';
import { colors, radius } from '@/theme/tokens';
import type { StringKey } from '@/i18n/strings';

const TABS: Record<string, { icon: FeatherName; labelKey: StringKey }> = {
  index: { icon: 'home', labelKey: 'tab.home' },
  browse: { icon: 'grid', labelKey: 'tab.browse' },
  orders: { icon: 'clipboard', labelKey: 'tab.orders' },
  account: { icon: 'user', labelKey: 'tab.account' },
};

// Derive the tab-bar prop type from the public Tabs component (no deep import).
type TabBarFn = NonNullable<ComponentProps<typeof Tabs>['tabBar']>;
type TabBarProps = Parameters<TabBarFn>[0];

export function CustomTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();

  return (
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
      <BlurView
        intensity={Platform.OS === 'ios' ? 40 : 0}
        tint="light"
        style={{
          flexDirection: 'row',
          paddingTop: 8,
          paddingBottom: insets.bottom + 8,
          paddingHorizontal: 12,
          backgroundColor: Platform.OS === 'ios' ? 'rgba(250,251,251,0.82)' : colors.bgElevated,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <View style={{ flexDirection: 'row', flex: 1, maxWidth: 520, alignSelf: 'center', width: '100%' }}>
          {state.routes.map((route, index) => {
            const config = TABS[route.name];
            if (!config) return null;
            const focused = state.index === index;

            const onPress = () => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            return (
              <PressableScale
                key={route.key}
                onPress={onPress}
                scaleTo={0.9}
                haptic={false}
                style={{ flex: 1, alignItems: 'center', gap: 4, paddingVertical: 4 }}
              >
                <View
                  style={{
                    paddingHorizontal: 18,
                    paddingVertical: 5,
                    borderRadius: radius.pill,
                    backgroundColor: focused ? colors.accentTint : 'transparent',
                  }}
                >
                  <Icon name={config.icon} size={22} color={focused ? colors.accentInk : colors.textMuted} />
                </View>
                <Txt variant="tabLabel" color={focused ? colors.text : colors.textMuted}>
                  {t(config.labelKey)}
                </Txt>
              </PressableScale>
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}
