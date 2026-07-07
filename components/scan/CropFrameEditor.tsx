import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { SharedValue, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { FilteredScanImage } from './FilteredScanImage';
import {
  clampPoint,
  defaultDocumentCorners,
  DocumentCorners,
  Point,
} from '../../utils/documentFrame';
import { mapViewCornersToImage } from '../../utils/documentDetection';
import { getImageSizeFromUri } from '../../utils/documentScan';
import { ScanFilter } from '../../utils/scanFilters';

const HANDLE = 22;
const HANDLE_PADDING = 12;
const FRAME_COLOR = '#00685f';
const HANDLE_COLOR = '#89f5e7';

type CropFrameEditorProps = {
  imageUri: string;
  filter: ScanFilter;
  brightness: number;
  bottomSafeInset?: number;
};

type CornerKey = keyof DocumentCorners;

const CORNER_KEYS: CornerKey[] = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'];

export type CropFrameEditorRef = {
  getImageCorners: () => DocumentCorners | null;
};

/** Corner handle — drag runs entirely on the UI thread via a shared value, no JS re-render per frame. */
function CornerHandle({
  point,
  width,
  height,
  bottomSafeInset,
}: {
  point: SharedValue<Point>;
  width: number;
  height: number;
  bottomSafeInset: number;
}) {
  const start = useSharedValue<Point>({ x: 0, y: 0 });

  const pan = Gesture.Pan()
    .onStart(() => {
      start.value = { x: point.value.x, y: point.value.y };
    })
    .onUpdate((event) => {
      point.value = clampPoint(
        { x: start.value.x + event.translationX, y: start.value.y + event.translationY },
        width,
        height,
        HANDLE_PADDING,
        bottomSafeInset,
      );
    });

  const style = useAnimatedStyle(() => ({
    left: point.value.x - HANDLE / 2,
    top: point.value.y - HANDLE / 2,
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.handle, style]}>
        <View style={styles.handleInner} />
      </Animated.View>
    </GestureDetector>
  );
}

export const CropFrameEditor = forwardRef<CropFrameEditorRef, CropFrameEditorProps>(
  function CropFrameEditor({ imageUri, filter, brightness, bottomSafeInset = 0 }, ref) {
    const [size, setSize] = useState({ width: 0, height: 0 });
    const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
    const [ready, setReady] = useState(false);

    const topLeft = useSharedValue<Point>({ x: 0, y: 0 });
    const topRight = useSharedValue<Point>({ x: 0, y: 0 });
    const bottomLeft = useSharedValue<Point>({ x: 0, y: 0 });
    const bottomRight = useSharedValue<Point>({ x: 0, y: 0 });

    const corners: Record<CornerKey, SharedValue<Point>> = {
      topLeft,
      topRight,
      bottomLeft,
      bottomRight,
    };

    useImperativeHandle(ref, () => ({
      getImageCorners: () => {
        if (!ready || !imageSize || !size.width || !size.height) return null;
        const current: DocumentCorners = {
          topLeft: topLeft.value,
          topRight: topRight.value,
          bottomLeft: bottomLeft.value,
          bottomRight: bottomRight.value,
        };
        return mapViewCornersToImage(current, imageSize.width, imageSize.height, size.width, size.height);
      },
    }));

    const onLayout = useCallback((event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      setSize({ width, height });
    }, []);

    useEffect(() => {
      let cancelled = false;
      void getImageSizeFromUri(imageUri).then((dims) => {
        if (!cancelled) setImageSize(dims);
      });
      return () => {
        cancelled = true;
      };
    }, [imageUri]);

    useEffect(() => {
      if (size.width <= 0 || size.height <= 0) return;
      const initial = defaultDocumentCorners(size.width, size.height, 0.05, bottomSafeInset);
      topLeft.value = initial.topLeft;
      topRight.value = initial.topRight;
      bottomLeft.value = initial.bottomLeft;
      bottomRight.value = initial.bottomRight;
      setReady(true);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [size.height, size.width, imageUri, bottomSafeInset]);

    const maskTopStyle = useAnimatedStyle(() => {
      const topEdgeY = (topLeft.value.y + topRight.value.y) / 2;
      return { top: 0, left: 0, right: 0, height: Math.max(0, topEdgeY) };
    });
    const maskBottomStyle = useAnimatedStyle(() => {
      const bottomEdgeY = (bottomLeft.value.y + bottomRight.value.y) / 2;
      return { top: bottomEdgeY, left: 0, right: 0, bottom: 0 };
    });
    const maskLeftStyle = useAnimatedStyle(() => {
      const topEdgeY = (topLeft.value.y + topRight.value.y) / 2;
      const bottomEdgeY = (bottomLeft.value.y + bottomRight.value.y) / 2;
      const leftEdgeX = (topLeft.value.x + bottomLeft.value.x) / 2;
      return { top: topEdgeY, left: 0, width: Math.max(0, leftEdgeX), height: bottomEdgeY - topEdgeY };
    });
    const maskRightStyle = useAnimatedStyle(() => {
      const topEdgeY = (topLeft.value.y + topRight.value.y) / 2;
      const bottomEdgeY = (bottomLeft.value.y + bottomRight.value.y) / 2;
      const rightEdgeX = (topRight.value.x + bottomRight.value.x) / 2;
      return { top: topEdgeY, left: rightEdgeX, right: 0, height: bottomEdgeY - topEdgeY };
    });
    const borderBoxStyle = useAnimatedStyle(() => {
      const topEdgeY = (topLeft.value.y + topRight.value.y) / 2;
      const bottomEdgeY = (bottomLeft.value.y + bottomRight.value.y) / 2;
      const leftEdgeX = (topLeft.value.x + bottomLeft.value.x) / 2;
      const rightEdgeX = (topRight.value.x + bottomRight.value.x) / 2;
      return {
        top: topEdgeY,
        left: leftEdgeX,
        width: rightEdgeX - leftEdgeX,
        height: bottomEdgeY - topEdgeY,
      };
    });
    const bracketTLStyle = useAnimatedStyle(() => ({ top: topLeft.value.y - 2, left: topLeft.value.x - 2 }));
    const bracketTRStyle = useAnimatedStyle(() => ({ top: topRight.value.y - 2, left: topRight.value.x - 18 }));
    const bracketBLStyle = useAnimatedStyle(() => ({ top: bottomLeft.value.y - 18, left: bottomLeft.value.x - 2 }));
    const bracketBRStyle = useAnimatedStyle(() => ({
      top: bottomRight.value.y - 18,
      left: bottomRight.value.x - 18,
    }));

    return (
      <View style={styles.container} onLayout={onLayout}>
        <FilteredScanImage uri={imageUri} filter={filter} brightness={brightness} style={styles.imageFill} />

        {ready && size.width > 0 ? (
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            <Animated.View style={[styles.mask, maskTopStyle]} />
            <Animated.View style={[styles.mask, maskBottomStyle]} />
            <Animated.View style={[styles.mask, maskLeftStyle]} />
            <Animated.View style={[styles.mask, maskRightStyle]} />

            <Animated.View style={[styles.borderBox, borderBoxStyle]} />

            <Animated.View style={[styles.bracket, { borderTopWidth: 3, borderLeftWidth: 3 }, bracketTLStyle]} />
            <Animated.View style={[styles.bracket, { borderTopWidth: 3, borderRightWidth: 3 }, bracketTRStyle]} />
            <Animated.View
              style={[styles.bracket, { borderBottomWidth: 3, borderLeftWidth: 3 }, bracketBLStyle]}
            />
            <Animated.View
              style={[styles.bracket, { borderBottomWidth: 3, borderRightWidth: 3 }, bracketBRStyle]}
            />

            {CORNER_KEYS.map((key) => (
              <CornerHandle
                key={key}
                point={corners[key]}
                width={size.width}
                height={size.height}
                bottomSafeInset={bottomSafeInset}
              />
            ))}
          </View>
        ) : null}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: '#cbd5e1',
  },
  imageFill: {
    ...StyleSheet.absoluteFillObject,
  },
  mask: {
    position: 'absolute',
    backgroundColor: 'rgba(203, 213, 225, 0.72)',
  },
  borderBox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: FRAME_COLOR,
  },
  bracket: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: FRAME_COLOR,
  },
  handle: {
    position: 'absolute',
    width: HANDLE,
    height: HANDLE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: HANDLE_COLOR,
    borderWidth: 2,
    borderColor: FRAME_COLOR,
  },
});
