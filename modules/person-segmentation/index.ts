/**
 * On-device person cut-out and portrait analysis (ML Kit on Android, Vision on iOS).
 * Not available on web or in builds made before this module was added: `isAvailable` is
 * false and callers skip the background and suit steps.
 */
import { requireOptionalNativeModule } from 'expo';

export type Point = { x: number; y: number };

export type PortraitAnalysis = {
  width: number;
  height: number;
  face?: {
    x: number;
    y: number;
    width: number;
    height: number;
    /** Both eye centres, in any order. */
    eyes: Point[];
    /** Lowest point of the jaw line. */
    chin?: Point;
    /** Head tilt in degrees. */
    roll: number;
  } | null;
  /** Shoulder joints, in any order, with how surely each is in the frame (0..1). */
  shoulders: (Point & { confidence: number })[];
};

type NativeModule = {
  segmentPerson(uri: string): Promise<{ uri: string; width: number; height: number }>;
  analyzePortrait(uri: string): Promise<PortraitAnalysis>;
};

const native = requireOptionalNativeModule<NativeModule>('PersonSegmentation');

export const isAvailable = native != null;

/** A PNG mask the size of the image: white, alpha = person. */
export function segmentPerson(uri: string) {
  if (!native) throw new Error('Background removal needs the latest app build.');
  return native.segmentPerson(uri);
}

export function analyzePortrait(uri: string) {
  if (!native) throw new Error('Face detection needs the latest app build.');
  return native.analyzePortrait(uri);
}
