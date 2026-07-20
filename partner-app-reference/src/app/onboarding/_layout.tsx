/**
 * Onboarding stack — a linear application flow. No tab bar, no escape hatches
 * mid-flow except Back, because a partially-submitted specialist application is
 * worth nothing to either side.
 */
import { Stack } from 'expo-router';
import { colors } from '@/theme/tokens';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}
    >
      <Stack.Screen name="welcome" />
      <Stack.Screen name="identity" />
      <Stack.Screen name="services" />
      <Stack.Screen name="coverage" />
      <Stack.Screen name="documents" />
      <Stack.Screen name="payout" />
      <Stack.Screen name="review" />
      <Stack.Screen name="submitted" />
    </Stack>
  );
}
