/**
 * SERVI typography presets.
 *
 * Fonts mirror the web app: Outfit (display/headings) + Plus Jakarta Sans
 * (body/UI). Loaded in `src/app/_layout.tsx` via @expo-google-fonts.
 * Sizes are scaled down from the web scale for a phone-first reading rhythm.
 */
import { Platform, TextStyle } from 'react-native';
import { colors } from './tokens';

/** Font family names as registered by the @expo-google-fonts packages. */
export const fonts = {
  display: 'Outfit_700Bold',
  displayBold: 'Outfit_800ExtraBold',
  displaySemi: 'Outfit_600SemiBold',
  body: 'PlusJakartaSans_400Regular',
  bodyMedium: 'PlusJakartaSans_500Medium',
  bodySemi: 'PlusJakartaSans_600SemiBold',
  bodyBold: 'PlusJakartaSans_700Bold',
} as const;

type Preset = TextStyle;

export const type: Record<string, Preset> = {
  // Display / headings — Outfit, tight tracking
  displayXl: {
    fontFamily: fonts.displayBold,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -0.8,
    color: colors.text,
  },
  displayLg: {
    fontFamily: fonts.displayBold,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.6,
    color: colors.text,
  },
  headingLg: {
    fontFamily: fonts.display,
    fontSize: 23,
    lineHeight: 28,
    letterSpacing: -0.4,
    color: colors.text,
  },
  headingMd: {
    fontFamily: fonts.display,
    fontSize: 19,
    lineHeight: 24,
    letterSpacing: -0.3,
    color: colors.text,
  },
  headingSm: {
    fontFamily: fonts.displaySemi,
    fontSize: 16,
    lineHeight: 21,
    letterSpacing: -0.2,
    color: colors.text,
  },

  // Body / UI — Plus Jakarta Sans
  body: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 23,
    color: colors.textSecondary,
  },
  bodyStrong: {
    fontFamily: fonts.bodySemi,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
  },
  bodySm: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  bodySmStrong: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    lineHeight: 19,
    color: colors.text,
  },
  label: {
    fontFamily: fonts.bodySemi,
    fontSize: 15,
    lineHeight: 19,
    color: colors.text,
  },
  caption: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 17,
    color: colors.textMuted,
  },
  eyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 11.5,
    lineHeight: 14,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  button: {
    fontFamily: fonts.bodySemi,
    fontSize: 16,
    letterSpacing: 0.1,
  },
  tabLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 0.1,
  },
  mono: {
    // Order codes / tabular figures — system monospace reads as "receipt".
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'ui-monospace' }),
    fontSize: 14,
    letterSpacing: 0.5,
    color: colors.text,
  },
};

/** Alias kept for readability at call sites that load fonts. */
export { fonts as fontFamilies };
