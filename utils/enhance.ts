/** Scan filters offered on the Enhance screen. Rendering lives in utils/skiaImage.ts (GPU). */
export type EnhanceFilter =
  | 'original'
  | 'lighten'
  | 'enhance'
  | 'noShadow'
  | 'gray'
  | 'bw'
  | 'whiteboard'
  | 'slides'
  | 'noMarks';

export const ENHANCE_FILTERS: { key: EnhanceFilter; label: string }[] = [
  { key: 'original', label: 'Original' },
  { key: 'lighten', label: 'Lighten' },
  { key: 'enhance', label: 'Enhance' },
  { key: 'noShadow', label: 'No Shadow' },
  { key: 'gray', label: 'Gray' },
  { key: 'bw', label: 'B&W' },
  { key: 'whiteboard', label: 'Whiteboard' },
  { key: 'slides', label: 'Slides' },
  { key: 'noMarks', label: 'No Pen Marks' },
];

export const DEFAULT_ENHANCE_FILTER: EnhanceFilter = 'enhance';
