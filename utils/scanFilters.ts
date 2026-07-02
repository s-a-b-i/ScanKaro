export type ScanFilter = 'Auto' | 'Document' | 'Grayscale' | 'B&W' | 'Color';

export const SCAN_FILTERS: ScanFilter[] = ['Auto', 'Document', 'Grayscale', 'B&W', 'Color'];

/** SVG FeColorMatrix values — works in Expo Go (no native filter module). */
export function getSvgColorMatrix(filter: ScanFilter, brightnessLevel: number): string {
  const offset = (((brightnessLevel - 50) / 50) * 0.12).toFixed(3);

  switch (filter) {
    case 'Grayscale':
      return `0.2126 0.7152 0.0722 0 ${offset} 0.2126 0.7152 0.0722 0 ${offset} 0.2126 0.7152 0.0722 0 ${offset} 0 0 0 1 0`;
    case 'B&W': {
      const c = 1.45;
      const t = (Number(offset) - 0.08).toFixed(3);
      return `${(0.2126 * c).toFixed(4)} ${(0.7152 * c).toFixed(4)} ${(0.0722 * c).toFixed(4)} 0 ${t} ${(0.2126 * c).toFixed(4)} ${(0.7152 * c).toFixed(4)} ${(0.0722 * c).toFixed(4)} 0 ${t} ${(0.2126 * c).toFixed(4)} ${(0.7152 * c).toFixed(4)} ${(0.0722 * c).toFixed(4)} 0 ${t} 0 0 0 1 0`;
    }
    case 'Document':
      return `0.9 0.08 0.02 0 ${offset} 0.06 0.88 0.06 0 ${offset} 0.02 0.06 0.82 0 ${offset} 0 0 0 1 0`;
    case 'Color':
      return `1.18 -0.08 -0.1 0 ${offset} -0.06 1.16 -0.1 0 ${offset} -0.08 -0.06 1.14 0 ${offset} 0 0 0 1 0`;
    case 'Auto':
    default:
      return `1.06 0 0 0 ${offset} 0 1.06 0 0 ${offset} 0 0 1.04 0 ${offset} 0 0 0 1 0`;
  }
}
