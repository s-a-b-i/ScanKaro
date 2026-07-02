import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, PanResponder, StyleSheet, View } from 'react-native';

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
const FRAME_COLOR = '#00685f';
const HANDLE_COLOR = '#89f5e7';

type CropFrameEditorProps = {
  imageUri: string;
  filter: ScanFilter;
  brightness: number;
};

type CornerKey = keyof DocumentCorners;

const CORNER_KEYS: CornerKey[] = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'];

export type CropFrameEditorRef = {
  getImageCorners: () => DocumentCorners | null;
};

function CornerHandle({
  point,
  onMove,
}: {
  point: Point;
  onMove: (next: Point) => void;
}) {
  const start = useRef(point);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          start.current = point;
        },
        onPanResponderMove: (_, gesture) => {
          onMove({
            x: start.current.x + gesture.dx,
            y: start.current.y + gesture.dy,
          });
        },
      }),
    [onMove, point],
  );

  return (
    <View
      {...pan.panHandlers}
      style={[
        styles.handle,
        {
          left: point.x - HANDLE / 2,
          top: point.y - HANDLE / 2,
        },
      ]}
    >
      <View style={styles.handleInner} />
    </View>
  );
}

export const CropFrameEditor = forwardRef<CropFrameEditorRef, CropFrameEditorProps>(
  function CropFrameEditor({ imageUri, filter, brightness }, ref) {
    const [size, setSize] = useState({ width: 0, height: 0 });
    const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
    const [corners, setCorners] = useState<DocumentCorners | null>(null);

    useImperativeHandle(ref, () => ({
      getImageCorners: () => {
        if (!corners || !imageSize || !size.width || !size.height) return null;
        return mapViewCornersToImage(corners, imageSize.width, imageSize.height, size.width, size.height);
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
      setCorners(defaultDocumentCorners(size.width, size.height, 0.05));
    }, [size.height, size.width, imageUri]);

    const updateCorner = useCallback(
      (key: CornerKey, next: Point) => {
        if (!size.width || !size.height) return;
        setCorners((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            [key]: clampPoint(next, size.width, size.height, 12),
          };
        });
      },
      [size.height, size.width],
    );

    const displayCorners =
      corners ?? (size.width > 0 ? defaultDocumentCorners(size.width, size.height, 0.05) : null);

    if (!displayCorners) {
      return (
        <View style={styles.container} onLayout={onLayout}>
          <FilteredScanImage uri={imageUri} filter={filter} brightness={brightness} style={styles.imageFill} />
        </View>
      );
    }

    const { topLeft, topRight, bottomLeft, bottomRight } = displayCorners;
    const topEdgeY = (topLeft.y + topRight.y) / 2;
    const bottomEdgeY = (bottomLeft.y + bottomRight.y) / 2;
    const leftEdgeX = (topLeft.x + bottomLeft.x) / 2;
    const rightEdgeX = (topRight.x + bottomRight.x) / 2;

    return (
      <View style={styles.container} onLayout={onLayout}>
        <FilteredScanImage uri={imageUri} filter={filter} brightness={brightness} style={styles.imageFill} />

        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <View style={[styles.mask, { top: 0, left: 0, right: 0, height: Math.max(0, topEdgeY) }]} />
          <View style={[styles.mask, { top: bottomEdgeY, left: 0, right: 0, bottom: 0 }]} />
          <View style={[styles.mask, { top: topEdgeY, left: 0, width: Math.max(0, leftEdgeX), height: bottomEdgeY - topEdgeY }]} />
          <View style={[styles.mask, { top: topEdgeY, left: rightEdgeX, right: 0, height: bottomEdgeY - topEdgeY }]} />

          <View
            style={[
              styles.borderBox,
              {
                top: topEdgeY,
                left: leftEdgeX,
                width: rightEdgeX - leftEdgeX,
                height: bottomEdgeY - topEdgeY,
              },
            ]}
          />

          <View style={[styles.bracket, { top: topLeft.y - 2, left: topLeft.x - 2, borderTopWidth: 3, borderLeftWidth: 3 }]} />
          <View style={[styles.bracket, { top: topRight.y - 2, left: topRight.x - 18, borderTopWidth: 3, borderRightWidth: 3 }]} />
          <View style={[styles.bracket, { top: bottomLeft.y - 18, left: bottomLeft.x - 2, borderBottomWidth: 3, borderLeftWidth: 3 }]} />
          <View style={[styles.bracket, { top: bottomRight.y - 18, left: bottomRight.x - 18, borderBottomWidth: 3, borderRightWidth: 3 }]} />

          {CORNER_KEYS.map((key) => (
            <CornerHandle
              key={key}
              point={displayCorners[key]}
              onMove={(next) => updateCorner(key, next)}
            />
          ))}
        </View>
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
