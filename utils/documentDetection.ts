import { decodeJpegBase64, detectPageCornersFromImage } from './opencvDocumentScan';
import { DocumentCorners, Point } from './documentFrame';

type DetectionResult = {
  corners: DocumentCorners;
  imageWidth: number;
  imageHeight: number;
};

export function detectDocumentFromBase64(base64: string): DetectionResult | null {
  try {
    const image = decodeJpegBase64(base64);
    const corners = detectPageCornersFromImage(image);
    if (!corners) return null;

    return {
      corners,
      imageWidth: image.width,
      imageHeight: image.height,
    };
  } catch {
    return null;
  }
}

export function mapDetectionToScreen(
  corners: DocumentCorners,
  imageWidth: number,
  imageHeight: number,
  screenWidth: number,
  screenHeight: number,
): DocumentCorners {
  const imageAspect = imageWidth / imageHeight;
  const screenAspect = screenWidth / screenHeight;

  let scale: number;
  let offsetX = 0;
  let offsetY = 0;

  if (imageAspect > screenAspect) {
    scale = screenHeight / imageHeight;
    offsetX = (screenWidth - imageWidth * scale) / 2;
  } else {
    scale = screenWidth / imageWidth;
    offsetY = (screenHeight - imageHeight * scale) / 2;
  }

  const map = (point: Point): Point => ({
    x: point.x * scale + offsetX,
    y: point.y * scale + offsetY,
  });

  return {
    topLeft: map(corners.topLeft),
    topRight: map(corners.topRight),
    bottomLeft: map(corners.bottomLeft),
    bottomRight: map(corners.bottomRight),
  };
}

/** Maps image coords to screen using "cover" fit — matches full-screen camera preview. */
export function mapDetectionToCover(
  corners: DocumentCorners,
  imageWidth: number,
  imageHeight: number,
  screenWidth: number,
  screenHeight: number,
): DocumentCorners {
  const scale = Math.max(screenWidth / imageWidth, screenHeight / imageHeight);
  const offsetX = (screenWidth - imageWidth * scale) / 2;
  const offsetY = (screenHeight - imageHeight * scale) / 2;

  const map = (point: Point): Point => ({
    x: point.x * scale + offsetX,
    y: point.y * scale + offsetY,
  });

  return {
    topLeft: map(corners.topLeft),
    topRight: map(corners.topRight),
    bottomLeft: map(corners.bottomLeft),
    bottomRight: map(corners.bottomRight),
  };
}

export function mapImageCornersToView(
  corners: DocumentCorners,
  imageWidth: number,
  imageHeight: number,
  viewWidth: number,
  viewHeight: number,
): DocumentCorners {
  const imageAspect = imageWidth / imageHeight;
  const viewAspect = viewWidth / viewHeight;

  let scale: number;
  let offsetX = 0;
  let offsetY = 0;

  if (imageAspect > viewAspect) {
    scale = viewWidth / imageWidth;
    offsetY = (viewHeight - imageHeight * scale) / 2;
  } else {
    scale = viewHeight / imageHeight;
    offsetX = (viewWidth - imageWidth * scale) / 2;
  }

  const map = (point: Point): Point => ({
    x: point.x * scale + offsetX,
    y: point.y * scale + offsetY,
  });

  return {
    topLeft: map(corners.topLeft),
    topRight: map(corners.topRight),
    bottomLeft: map(corners.bottomLeft),
    bottomRight: map(corners.bottomRight),
  };
}

export function mapViewCornersToImage(
  corners: DocumentCorners,
  imageWidth: number,
  imageHeight: number,
  viewWidth: number,
  viewHeight: number,
): DocumentCorners {
  const imageAspect = imageWidth / imageHeight;
  const viewAspect = viewWidth / viewHeight;

  let scale: number;
  let offsetX = 0;
  let offsetY = 0;

  if (imageAspect > viewAspect) {
    scale = viewWidth / imageWidth;
    offsetY = (viewHeight - imageHeight * scale) / 2;
  } else {
    scale = viewHeight / imageHeight;
    offsetX = (viewWidth - imageWidth * scale) / 2;
  }

  const map = (point: Point): Point => ({
    x: (point.x - offsetX) / scale,
    y: (point.y - offsetY) / scale,
  });

  return {
    topLeft: map(corners.topLeft),
    topRight: map(corners.topRight),
    bottomLeft: map(corners.bottomLeft),
    bottomRight: map(corners.bottomRight),
  };
}

export function lerpCorners(from: DocumentCorners, to: DocumentCorners, factor: number): DocumentCorners {
  const lerp = (a: number, b: number) => a + (b - a) * factor;
  return {
    topLeft: { x: lerp(from.topLeft.x, to.topLeft.x), y: lerp(from.topLeft.y, to.topLeft.y) },
    topRight: { x: lerp(from.topRight.x, to.topRight.x), y: lerp(from.topRight.y, to.topRight.y) },
    bottomLeft: { x: lerp(from.bottomLeft.x, to.bottomLeft.x), y: lerp(from.bottomLeft.y, to.bottomLeft.y) },
    bottomRight: { x: lerp(from.bottomRight.x, to.bottomRight.x), y: lerp(from.bottomRight.y, to.bottomRight.y) },
  };
}

export function cornersToPoints(corners: DocumentCorners): string {
  const { topLeft, topRight, bottomRight, bottomLeft } = corners;
  return `${topLeft.x},${topLeft.y} ${topRight.x},${topRight.y} ${bottomRight.x},${bottomRight.y} ${bottomLeft.x},${bottomLeft.y}`;
}
