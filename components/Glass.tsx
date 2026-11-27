/**
 * Frosted "liquid glass" for the app's control layer: tab bar, toolbars, header buttons,
 * sheets, banners and camera overlays. Content (document cards, lists, pages) stays solid,
 * as Apple's HIG asks: glass belongs to the floating functional layer, never the content.
 *
 * A glass surface is: a blur of what is behind, a tint (keeps text readable and is the
 * fallback where blur is unavailable), light reflections, and a bright rim.
 */
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { Platform, Pressable, PressableProps, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { useTheme } from '../constants/theme';

export type GlassVariant =
  /** Bars, buttons and banners over app content. */
  | 'regular'
  /** Sheets and text-heavy panels: denser tint so text stays readable. */
  | 'sheet'
  /** Over photos and the camera: dark, with the ~35% dimming Apple recommends over bright media. */
  | 'media';

const TINT: Record<GlassVariant, { light: string; dark: string }> = {
  regular: { light: 'rgba(248,248,250,0.55)', dark: 'rgba(30,32,38,0.62)' },
  sheet: { light: 'rgba(250,250,252,0.86)', dark: 'rgba(28,30,36,0.88)' },
  media: { light: 'rgba(0,0,0,0.35)', dark: 'rgba(0,0,0,0.35)' },
};

/**
 * Light hitting the glass: a bright rim along the top edge, a soft diagonal streak, and a
 * faint shade towards the bottom. Purely decorative.
 */
export function GlassReflections({ isDark, radius, subtle }: { isDark: boolean; radius: number; subtle?: boolean }) {
  const strength = (isDark ? 0.35 : 1) * (subtle ? 0.55 : 1);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]}>
      <LinearGradient
        colors={[`rgba(255,255,255,${0.75 * strength})`, 'rgba(255,255,255,0)']}
        locations={[0, 0.55]}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(255,255,255,0)', `rgba(255,255,255,${0.32 * strength})`, 'rgba(255,255,255,0)']}
        locations={[0.18, 0.32, 0.46]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(0,0,0,0)', isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.05)']}
        locations={[0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: Math.max(radius * 0.6, 12),
          right: Math.max(radius * 0.6, 12),
          height: 1,
          backgroundColor: `rgba(255,255,255,${isDark ? 0.35 : 0.95})`,
        }}
      />
    </View>
  );
}

type GlassBackgroundProps = {
  /** Corner radius of the surface it sits in (that surface needs overflow: hidden). */
  radius: number;
  variant?: GlassVariant;
  /** Top corners only, for sheets and bottom bars. */
  topOnly?: boolean;
  /** Skip the blur, e.g. many items at once on slow phones. */
  noBlur?: boolean;
};

/** Fills its parent with glass. Put it first inside a container with overflow hidden. */
export function GlassBackground({ radius, variant = 'regular', topOnly, noBlur }: GlassBackgroundProps) {
  const { isDark } = useTheme();
  const tint = TINT[variant][isDark || variant === 'media' ? 'dark' : 'light'];
  const corners: ViewStyle = topOnly
    ? { borderTopLeftRadius: radius, borderTopRightRadius: radius }
    : { borderRadius: radius };
  const reflectDark = isDark || variant === 'media';
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, corners, { overflow: 'hidden' }]}>
      {noBlur ? null : (
        <BlurView
          intensity={Platform.OS === 'ios' ? 50 : 32}
          tint={reflectDark ? 'dark' : 'light'}
          experimentalBlurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFill}
        />
      )}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} />
      <GlassReflections isDark={reflectDark} radius={radius} subtle={variant === 'sheet'} />
      <View
        style={[
          StyleSheet.absoluteFill,
          corners,
          {
            borderWidth: StyleSheet.hairlineWidth * 2,
            borderColor: reflectDark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.85)',
            ...(topOnly ? { borderBottomWidth: 0 } : null),
          },
        ]}
      />
    </View>
  );
}

type GlassProps = {
  children?: ReactNode;
  radius?: number;
  variant?: GlassVariant;
  style?: StyleProp<ViewStyle>;
  className?: string;
};

/** A container with a glass background. */
export function Glass({ children, radius = 24, variant, style, className }: GlassProps) {
  return (
    <View className={className} style={[{ borderRadius: radius, overflow: 'hidden' }, style]}>
      <GlassBackground radius={radius} variant={variant} />
      {children}
    </View>
  );
}

type GlassButtonProps = PressableProps & {
  children: ReactNode;
  size?: number;
  variant?: GlassVariant;
  className?: string;
};

/** Round glass icon button (44 pt minimum hit area). */
export function GlassButton({ children, size = 48, variant, className, style, ...props }: GlassButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      {...props}
      className={`items-center justify-center active:opacity-70 ${className ?? ''}`}
      style={(state) => [
        { width: size, height: size, borderRadius: size / 2, overflow: 'hidden' },
        typeof style === 'function' ? style(state) : style,
      ]}
    >
      <GlassBackground radius={size / 2} variant={variant} />
      {children}
    </Pressable>
  );
}
