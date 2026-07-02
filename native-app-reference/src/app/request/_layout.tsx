/**
 * Request builder — a self-contained modal stack:
 * compose (capture) → build (understand + follow-ups + when/where) →
 * address → review → submitted.
 */
import { Stack } from 'expo-router';
import { colors } from '@/theme/tokens';

export default function RequestLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="compose" />
      <Stack.Screen name="build" />
      <Stack.Screen name="address" />
      <Stack.Screen name="review" />
      <Stack.Screen name="submitted" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
