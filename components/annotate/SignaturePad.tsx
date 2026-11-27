import { useState } from 'react';
import { Alert, LayoutChangeEvent, Modal, Pressable, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { saveSignature, SavedSignature } from '../../services/signatures';
import { renderSignaturePng, Stroke } from '../../utils/ink';
import { Icon } from '../Icon';
import { InkCanvas } from './InkCanvas';

const PEN = { color: '#10182b', width: 3.2, opacity: 1 };

type SignaturePadProps = {
  visible: boolean;
  onSaved: (signature: SavedSignature) => void;
  onCancel: () => void;
};

/** Draw a signature with a finger; saved as a transparent PNG for reuse. */
export function SignaturePad({ visible, onSaved, onCancel }: SignaturePadProps) {
  const insets = useSafeAreaInsets();
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  };

  const save = () => {
    const png = renderSignaturePng(strokes);
    if (!png) {
      Alert.alert('Sign first', 'Draw your signature in the box.');
      return;
    }
    const saved = saveSignature(png);
    setStrokes([]);
    onSaved(saved);
  };

  const cancel = () => {
    setStrokes([]);
    onCancel();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={cancel} statusBarTranslucent>
      {/* Modals render outside the app root on Android: gestures need their own root here. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
      <View className="flex-1 bg-background px-5" style={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }}>
        <View className="mb-4 flex-row items-center justify-between">
          <Pressable accessibilityLabel="Close" onPress={cancel} hitSlop={8} className="h-11 w-11 items-center justify-center rounded-full bg-surface-container">
            <Icon name="close" size={22} className="text-on-surface" />
          </Pressable>
          <Text className="font-inter-semibold text-[17px] text-on-surface">New signature</Text>
          <Pressable
            onPress={() => setStrokes((s) => s.slice(0, -1))}
            disabled={strokes.length === 0}
            hitSlop={8}
            accessibilityLabel="Undo"
            className={`h-11 w-11 items-center justify-center rounded-full bg-surface-container ${strokes.length ? '' : 'opacity-30'}`}
          >
            <Icon name="undo" size={22} className="text-on-surface" />
          </Pressable>
        </View>

        <Text className="mb-3 font-inter text-[14px] text-on-surface-variant">Sign with your finger inside the box.</Text>

        {/* Always white, so the signature looks the same on paper in light and dark mode. */}
        <View className="h-64 overflow-hidden rounded-3xl bg-white" onLayout={onLayout}>
          <View className="absolute bottom-14 left-6 right-6 h-px bg-[#c9ccd3]" />
          <Text className="absolute bottom-6 left-6 font-inter text-[12px] text-[#8a8f99]">Sign above the line</Text>
          {size.width > 0 ? (
            <InkCanvas
              width={size.width}
              height={size.height}
              transform={{ scale: 1, offsetX: 0, offsetY: 0 }}
              strokes={strokes}
              tool={PEN}
              onStrokeEnd={(s) => setStrokes((current) => [...current, s])}
            />
          ) : null}
        </View>

        <View className="flex-1" />
        <View className="flex-row gap-3">
          <Pressable
            onPress={() => setStrokes([])}
            className="h-14 flex-1 items-center justify-center rounded-full border border-outline-variant active:bg-surface-container"
          >
            <Text className="font-inter-semibold text-[16px] text-on-surface">Clear</Text>
          </Pressable>
          <Pressable
            onPress={save}
            className="h-14 flex-[2] items-center justify-center rounded-full bg-on-surface active:opacity-85"
          >
            <Text className="font-inter-semibold text-[16px] text-surface">Save signature</Text>
          </Pressable>
        </View>
      </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
