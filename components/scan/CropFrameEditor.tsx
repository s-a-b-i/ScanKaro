import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';
import { Image, LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { SharedValue, useAnimatedProps, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { clampPoint, DocumentCorners, Point } from '../../utils/documentFrame';
import { mapViewCornersToImage } from '../../utils/documentDetection';
import { getImageSizeFromUri } from '../../utils/documentScan';

const FRAME_COLOR = '#ffffff';
const HANDLE_TOUCH = 44;
const CORNER_DOT = 18;
const EDGE_PILL_LONG = 26;
const EDGE_PILL_SHORT = 8;
const PADDING = 4;

const AnimatedPath = Animated.createAnimatedComponent(Path);

type CropFrameEditorProps = {
  imageUri: string;
  /** Detected page edges in image pixels; the frame starts on them instead of the whole page. */
  initialImageCorners?: DocumentCorners | null;
};

export type CropFrameEditorRef = {
  getImageCorners: () => DocumentCorners | null;
  /** True while the frame still sits on the whole image (nothing to crop). */
  isFullPage: () => boolean;
  /** Moves the frame to the given page edges (image pixels), or to the whole image when null. */
  setFrame: (corners: DocumentCorners | null) => void;
};

/** Where an image sits inside a box with resizeMode "contain". */
function fitRect(imageWidth: number, imageHeight: number, boxWidth: number, boxHeight: number) {
  const scale = Math.min(boxWidth / imageWidth, boxHeight / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  return { x: (boxWidth - width) / 2, y: (boxHeight - height) / 2, width, height };
}

type Bounds = { width: number; height: number };

/** Corner handle: drag runs on the UI thread through a shared value (no re-render per frame). */
function CornerHandle({ point, bounds }: { point: SharedValue<Point>; bounds: Bounds }) {
  const start = useSharedValue<Point>({ x: 0, y: 0 });
  const pan = Gesture.Pan()
    .onStart(() => {
      start.value = point.value;
    })
    .onUpdate((e) => {
      point.value = clampPoint(
        { x: start.value.x + e.translationX, y: start.value.y + e.translationY },
        bounds.width,
        bounds.height,
        PADDING,
      );
    });

  const style = useAnimatedStyle(() => ({
    left: point.value.x - HANDLE_TOUCH / 2,
    top: point.value.y - HANDLE_TOUCH / 2,
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.touch, style]}>
        <View style={styles.cornerDot} />
      </Animated.View>
    </GestureDetector>
  );
}

/** Side handle: drags a whole edge (both of its corners) along one axis. */
function EdgeHandle({
  a,
  b,
  axis,
  bounds,
}: {
  a: SharedValue<Point>;
  b: SharedValue<Point>;
  axis: 'x' | 'y';
  bounds: Bounds;
}) {
  const startA = useSharedValue<Point>({ x: 0, y: 0 });
  const startB = useSharedValue<Point>({ x: 0, y: 0 });
  const pan = Gesture.Pan()
    .onStart(() => {
      startA.value = a.value;
      startB.value = b.value;
    })
    .onUpdate((e) => {
      const dx = axis === 'x' ? e.translationX : 0;
      const dy = axis === 'y' ? e.translationY : 0;
      a.value = clampPoint({ x: startA.value.x + dx, y: startA.value.y + dy }, bounds.width, bounds.height, PADDING);
      b.value = clampPoint({ x: startB.value.x + dx, y: startB.value.y + dy }, bounds.width, bounds.height, PADDING);
    });

  const style = useAnimatedStyle(() => ({
    left: (a.value.x + b.value.x) / 2 - HANDLE_TOUCH / 2,
    top: (a.value.y + b.value.y) / 2 - HANDLE_TOUCH / 2,
  }));

  const pill =
    axis === 'x'
      ? { width: EDGE_PILL_SHORT, height: EDGE_PILL_LONG }
      : { width: EDGE_PILL_LONG, height: EDGE_PILL_SHORT };

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.touch, style]}>
        <View style={[styles.edgePill, pill]} />
      </Animated.View>
    </GestureDetector>
  );
}

export const CropFrameEditor = forwardRef<CropFrameEditorRef, CropFrameEditorProps>(function CropFrameEditor(
  { imageUri, initialImageCorners },
  ref,
) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [ready, setReady] = useState(false);

  const topLeft = useSharedValue<Point>({ x: 0, y: 0 });
  const topRight = useSharedValue<Point>({ x: 0, y: 0 });
  const bottomLeft = useSharedValue<Point>({ x: 0, y: 0 });
  const bottomRight = useSharedValue<Point>({ x: 0, y: 0 });

  /** Places the frame: on `corners` (image pixels) or on the whole image. */
  const placeFrame = useCallback(
    (corners: DocumentCorners | null | undefined) => {
      if (!imageSize || size.width <= 0 || size.height <= 0) return;
      const rect = fitRect(imageSize.width, imageSize.height, size.width, size.height);
      if (corners) {
        const k = rect.width / imageSize.width;
        const toView = (p: Point) => ({ x: rect.x + p.x * k, y: rect.y + p.y * k });
        topLeft.value = toView(corners.topLeft);
        topRight.value = toView(corners.topRight);
        bottomLeft.value = toView(corners.bottomLeft);
        bottomRight.value = toView(corners.bottomRight);
      } else {
        topLeft.value = { x: rect.x, y: rect.y };
        topRight.value = { x: rect.x + rect.width, y: rect.y };
        bottomLeft.value = { x: rect.x, y: rect.y + rect.height };
        bottomRight.value = { x: rect.x + rect.width, y: rect.y + rect.height };
      }
    },
    // Shared values are stable refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [imageSize, size.width, size.height],
  );

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
    isFullPage: () => {
      if (!ready || !imageSize || !size.width || !size.height) return true;
      const rect = fitRect(imageSize.width, imageSize.height, size.width, size.height);
      const near = (p: Point, x: number, y: number) => Math.abs(p.x - x) <= 4 && Math.abs(p.y - y) <= 4;
      return (
        near(topLeft.value, rect.x, rect.y) &&
        near(topRight.value, rect.x + rect.width, rect.y) &&
        near(bottomLeft.value, rect.x, rect.y + rect.height) &&
        near(bottomRight.value, rect.x + rect.width, rect.y + rect.height)
      );
    },
    setFrame: (corners) => placeFrame(corners),
  }));

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setImageSize(null);
    void getImageSizeFromUri(imageUri).then((dims) => {
      if (!cancelled) setImageSize(dims);
    });
    return () => {
      cancelled = true;
    };
  }, [imageUri]);

  useEffect(() => {
    if (!imageSize || size.width <= 0 || size.height <= 0) return;
    // Imported photos start on the detected page; already-cropped scans on the whole image.
    placeFrame(initialImageCorners);
    setReady(true);
  }, [imageSize, size.width, size.height, initialImageCorners, placeFrame]);

  const quad = () => {
    'worklet';
    return `M${topLeft.value.x},${topLeft.value.y} L${topRight.value.x},${topRight.value.y} L${bottomRight.value.x},${bottomRight.value.y} L${bottomLeft.value.x},${bottomLeft.value.y} Z`;
  };

  // Dim everything outside the page (even-odd fill: full box minus the quad).
  const maskProps = useAnimatedProps(() => ({
    d: `M0,0 H${size.width} V${size.height} H0 Z ${quad()}`,
  }));
  const frameProps = useAnimatedProps(() => ({ d: quad() }));

  const bounds = { width: size.width, height: size.height };

  return (
    <View style={styles.container} onLayout={onLayout}>
      <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} resizeMode="contain" />

      {ready && size.width > 0 ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <Svg width={size.width} height={size.height} style={StyleSheet.absoluteFill} pointerEvents="none">
            <AnimatedPath animatedProps={maskProps} fill="rgba(0,0,0,0.55)" fillRule="evenodd" />
            <AnimatedPath animatedProps={frameProps} fill="none" stroke={FRAME_COLOR} strokeWidth={2} />
          </Svg>

          <EdgeHandle a={topLeft} b={topRight} axis="y" bounds={bounds} />
          <EdgeHandle a={bottomLeft} b={bottomRight} axis="y" bounds={bounds} />
          <EdgeHandle a={topLeft} b={bottomLeft} axis="x" bounds={bounds} />
          <EdgeHandle a={topRight} b={bottomRight} axis="x" bounds={bounds} />

          <CornerHandle point={topLeft} bounds={bounds} />
          <CornerHandle point={topRight} bounds={bounds} />
          <CornerHandle point={bottomLeft} bounds={bounds} />
          <CornerHandle point={bottomRight} bounds={bounds} />
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  touch: {
    position: 'absolute',
    width: HANDLE_TOUCH,
    height: HANDLE_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cornerDot: {
    width: CORNER_DOT,
    height: CORNER_DOT,
    borderRadius: CORNER_DOT / 2,
    backgroundColor: '#ffffff',
    borderWidth: 3,
    borderColor: FRAME_COLOR,
  },
  edgePill: {
    borderRadius: 4,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: FRAME_COLOR,
  },
});
