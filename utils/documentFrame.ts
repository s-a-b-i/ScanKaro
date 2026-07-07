export type Point = { x: number; y: number };

export type DocumentCorners = {
  topLeft: Point;
  topRight: Point;
  bottomLeft: Point;
  bottomRight: Point;
};

export type FrameRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function getScanFrameRect(
  screenWidth: number,
  screenHeight: number,
  topInset: number,
  bottomReserved: number,
): FrameRect {
  const width = screenWidth * 0.86;
  const availableHeight = screenHeight - topInset - bottomReserved;
  const height = Math.min(availableHeight * 0.72, width * 1.38);
  const x = (screenWidth - width) / 2;
  const y = topInset + (availableHeight - height) * 0.42;

  return { x, y, width, height };
}

export function frameRectToCorners(rect: FrameRect): DocumentCorners {
  const { x, y, width, height } = rect;
  return {
    topLeft: { x, y },
    topRight: { x: x + width, y },
    bottomLeft: { x, y: y + height },
    bottomRight: { x: x + width, y: y + height },
  };
}

export function defaultDocumentCorners(
  width: number,
  height: number,
  insetRatio = 0.06,
  bottomSafeInset = 0,
): DocumentCorners {
  const insetX = width * insetRatio;
  const insetY = height * insetRatio;
  const maxY = Math.max(insetY, height - bottomSafeInset);

  return {
    topLeft: { x: insetX, y: insetY },
    topRight: { x: width - insetX, y: insetY },
    bottomLeft: { x: insetX, y: maxY - insetY },
    bottomRight: { x: width - insetX, y: maxY - insetY },
  };
}

export function clampPoint(
  point: Point,
  width: number,
  height: number,
  padding = 8,
  bottomSafeInset = 0,
): Point {
  'worklet';
  return {
    x: Math.min(width - padding, Math.max(padding, point.x)),
    y: Math.min(height - Math.max(padding, bottomSafeInset), Math.max(padding, point.y)),
  };
}
