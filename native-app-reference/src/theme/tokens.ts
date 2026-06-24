/**
 * SERVI design tokens — native mirror of the web design system.
 *
 * Ported from `frontend/shared/shared-styles.css` (`:root` custom properties)
 * and the Smart Request token table in
 * `frontend/design_handoff_smart_request/README.md`.
 *
 * Philosophy: ink-forward + restrained teal accent, generous whitespace,
 * Uber/Airbnb-caliber. Black is the primary action color; teal is the accent.
 */
import { Platform } from 'react-native';

export const colors = {
  // Surfaces
  bg: '#fafbfb',
  bgElevated: '#ffffff',
  surface: '#f3f6f6',
  surface2: '#f5f5f5',
  card: '#ffffff',

  // Text
  text: '#101213',
  textSecondary: '#5b6166',
  textMuted: '#6c7378', // darkened from #8d9498 to clear WCAG AA (~4.6:1 on bg)
  textInverse: '#ffffff',

  // Borders
  border: '#e7eaea',
  borderInput: '#dde1e1',
  borderStrong: '#d0d0d0',

  // Primary action (ink)
  ink: '#101213',
  inkHover: '#1d2123',

  // Accent (teal) — used sparingly for selection / focus / brand moments
  accent: '#7fc4cf',
  accentDeep: '#3f8e9d',
  accentTint: '#eaf5f7',
  accentInk: '#16414a',

  // Semantic — `*Ink` variants are darker, AA-passing text colors on the tints;
  // the brighter base hues are kept for dots/icon fills.
  success: '#1f9d57',
  successTint: '#e6f5ec',
  successInk: '#15683a',
  danger: '#dc3545',
  dangerTint: '#fdecee',
  dangerInk: '#b3202e',
  warning: '#c98a23',
  warningTint: '#fbf2e0',
  warningInk: '#7a4f08',
  info: '#3f8e9d',

  // Misc
  scrim: 'rgba(16,18,19,0.45)',
  shimmer: '#eef1f1',
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 9999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
} as const;

/** Soft card lift — matches `--shadow-card`. iOS uses shadow*, Android elevation. */
export const shadow = {
  card: Platform.select({
    ios: {
      shadowColor: '#101213',
      shadowOpacity: 0.08,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
    },
    android: { elevation: 3 },
    default: {
      // react-native-web understands boxShadow
      boxShadow: '0 8px 24px -16px rgba(16,18,19,0.18)',
    },
  }),
  soft: Platform.select({
    ios: {
      shadowColor: '#101213',
      shadowOpacity: 0.06,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
    },
    android: { elevation: 2 },
    default: { boxShadow: '0 2px 10px rgba(16,18,19,0.08)' },
  }),
  raised: Platform.select({
    ios: {
      shadowColor: '#101213',
      shadowOpacity: 0.16,
      shadowRadius: 28,
      shadowOffset: { width: 0, height: 18 },
    },
    android: { elevation: 8 },
    default: { boxShadow: '0 18px 40px -16px rgba(16,18,19,0.22)' },
  }),
} as const;

/** Spring easing — mirrors the web `--ease-spring` cubic-bezier(0.16,1,0.3,1). */
export const motion = {
  durationFast: 180,
  durationNormal: 280,
  durationSlow: 420,
  // Reanimated Easing.bezier args
  springBezier: [0.16, 1, 0.3, 1] as const,
} as const;

export const layout = {
  screenPaddingX: 20,
  maxContentWidth: 520, // keep phone-width feel even on wide web viewports
  tabBarHeight: 64,
  hitSlop: { top: 8, bottom: 8, left: 8, right: 8 },
} as const;

export type ColorToken = keyof typeof colors;
