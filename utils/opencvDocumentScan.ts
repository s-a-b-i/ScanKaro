import { Buffer } from 'buffer';
import jpeg from 'jpeg-js';

import { DocumentCorners, Point } from './documentFrame';

export type RgbaImage = {
  width: number;
  height: number;
  data: Uint8Array;
};

const PROCESS_HEIGHT = 600;
const BORDER = 5;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function luminance(r: number, g: number, b: number) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export function decodeJpegBase64(base64: string): RgbaImage {
  const normalized = base64.replace(/^data:image\/\w+;base64,/, '');
  const raw = jpeg.decode(Buffer.from(normalized, 'base64'), { useTArray: true });
  return { width: raw.width, height: raw.height, data: raw.data as Uint8Array };
}

export function encodeJpeg(image: RgbaImage, quality = 88): Uint8Array {
  const encoded = jpeg.encode(
    { data: image.data, width: image.width, height: image.height },
    quality,
  );
  return new Uint8Array(encoded.data);
}

function resizeToHeight(image: RgbaImage, height: number): RgbaImage {
  const scale = height / image.height;
  const width = Math.max(1, Math.round(image.width * scale));
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    const sy = (y / scale);
    const y0 = Math.floor(sy);
    const y1 = Math.min(image.height - 1, y0 + 1);
    const fy = sy - y0;

    for (let x = 0; x < width; x++) {
      const sx = x / scale;
      const x0 = Math.floor(sx);
      const x1 = Math.min(image.width - 1, x0 + 1);
      const fx = sx - x0;

      const i00 = (y0 * image.width + x0) * 4;
      const i10 = (y0 * image.width + x1) * 4;
      const i01 = (y1 * image.width + x0) * 4;
      const i11 = (y1 * image.width + x1) * 4;
      const o = (y * width + x) * 4;

      for (let c = 0; c < 4; c++) {
        const v00 = image.data[i00 + c];
        const v10 = image.data[i10 + c];
        const v01 = image.data[i01 + c];
        const v11 = image.data[i11 + c];
        const top = v00 + (v10 - v00) * fx;
        const bottom = v01 + (v11 - v01) * fx;
        data[o + c] = Math.round(top + (bottom - top) * fy);
      }
    }
  }

  return { width, height, data };
}

function toGrayscale(image: RgbaImage): Uint8Array {
  const gray = new Uint8Array(image.width * image.height);
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
    gray[i] = luminance(image.data[p], image.data[p + 1], image.data[p + 2]);
  }
  return gray;
}

function boxBlur(gray: Uint8Array, width: number, height: number, radius: number) {
  const out = new Uint8Array(gray.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
            sum += gray[ny * width + nx];
            count++;
          }
        }
      }
      out[y * width + x] = Math.round(sum / count);
    }
  }
  return out;
}

function buildIntegral(gray: Uint8Array, width: number, height: number) {
  const integral = new Float64Array((width + 1) * (height + 1));
  for (let y = 1; y <= height; y++) {
    let rowSum = 0;
    for (let x = 1; x <= width; x++) {
      rowSum += gray[(y - 1) * width + (x - 1)];
      integral[y * (width + 1) + x] = integral[(y - 1) * (width + 1) + x] + rowSum;
    }
  }
  return integral;
}

function localMean(integral: Float64Array, width: number, x0: number, y0: number, x1: number, y1: number) {
  const w = width + 1;
  const sum =
    integral[y1 * w + x1] -
    integral[y0 * w + x1] -
    integral[y1 * w + x0] +
    integral[y0 * w + x0];
  const area = (x1 - x0) * (y1 - y0);
  return sum / area;
}

function adaptiveThreshold(gray: Uint8Array, width: number, height: number, blockSize: number, c: number) {
  const half = Math.floor(blockSize / 2);
  const integral = buildIntegral(gray, width, height);
  const out = new Uint8Array(gray.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - half);
      const y0 = Math.max(0, y - half);
      const x1 = Math.min(width, x + half + 1);
      const y1 = Math.min(height, y + half + 1);
      const mean = localMean(integral, width, x0, y0, x1, y1);
      out[y * width + x] = gray[y * width + x] > mean - c ? 255 : 0;
    }
  }

  return out;
}

function medianBlur(gray: Uint8Array, width: number, height: number, k: number) {
  const half = Math.floor(k / 2);
  const out = new Uint8Array(gray.length);
  const window: number[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      window.length = 0;
      for (let dy = -half; dy <= half; dy++) {
        for (let dx = -half; dx <= half; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
            window.push(gray[ny * width + nx]);
          }
        }
      }
      window.sort((a, b) => a - b);
      out[y * width + x] = window[Math.floor(window.length / 2)] ?? gray[y * width + x];
    }
  }

  return out;
}

function copyMakeBorder(gray: Uint8Array, width: number, height: number, border: number) {
  const nw = width + border * 2;
  const nh = height + border * 2;
  const out = new Uint8Array(nw * nh);
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      const sx = clamp(x - border, 0, width - 1);
      const sy = clamp(y - border, 0, height - 1);
      out[y * nw + x] = gray[sy * width + sx];
    }
  }
  return { data: out, width: nw, height: nh };
}

function sobelMagnitude(gray: Uint8Array, width: number, height: number) {
  const mag = new Float32Array(gray.length);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const gx =
        -gray[idx - width - 1] +
        gray[idx - width + 1] -
        2 * gray[idx - 1] +
        2 * gray[idx + 1] -
        gray[idx + width - 1] +
        gray[idx + width + 1];
      const gy =
        -gray[idx - width - 1] -
        2 * gray[idx - width] -
        gray[idx - width + 1] +
        gray[idx + width - 1] +
        2 * gray[idx + width] +
        gray[idx + width + 1];
      mag[idx] = Math.hypot(gx, gy);
    }
  }
  return mag;
}

function canny(gray: Uint8Array, width: number, height: number, low: number, high: number) {
  const mag = sobelMagnitude(gray, width, height);
  const edges = new Uint8Array(gray.length);

  for (let i = 0; i < mag.length; i++) {
    if (mag[i] >= high) edges[i] = 255;
    else if (mag[i] >= low) edges[i] = 128;
  }

  // Hysteresis: promote weak edges connected to strong edges.
  const queue: number[] = [];
  for (let i = 0; i < edges.length; i++) {
    if (edges[i] === 255) queue.push(i);
  }

  while (queue.length > 0) {
    const idx = queue.pop()!;
    const x = idx % width;
    const y = Math.floor(idx / width);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const ni = ny * width + nx;
        if (edges[ni] === 128) {
          edges[ni] = 255;
          queue.push(ni);
        }
      }
    }
  }

  for (let i = 0; i < edges.length; i++) {
    if (edges[i] !== 255) edges[i] = 0;
  }

  return edges;
}

function traceContour(edges: Uint8Array, visited: Uint8Array, width: number, height: number, sx: number, sy: number) {
  const dirs = [
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [-1, -1],
    [0, -1],
    [1, -1],
  ];
  const contour: Point[] = [];
  let x = sx;
  let y = sy;
  let dir = 0;
  const start = { x, y };

  do {
    const idx = y * width + x;
    if (!visited[idx]) {
      visited[idx] = 1;
      contour.push({ x, y });
    }

    let found = false;
    for (let i = 0; i < 8; i++) {
      const nd = (dir + i) % 8;
      const nx = x + dirs[nd][0];
      const ny = y + dirs[nd][1];
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const ni = ny * width + nx;
      if (edges[ni] === 255 && !visited[ni]) {
        x = nx;
        y = ny;
        dir = (nd + 6) % 8;
        found = true;
        break;
      }
    }

    if (!found) break;
  } while (x !== start.x || y !== start.y);

  return contour;
}

function findContours(edges: Uint8Array, width: number, height: number) {
  const visited = new Uint8Array(edges.length);
  const contours: Point[][] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (edges[idx] === 255 && !visited[idx]) {
        const contour = traceContour(edges, visited, width, height, x, y);
        if (contour.length >= 20) contours.push(contour);
      }
    }
  }

  return contours;
}

function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point) {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - lineStart.x, point.y - lineStart.y);
  const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (dx * dx + dy * dy);
  const projX = lineStart.x + t * dx;
  const projY = lineStart.y + t * dy;
  return Math.hypot(point.x - projX, point.y - projY);
}

function approxPolyDP(contour: Point[], epsilon: number): Point[] {
  if (contour.length <= 2) return contour;

  let dmax = 0;
  let index = 0;
  const end = contour.length - 1;

  for (let i = 1; i < end; i++) {
    const d = perpendicularDistance(contour[i], contour[0], contour[end]);
    if (d > dmax) {
      index = i;
      dmax = d;
    }
  }

  if (dmax > epsilon) {
    const left = approxPolyDP(contour.slice(0, index + 1), epsilon);
    const right = approxPolyDP(contour.slice(index), epsilon);
    return [...left.slice(0, -1), ...right];
  }

  return [contour[0], contour[end]];
}

function contourArea(contour: Point[]) {
  let area = 0;
  for (let i = 0; i < contour.length; i++) {
    const j = (i + 1) % contour.length;
    area += contour[i].x * contour[j].y - contour[j].x * contour[i].y;
  }
  return Math.abs(area) / 2;
}

function isContourConvex(contour: Point[]) {
  if (contour.length < 4) return false;
  let sign = 0;
  for (let i = 0; i < contour.length; i++) {
    const p0 = contour[i];
    const p1 = contour[(i + 1) % contour.length];
    const p2 = contour[(i + 2) % contour.length];
    const cross = (p1.x - p0.x) * (p2.y - p1.y) - (p1.y - p0.y) * (p2.x - p1.x);
    if (cross === 0) continue;
    if (sign === 0) sign = cross > 0 ? 1 : -1;
    else if ((cross > 0 ? 1 : -1) !== sign) return false;
  }
  return true;
}

function fourCornersSort(points: Point[]): Point[] {
  const diff = points.map((p) => p.y - p.x);
  const summ = points.map((p) => p.x + p.y);
  const topLeft = points[summ.indexOf(Math.min(...summ))];
  const bottomRight = points[summ.indexOf(Math.max(...summ))];
  const bottomLeft = points[diff.indexOf(Math.max(...diff))];
  const topRight = points[diff.indexOf(Math.min(...diff))];
  return [topLeft, bottomLeft, bottomRight, topRight];
}

function contourOffset(points: Point[], offsetX: number, offsetY: number) {
  return points.map((p) => ({
    x: Math.max(0, p.x + offsetX),
    y: Math.max(0, p.y + offsetY),
  }));
}

function defaultPageContour(width: number, height: number): Point[] {
  return [
    { x: BORDER, y: BORDER },
    { x: BORDER, y: height - BORDER },
    { x: width - BORDER, y: height - BORDER },
    { x: width - BORDER, y: BORDER },
  ];
}

function findPageContour(edges: Uint8Array, width: number, height: number) {
  const maxArea = (width - BORDER * 2) * (height - BORDER * 2);
  let bestArea = maxArea * 0.5;
  let pageContour = defaultPageContour(width, height);

  for (const contour of findContours(edges, width, height)) {
    const perimeter = contour.reduce((sum, point, i) => {
      const next = contour[(i + 1) % contour.length];
      return sum + Math.hypot(next.x - point.x, next.y - point.y);
    }, 0);
    const approx = approxPolyDP(contour, 0.03 * perimeter);
    const area = contourArea(approx);

    if (approx.length === 4 && isContourConvex(approx) && area > bestArea && area < maxArea) {
      bestArea = area;
      pageContour = approx;
    }
  }

  return fourCornersSort(pageContour);
}

function pointsToDocumentCorners(points: Point[]): DocumentCorners {
  const [topLeft, bottomLeft, bottomRight, topRight] = points;
  return { topLeft, topRight, bottomLeft, bottomRight };
}

export function detectPageCornersFromImage(image: RgbaImage): DocumentCorners | null {
  if (image.width < 40 || image.height < 40) return null;

  const scaled = resizeToHeight(image, PROCESS_HEIGHT);
  const scale = image.height / scaled.height;

  let gray = toGrayscale(scaled);
  gray = boxBlur(gray, scaled.width, scaled.height, 2);
  gray = adaptiveThreshold(gray, scaled.width, scaled.height, 71, 4);
  gray = medianBlur(gray, scaled.width, scaled.height, 7);

  const bordered = copyMakeBorder(gray, scaled.width, scaled.height, BORDER);
  const edges = canny(bordered.data, bordered.width, bordered.height, 80, 160);

  let page = findPageContour(edges, bordered.width, bordered.height);
  page = contourOffset(page, -BORDER, -BORDER);

  const scaledCorners = pointsToDocumentCorners(page);
  const corners: DocumentCorners = {
    topLeft: { x: scaledCorners.topLeft.x * scale, y: scaledCorners.topLeft.y * scale },
    topRight: { x: scaledCorners.topRight.x * scale, y: scaledCorners.topRight.y * scale },
    bottomLeft: { x: scaledCorners.bottomLeft.x * scale, y: scaledCorners.bottomLeft.y * scale },
    bottomRight: { x: scaledCorners.bottomRight.x * scale, y: scaledCorners.bottomRight.y * scale },
  };

  const area = contourArea([
    corners.topLeft,
    corners.bottomLeft,
    corners.bottomRight,
    corners.topRight,
  ]);
  if (area < image.width * image.height * 0.08) return null;

  return corners;
}

function solveLinearSystem(a: number[][], b: number[]) {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row;
    }
    [m[col], m[pivot]] = [m[pivot], m[col]];

    const div = m[col][col] || 1e-8;
    for (let j = col; j <= n; j++) m[col][j] /= div;

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = m[row][col];
      for (let j = col; j <= n; j++) m[row][j] -= factor * m[col][j];
    }
  }

  return m.map((row) => row[n]);
}

function getPerspectiveTransform(src: Point[], dst: Point[]) {
  const a: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i++) {
    const sx = src[i].x;
    const sy = src[i].y;
    const dx = dst[i].x;
    const dy = dst[i].y;
    a.push([sx, sy, 1, 0, 0, 0, -dx * sx, -dx * sy]);
    b.push(dx);
    a.push([0, 0, 0, sx, sy, 1, -dy * sx, -dy * sy]);
    b.push(dy);
  }

  const h = solveLinearSystem(a, b);
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

function invert3x3(m: number[]) {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const D = -(b * i - c * h);
  const E = a * i - c * g;
  const F = -(a * h - b * g);
  const G = b * f - c * e;
  const H = -(a * f - c * d);
  const I = a * e - b * d;
  const det = a * A + b * B + c * C || 1e-8;

  return [A / det, D / det, G / det, B / det, E / det, H / det, C / det, F / det, I / det];
}

function applyHomography(matrix: number[], x: number, y: number) {
  const w = matrix[6] * x + matrix[7] * y + matrix[8];
  return [
    (matrix[0] * x + matrix[1] * y + matrix[2]) / w,
    (matrix[3] * x + matrix[4] * y + matrix[5]) / w,
  ];
}

function sampleBilinear(image: RgbaImage, x: number, y: number) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(image.width - 1, x0 + 1);
  const y1 = Math.min(image.height - 1, y0 + 1);
  const fx = x - x0;
  const fy = y - y0;

  if (x0 < 0 || y0 < 0 || x1 >= image.width || y1 >= image.height) {
    return [255, 255, 255, 255];
  }

  const i00 = (y0 * image.width + x0) * 4;
  const i10 = (y0 * image.width + x1) * 4;
  const i01 = (y1 * image.width + x0) * 4;
  const i11 = (y1 * image.width + x1) * 4;
  const out = [0, 0, 0, 255];

  for (let c = 0; c < 3; c++) {
    const top = image.data[i00 + c] + (image.data[i10 + c] - image.data[i00 + c]) * fx;
    const bottom = image.data[i01 + c] + (image.data[i11 + c] - image.data[i01 + c]) * fx;
    out[c] = Math.round(top + (bottom - top) * fy);
  }

  return out;
}

export function warpDocumentPerspective(image: RgbaImage, corners: DocumentCorners): RgbaImage {
  const src = [
    corners.topLeft,
    corners.bottomLeft,
    corners.bottomRight,
    corners.topRight,
  ];

  const width = Math.max(
    Math.hypot(src[0].x - src[1].x, src[0].y - src[1].y),
    Math.hypot(src[2].x - src[3].x, src[2].y - src[3].y),
  );
  const height = Math.max(
    Math.hypot(src[0].x - src[3].x, src[0].y - src[3].y),
    Math.hypot(src[1].x - src[2].x, src[1].y - src[2].y),
  );

  const outW = Math.max(1, Math.round(width));
  const outH = Math.max(1, Math.round(height));
  const dst = [
    { x: 0, y: 0 },
    { x: 0, y: outH },
    { x: outW, y: outH },
    { x: outW, y: 0 },
  ];

  const matrix = getPerspectiveTransform(dst, src);
  const inv = invert3x3(matrix);
  const data = new Uint8Array(outW * outH * 4);

  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const [sx, sy] = applyHomography(inv, x, y);
      const rgba = sampleBilinear(image, sx, sy);
      const o = (y * outW + x) * 4;
      data[o] = rgba[0];
      data[o + 1] = rgba[1];
      data[o + 2] = rgba[2];
      data[o + 3] = 255;
    }
  }

  return { width: outW, height: outH, data };
}

export function detectPageCornersFromBase64(base64: string): DocumentCorners | null {
  try {
    const image = decodeJpegBase64(base64);
    return detectPageCornersFromImage(image);
  } catch {
    return null;
  }
}

export function cornersToDetectionSize(corners: DocumentCorners) {
  const xs = [corners.topLeft.x, corners.topRight.x, corners.bottomLeft.x, corners.bottomRight.x];
  const ys = [corners.topLeft.y, corners.topRight.y, corners.bottomLeft.y, corners.bottomRight.y];
  return {
    imageWidth: Math.max(...xs),
    imageHeight: Math.max(...ys),
  };
}
