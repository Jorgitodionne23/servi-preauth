/**
 * Root layout — loads fonts, mounts providers, declares the navigation tree.
 *
 * Route groups:
 *   (tabs)      the four work surfaces (Today / Jobs / Earnings / Profile)
 *   auth        phone + OTP sign-in, presented as a modal
 *   onboarding  the specialist application, a full-screen linear flow
 *   job/*       job detail and its sub-flows (price change, completion)
 *   everything else: pushed detail screens
 */
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import {
  Outfit_600SemiBold,
  Outfit_700Bold,
  Outfit_800ExtraBold,
} from '@expo-google-fonts/outfit';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';

import { I18nProvider } from '@/i18n/I18nContext';
import { PartnerStateProvider } from '@/state/PartnerStateContext';
import { colors } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [loaded] = useFonts({
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync().catch(() => {});
  }, [loaded]);

  if (!loaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <I18nProvider>
          <PartnerStateProvider>
            <StatusBar style="dark" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.bg },
              }}
            >
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="auth" options={{ presentation: 'modal' }} />
              <Stack.Screen name="onboarding" />
              <Stack.Screen name="job/[id]/index" />
              <Stack.Screen name="job/[id]/price-change" options={{ presentation: 'modal' }} />
              <Stack.Screen name="job/[id]/complete" options={{ presentation: 'modal' }} />
              <Stack.Screen name="earnings/payouts" />
              <Stack.Screen name="availability" />
              <Stack.Screen name="coverage" />
              <Stack.Screen name="documents" />
              <Stack.Screen name="payout-account" />
              <Stack.Screen name="why-servi" />
              <Stack.Screen name="help" />
            </Stack>
          </PartnerStateProvider>
        </I18nProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
