import { memo } from 'react';
import Svg, { Defs, Line, Mask, Polygon, Rect } from 'react-native-svg';

import { DocumentCorners } from '../../utils/documentFrame';
import { cornersToPoints } from '../../utils/documentDetection';

const GUIDE_COLOR = '#89f5e7';
const LOCKED_COLOR = '#00685f';
const CORNER_LEN = 28;

type DocumentQuadOverlayProps = {
  width: number;
  height: number;
  corners: DocumentCorners | null;
  detected?: boolean;
};

function CornerBracket({
  x,
  y,
  position,
  color,
}: {
  x: number;
  y: number;
  position: 'tl' | 'tr' | 'bl' | 'br';
  color: string;
}) {
  const sw = 4;

  if (position === 'tl') {
    return (
      <>
        <Line x1={x} y1={y} x2={x + CORNER_LEN} y2={y} stroke={color} strokeWidth={sw} strokeLinecap="round" />
        <Line x1={x} y1={y} x2={x} y2={y + CORNER_LEN} stroke={color} strokeWidth={sw} strokeLinecap="round" />
      </>
    );
  }
  if (position === 'tr') {
    return (
      <>
        <Line x1={x} y1={y} x2={x - CORNER_LEN} y2={y} stroke={color} strokeWidth={sw} strokeLinecap="round" />
        <Line x1={x} y1={y} x2={x} y2={y + CORNER_LEN} stroke={color} strokeWidth={sw} strokeLinecap="round" />
      </>
    );
  }
  if (position === 'bl') {
    return (
      <>
        <Line x1={x} y1={y} x2={x + CORNER_LEN} y2={y} stroke={color} strokeWidth={sw} strokeLinecap="round" />
        <Line x1={x} y1={y} x2={x} y2={y - CORNER_LEN} stroke={color} strokeWidth={sw} strokeLinecap="round" />
      </>
    );
  }
  return (
    <>
      <Line x1={x} y1={y} x2={x - CORNER_LEN} y2={y} stroke={color} strokeWidth={sw} strokeLinecap="round" />
      <Line x1={x} y1={y} x2={x} y2={y - CORNER_LEN} stroke={color} strokeWidth={sw} strokeLinecap="round" />
    </>
  );
}

function DocumentQuadOverlayInner({ width, height, corners, detected = false }: DocumentQuadOverlayProps) {
  if (!corners) return null;

  const points = cornersToPoints(corners);
  const { topLeft, topRight, bottomLeft, bottomRight } = corners;
  const stroke = detected ? LOCKED_COLOR : GUIDE_COLOR;

  return (
    <Svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0, zIndex: 5 }} pointerEvents="none">
      <Defs>
        <Mask id="scanDocMask">
          <Rect x={0} y={0} width={width} height={height} fill="white" />
          <Polygon points={points} fill="black" />
        </Mask>
      </Defs>

      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill={detected ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.52)'}
        mask="url(#scanDocMask)"
      />

      <Polygon
        points={points}
        fill={detected ? 'rgba(0,104,95,0.14)' : 'rgba(137,245,231,0.06)'}
        stroke={stroke}
        strokeWidth={detected ? 3.5 : 2.5}
        strokeDasharray={detected ? undefined : '10 8'}
        strokeLinejoin="round"
      />

      <CornerBracket x={topLeft.x} y={topLeft.y} position="tl" color={stroke} />
      <CornerBracket x={topRight.x} y={topRight.y} position="tr" color={stroke} />
      <CornerBracket x={bottomLeft.x} y={bottomLeft.y} position="bl" color={stroke} />
      <CornerBracket x={bottomRight.x} y={bottomRight.y} position="br" color={stroke} />
    </Svg>
  );
}

export const DocumentQuadOverlay = memo(DocumentQuadOverlayInner);
