import { ComponentProps, useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Icon } from '../Icon';

const THUMB = 22;
const ACCENT = '#ffffff';

type LightSliderProps = {
  icon: ComponentProps<typeof Icon>['name'];
  label: string;
  /** -1..1, 0 in the middle. */
  value: number;
  /** Called when the user lets go (or taps the track): commit the value. */
  onChangeEnd: (value: number) => void;
};

/** Centred -100..+100 slider for lighting controls. Dragging runs on the UI thread. */
export function LightSlider({ icon, label, value, onChangeEnd }: LightSliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const [display, setDisplay] = useState(value);
  const pos = useSharedValue(value);
  const start = useSharedValue(0);

  useEffect(() => {
    pos.value = value;
    setDisplay(value);
  }, [value, pos]);

  const toValue = (x: number, width: number) => {
    'worklet';
    if (width <= 0) return 0;
    const v = (x / width) * 2 - 1;
    // Snap near the centre so "unchanged" is easy to hit.
    const clamped = Math.max(-1, Math.min(1, v));
    return Math.abs(clamped) < 0.04 ? 0 : clamped;
  };

  const pan = Gesture.Pan()
    .onBegin((e) => {
      pos.value = toValue(e.x, trackWidth);
      start.value = pos.value;
      scheduleOnRN(setDisplay, pos.value);
    })
    .onUpdate((e) => {
      pos.value = toValue(e.x, trackWidth);
      scheduleOnRN(setDisplay, pos.value);
    })
    .onFinalize(() => {
      scheduleOnRN(onChangeEnd, pos.value);
    });

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: ((pos.value + 1) / 2) * trackWidth - THUMB / 2 }],
  }));
  const fillStyle = useAnimatedStyle(() => {
    const centre = trackWidth / 2;
    const x = ((pos.value + 1) / 2) * trackWidth;
    return { left: Math.min(centre, x), width: Math.abs(x - centre) };
  });

  const onLayout = (e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width);
  const shown = Math.round(display * 100);

  return (
    <View className="flex-row items-center gap-3 px-5 py-2">
      <Icon name={icon} size={20} className="text-white/80" />
      <View className="w-[78px]">
        <Text className="font-inter-medium text-[12px] text-white/80">{label}</Text>
        <Text className="font-inter-semibold text-[13px] text-white">{shown > 0 ? `+${shown}` : shown}</Text>
      </View>
      <GestureDetector gesture={pan}>
        <View className="h-10 flex-1 justify-center" onLayout={onLayout} hitSlop={{ top: 8, bottom: 8 }}>
          <View className="h-1 rounded-full bg-white/20" />
          <View className="absolute left-1/2 h-3 w-0.5 -translate-x-px bg-white/50" />
          <Animated.View className="absolute h-1 rounded-full" style={[{ backgroundColor: ACCENT }, fillStyle]} />
          <Animated.View
            className="absolute rounded-full bg-white"
            style={[{ width: THUMB, height: THUMB, borderWidth: 3, borderColor: ACCENT }, thumbStyle]}
          />
        </View>
      </GestureDetector>
      <Pressable
        onPress={() => onChangeEnd(0)}
        hitSlop={8}
        disabled={value === 0}
        className={value === 0 ? 'opacity-30' : 'active:opacity-60'}
        accessibilityLabel={`Reset ${label}`}
      >
        <Icon name="restart-alt" size={20} className="text-white/80" />
      </Pressable>
    </View>
  );
}
