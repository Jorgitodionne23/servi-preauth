/**
 * Auth gate — a reference modal stack for the SERVI sign-in flow
 * (identifier → OTP → name → email/booking gate). Fully mocked: NO Firebase,
 * NO real OTP, NO Google OAuth. Faithful to docs/AUTH_STATE_MACHINE.md.
 */
import { Stack } from 'expo-router';
import { colors } from '@/theme/tokens';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="identifier" />
      <Stack.Screen name="otp" />
      <Stack.Screen name="name" />
      <Stack.Screen name="verify-email" />
    </Stack>
  );
}
