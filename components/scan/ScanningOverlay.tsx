import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Image, LayoutChangeEvent, Modal, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

type ScanningOverlayProps = {
  visible: boolean;
  /** Page shown under the moving scan line. */
  imageUri?: string | null;
  message?: string;
};

/** Full-screen "processing" state: the page with a glowing line sweeping over it. */
export function ScanningOverlay({ visible, imageUri, message = 'Processing…' }: ScanningOverlayProps) {
  const [box, setBox] = useState({ width: 0, height: 0 });
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    progress.value = 0;
    progress.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }), -1, true);
    return () => cancelAnimation(progress);
  }, [visible, progress]);

  const lineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: progress.value * Math.max(0, box.height - 48) }],
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox({ width, height });
  };

  if (!visible) return null;

  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.page} onLayout={onLayout}>
          {imageUri ? <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} resizeMode="contain" /> : null}
          {box.height > 0 ? (
            <Animated.View style={[styles.line, lineStyle]}>
              <LinearGradient
                colors={['rgba(63,193,177,0)', 'rgba(63,193,177,0.45)', 'rgba(63,193,177,0)']}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.lineCore} />
            </Animated.View>
          ) : null}
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{message}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(8,9,11,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  page: {
    width: '100%',
    flex: 1,
    maxHeight: 560,
    overflow: 'hidden',
  },
  line: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 48,
    justifyContent: 'center',
  },
  lineCore: {
    height: 2,
    backgroundColor: '#ffffff',
  },
  badge: {
    marginTop: 24,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  badgeText: {
    color: '#ffffff',
    fontFamily: 'InterTight_600SemiBold',
    fontSize: 14,
  },
});
