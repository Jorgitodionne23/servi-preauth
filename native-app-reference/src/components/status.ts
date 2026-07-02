/**
 * Maps the customer-facing OrderStatus to a display label key, badge tone, and
 * icon. Keeps status presentation in one place (mirrors the web app's
 * per-surface display-label approach).
 */
import type { BadgeTone } from './ui/Badge';
import type { FeatherName } from './ui/Icon';
import type { OrderStatus } from '@/data/types';
import type { StringKey } from '@/i18n/strings';

type StatusMeta = { labelKey: StringKey; tone: BadgeTone; icon: FeatherName };

export const STATUS_META: Record<OrderStatus, StatusMeta> = {
  pending: { labelKey: 'status.pending', tone: 'warning', icon: 'clock' },
  scheduled: { labelKey: 'status.scheduled', tone: 'info', icon: 'calendar' },
  blocked: { labelKey: 'status.blocked', tone: 'danger', icon: 'lock' },
  confirmed: { labelKey: 'status.confirmed', tone: 'accent', icon: 'credit-card' },
  assigned: { labelKey: 'status.assigned', tone: 'accent', icon: 'user-check' },
  in_progress: { labelKey: 'status.inProgress', tone: 'info', icon: 'navigation' },
  completed: { labelKey: 'status.completed', tone: 'success', icon: 'check-circle' },
  captured: { labelKey: 'status.captured', tone: 'success', icon: 'check-circle' },
  refunded: { labelKey: 'status.refunded', tone: 'neutral', icon: 'corner-up-left' },
  cancelled: { labelKey: 'status.cancelled', tone: 'neutral', icon: 'x-circle' },
};

/** Human label for the request-mode chip on order cards. */
export const MODE_ICON: Record<string, FeatherName> = {
  text: 'edit-3',
  voice: 'mic',
  photos: 'camera',
  video: 'video',
};
