import { Canvas, Group, Path } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useDerivedValue, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { inkPath, isFilled, ShapeKind, Stroke } from '../../utils/ink';

export type InkTool = { color: string; width: number; opacity: number; shape?: ShapeKind };

/** Maps stored coordinates to the screen: screen = offset + point * scale. */
export type ViewTransform = { scale: number; offsetX: number; offsetY: number };

type InkCanvasProps = {
  width: number;
  height: number;
  transform: ViewTransform;
  strokes: Stroke[];
  /** Current pen; null turns drawing off (e.g. while moving text or signatures). */
  tool: InkTool | null;
  onStrokeEnd: (stroke: Stroke) => void;
};

/**
 * Transparent drawing layer. The stroke being drawn lives in a shared value and is
 * rendered on the UI thread, so drawing stays smooth on low-end phones. Shapes (line,
 * arrow, box, redaction) keep only their start and current point while dragging.
 */
export function InkCanvas({ width, height, transform, strokes, tool, onStrokeEnd }: InkCanvasProps) {
  const live = useSharedValue<number[]>([]);
  const { scale, offsetX, offsetY } = transform;

  const color = tool?.color ?? '#000';
  const strokeWidth = tool?.width ?? 1;
  const opacity = tool?.opacity ?? 1;
  const shape = tool?.shape;
  const filled = isFilled({ shape });

  const livePath = useDerivedValue(() => inkPath(live.value, shape, strokeWidth));

  const committed = useMemo(
    () => strokes.map((s, i) => ({ key: i, path: inkPath(s.points, s.shape, s.width), stroke: s })),
    [strokes],
  );

  const pan = Gesture.Pan()
    .enabled(!!tool)
    .minDistance(0)
    .maxPointers(1)
    .onBegin((e) => {
      live.value = [(e.x - offsetX) / scale, (e.y - offsetY) / scale];
    })
    .onUpdate((e) => {
      const x = (e.x - offsetX) / scale;
      const y = (e.y - offsetY) / scale;
      live.modify((pts) => {
        'worklet';
        if (shape) {
          // Shapes: start point plus the current point only.
          pts.length = 2;
          pts.push(x, y);
        } else {
          pts.push(x, y);
        }
        return pts;
      });
    })
    .onFinalize(() => {
      const points = live.value.slice();
      live.value = [];
      // A shape needs a real drag; a tap would leave a dot-sized box.
      const minLength = shape ? 4 : 2;
      if (points.length >= minLength) {
        scheduleOnRN(onStrokeEnd, { points, color, width: strokeWidth, opacity, shape });
      }
    });

  const transformProp = [{ translateX: offsetX }, { translateY: offsetY }, { scale }];

  return (
    <GestureDetector gesture={pan}>
      <Canvas style={[StyleSheet.absoluteFill, { width, height }]}>
        <Group transform={transformProp}>
          {committed.map(({ key, path, stroke }) => (
            <Path
              key={key}
              path={path}
              style={isFilled(stroke) ? 'fill' : 'stroke'}
              strokeWidth={stroke.width}
              color={stroke.color}
              opacity={stroke.opacity}
              strokeCap="round"
              strokeJoin="round"
            />
          ))}
          <Path
            path={livePath}
            style={filled ? 'fill' : 'stroke'}
            strokeWidth={strokeWidth}
            color={color}
            opacity={opacity}
            strokeCap="round"
            strokeJoin="round"
          />
        </Group>
      </Canvas>
    </GestureDetector>
  );
}
