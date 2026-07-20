/**
 * BottomSheet — backdrop + slide-up sheet for pickers (service, address,
 * language). Uses RN Modal (works on web via react-native-web) with a
 * Reanimated slide-up entrance.
 */
import { ReactNode } from 'react';
import { Modal, Pressable, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Txt } from './Text';
import { Icon } from './Icon';
import { PressableScale } from './Pressable';
import { colors, layout, radius, spacing } from '@/theme/tokens';

export function BottomSheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View entering={FadeIn.duration(180)} style={{ flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <Animated.View
          entering={SlideInDown.springify().damping(20).mass(0.7)}
          style={{
            backgroundColor: colors.bgElevated,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            paddingHorizontal: layout.screenPaddingX,
            paddingTop: spacing.md,
            paddingBottom: insets.bottom + spacing.lg,
            maxHeight: '85%',
            width: '100%',
            maxWidth: layout.maxContentWidth,
            alignSelf: 'center',
          }}
        >
          <View style={{ alignItems: 'center', marginBottom: spacing.md }}>
            <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: colors.border }} />
          </View>
          {title ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
              <Txt variant="headingMd">{title}</Txt>
              <PressableScale
                onPress={onClose}
                hitSlop={layout.hitSlop}
                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}
              >
                <Icon name="x" size={18} color={colors.text} />
              </PressableScale>
            </View>
          ) : null}
          {children}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
