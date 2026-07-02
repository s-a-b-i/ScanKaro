import { StyleSheet, Text, View } from 'react-native';

import { DocumentCorners, FrameRect, frameRectToCorners } from '../../utils/documentFrame';

const CORNER_SIZE = 28;
const CORNER_THICKNESS = 4;
const FRAME_COLOR = '#89f5e7';

type DocumentFrameOverlayProps = {
  frame: FrameRect;
  hint?: string;
  showHint?: boolean;
};

function Corner({
  style,
}: {
  style: {
    top: number;
    left: number;
    borderTopWidth?: number;
    borderBottomWidth?: number;
    borderLeftWidth?: number;
    borderRightWidth?: number;
  };
}) {
  return (
    <View
      style={[
        styles.corner,
        {
          top: style.top,
          left: style.left,
          borderTopWidth: style.borderTopWidth ?? 0,
          borderBottomWidth: style.borderBottomWidth ?? 0,
          borderLeftWidth: style.borderLeftWidth ?? 0,
          borderRightWidth: style.borderRightWidth ?? 0,
        },
      ]}
    />
  );
}

function cornersFromFrame(frame: FrameRect): DocumentCorners {
  return frameRectToCorners(frame);
}

export function DocumentFrameOverlay({ frame, hint, showHint = true }: DocumentFrameOverlayProps) {
  const { x, y, width, height } = frame;
  const corners = cornersFromFrame(frame);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Dimmed area outside document frame */}
      <View style={[styles.mask, { top: 0, left: 0, right: 0, height: y }]} />
      <View style={[styles.mask, { top: y + height, left: 0, right: 0, bottom: 0 }]} />
      <View style={[styles.mask, { top: y, left: 0, width: x, height }]} />
      <View style={[styles.mask, { top: y, left: x + width, right: 0, height }]} />

      {/* Thin border around detected area */}
      <View
        style={{
          position: 'absolute',
          top: y,
          left: x,
          width,
          height,
          borderWidth: 1.5,
          borderColor: 'rgba(137, 245, 231, 0.55)',
        }}
      />

      <Corner
        style={{
          top: y - 1,
          left: x - 1,
          borderTopWidth: CORNER_THICKNESS,
          borderLeftWidth: CORNER_THICKNESS,
        }}
      />
      <Corner
        style={{
          top: y - 1,
          left: x + width - CORNER_SIZE + 1,
          borderTopWidth: CORNER_THICKNESS,
          borderRightWidth: CORNER_THICKNESS,
        }}
      />
      <Corner
        style={{
          top: y + height - CORNER_SIZE + 1,
          left: x - 1,
          borderBottomWidth: CORNER_THICKNESS,
          borderLeftWidth: CORNER_THICKNESS,
        }}
      />
      <Corner
        style={{
          top: y + height - CORNER_SIZE + 1,
          left: x + width - CORNER_SIZE + 1,
          borderBottomWidth: CORNER_THICKNESS,
          borderRightWidth: CORNER_THICKNESS,
        }}
      />

      {showHint ? (
        <Text style={[styles.hint, { top: y - 36 }]}>
          {hint ?? 'Align document within the frame'}
        </Text>
      ) : null}

      {/* Edge guide lines (subtle) */}
      <View
        style={{
          position: 'absolute',
          top: corners.topLeft.y + height * 0.33,
          left: x,
          width,
          height: 1,
          backgroundColor: 'rgba(137, 245, 231, 0.15)',
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: corners.topLeft.y + height * 0.66,
          left: x,
          width,
          height: 1,
          backgroundColor: 'rgba(137, 245, 231, 0.15)',
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  mask: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.52)',
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: FRAME_COLOR,
  },
  hint: {
    position: 'absolute',
    alignSelf: 'center',
    width: '100%',
    textAlign: 'center',
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.2,
  },
});
