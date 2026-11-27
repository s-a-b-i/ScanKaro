import { ReactNode } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { ViewTransform } from './InkCanvas';

type DraggableMarkProps = {
  /** Top-left in page-image pixels. */
  x: number;
  y: number;
  transform: ViewTransform;
  selected: boolean;
  onSelect: () => void;
  /** New top-left in page-image pixels. */
  onMove: (x: number, y: number) => void;
  children: ReactNode;
};

/** A text or signature placed on the page: tap to select, drag to move. */
export function DraggableMark({ x, y, transform, selected, onSelect, onMove, children }: DraggableMarkProps) {
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  const { scale, offsetX, offsetY } = transform;

  const pan = Gesture.Pan()
    .onBegin(() => {
      scheduleOnRN(onSelect);
    })
    .onUpdate((e) => {
      dx.value = e.translationX;
      dy.value = e.translationY;
    })
    .onEnd((e) => {
      scheduleOnRN(onMove, x + e.translationX / scale, y + e.translationY / scale);
    })
    .onFinalize(() => {
      dx.value = 0;
      dy.value = 0;
    });

  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    left: offsetX + x * scale,
    top: offsetY + y * scale,
    transform: [{ translateX: dx.value }, { translateY: dy.value }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[
          style,
          selected ? { borderWidth: 1.5, borderColor: '#ffffff', borderStyle: 'dashed', borderRadius: 6 } : null,
        ]}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
