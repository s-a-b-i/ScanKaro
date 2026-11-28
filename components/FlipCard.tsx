/**
 * A business card you can flip: tap (or the Flip button) and it turns over in 3D to show
 * the other side. Sits slightly tilted with a soft shadow, like a card on a desk.
 */
import { useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, Text, View } from 'react-native';

import { useTheme } from '../constants/theme';
import { Icon } from './Icon';

type Props = {
  front?: string;
  back?: string;
  /** Card aspect ratio (width / height). */
  ratio: number;
  /** Show the "Front · Tap to flip" caption under the card. */
  caption?: boolean;
};

export function FlipCard({ front, back, ratio, caption = true }: Props) {
  const { colors } = useTheme();
  const flip = useRef(new Animated.Value(0)).current;
  const [showingBack, setShowingBack] = useState(false);

  const toggle = () => {
    const next = !showingBack;
    setShowingBack(next);
    Animated.timing(flip, {
      toValue: next ? 1 : 0,
      duration: 650,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  // Lift the card a little mid-flip, like a hand turning it over.
  const lift = flip.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.06, 1] });
  const face = (side: 'front' | 'back') => ({
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 10,
    overflow: 'hidden' as const,
    backfaceVisibility: 'hidden' as const,
    opacity:
      side === 'front'
        ? flip.interpolate({ inputRange: [0, 0.5, 0.501, 1], outputRange: [1, 1, 0, 0] })
        : flip.interpolate({ inputRange: [0, 0.5, 0.501, 1], outputRange: [0, 0, 1, 1] }),
    transform: [
      { perspective: 1400 },
      { rotateX: '8deg' },
      {
        rotateY:
          side === 'front'
            ? flip.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] })
            : flip.interpolate({ inputRange: [0, 1], outputRange: ['-180deg', '0deg'] }),
      },
      { scale: lift },
    ],
  });

  return (
    <View>
      <Pressable onPress={toggle} accessibilityRole="button" accessibilityLabel={`Card ${showingBack ? 'back' : 'front'}. Tap to flip.`}>
        <View style={{ aspectRatio: ratio }}>
          {/* Shadow on its own layer: it narrows and fades as the card turns edge-on, so no
              full-size shadow is left standing behind the card mid-flip. */}
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              borderRadius: 10,
              backgroundColor: colors.background,
              shadowColor: '#000',
              shadowOpacity: 0.28,
              shadowRadius: 22,
              shadowOffset: { width: 0, height: 16 },
              elevation: 10,
              opacity: flip.interpolate({ inputRange: [0, 0.35, 0.5, 0.65, 1], outputRange: [1, 0.2, 0, 0.2, 1] }),
              transform: [
                { perspective: 1400 },
                { rotateX: '8deg' },
                { scaleX: flip.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.02, 1] }) },
              ],
            }}
          />
          <Animated.View style={face('front')}>
            {front ? <Image source={{ uri: front }} style={{ width: '100%', height: '100%' }} /> : <View className="flex-1 bg-surface-container" />}
          </Animated.View>
          <Animated.View style={face('back')}>
            {back ? <Image source={{ uri: back }} style={{ width: '100%', height: '100%' }} /> : <View className="flex-1 bg-surface-container" />}
          </Animated.View>
        </View>
      </Pressable>
      {caption ? (
        <Pressable onPress={toggle} hitSlop={8} className="mt-4 flex-row items-center justify-center gap-1.5 self-center rounded-full bg-surface-container px-3.5 py-2 active:opacity-70">
          <Icon name="flip" size={16} className="text-on-surface" />
          <Text className="font-inter-semibold text-[13px] text-on-surface">{showingBack ? 'Back' : 'Front'} · Tap to flip</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
