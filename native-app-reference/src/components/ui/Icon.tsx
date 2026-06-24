/**
 * Icon — thin wrapper over Feather (@expo/vector-icons), matching the web app's
 * 1.7px-stroke Feather/Lucide aesthetic. Exposing a `FeatherName` type lets the
 * catalog reference icons in a type-safe way.
 */
import Feather from '@expo/vector-icons/Feather';
import { colors } from '@/theme/tokens';
import type { ComponentProps } from 'react';

export type FeatherName = ComponentProps<typeof Feather>['name'];

type Props = {
  name: FeatherName;
  size?: number;
  color?: string;
};

export function Icon({ name, size = 22, color = colors.text }: Props) {
  return <Feather name={name} size={size} color={color} />;
}
