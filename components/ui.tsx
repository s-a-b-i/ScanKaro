import { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from './Icon';
import { GlassBackground } from './Glass';

/** Height of the floating tab bar pill (see app/(tabs)/_layout.tsx). */
export const TAB_BAR_HEIGHT = 64;
export const TAB_BAR_GAP = 12;

/** Bottom padding a tab screen needs so its last item clears the floating tab bar. */
export function useTabBarInset(extra = 24) {
  const insets = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + Math.max(insets.bottom, TAB_BAR_GAP) + extra;
}

export const shadows = StyleSheet.create({
  soft: {
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  lifted: {
    shadowColor: '#0f172a',
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
});

type CardProps = {
  children: ReactNode;
  className?: string;
  style?: ViewStyle;
  onPress?: () => void;
};

/** White rounded card used across the app. */
export function Card({ children, className, style, onPress }: CardProps) {
  const base = `rounded-3xl bg-surface-container-lowest ${className ?? ''}`;
  if (onPress) {
    return (
      <Pressable onPress={onPress} className={`${base} active:opacity-80`} style={[shadows.soft, style]}>
        {children}
      </Pressable>
    );
  }
  return (
    <View className={base} style={[shadows.soft, style]}>
      {children}
    </View>
  );
}

type IconChipProps = {
  name: ComponentProps<typeof Icon>['name'];
  /** Tailwind background class, e.g. "bg-primary-container". */
  bg?: string;
  /** Tailwind text color class for the icon. */
  color?: string;
  size?: 'sm' | 'md' | 'lg';
};

/** Rounded square holding an icon, like iOS settings icons. */
export function IconChip({ name, bg = 'bg-primary/10', color = 'text-primary', size = 'md' }: IconChipProps) {
  const box = { sm: 'h-8 w-8 rounded-[10px]', md: 'h-10 w-10 rounded-xl', lg: 'h-12 w-12 rounded-2xl' }[size];
  const iconSize = { sm: 18, md: 22, lg: 26 }[size];
  return (
    <View className={`items-center justify-center ${box} ${bg}`}>
      <Icon name={name} size={iconSize} className={color} />
    </View>
  );
}

type CircleButtonProps = {
  icon: ComponentProps<typeof Icon>['name'];
  onPress?: () => void;
  /** "light" is a white circle for light backgrounds. */
  tone?: 'light' | 'primary';
  badge?: boolean;
  /** What the button does, for screen readers. */
  label?: string;
};

export function CircleButton({ icon, onPress, tone = 'light', badge, label }: CircleButtonProps) {
  const isPrimary = tone === 'primary';
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`h-11 w-11 items-center justify-center overflow-hidden rounded-full active:opacity-70 ${
        isPrimary ? 'bg-primary' : ''
      }`}
      style={shadows.soft}
    >
      {isPrimary ? null : <GlassBackground radius={22} />}
      <Icon name={icon} size={22} className={isPrimary ? 'text-on-primary' : 'text-on-surface'} />
      {badge ? <View className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-error" /> : null}
    </Pressable>
  );
}

type LargeHeaderProps = {
  title: string;
  /** Small grey line above the title, e.g. a greeting. */
  eyebrow?: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
};

/** iOS-style large title header for top-level screens. */
export function LargeHeader({ title, eyebrow, subtitle, left, right }: LargeHeaderProps) {
  return (
    <View className="px-margin-mobile pb-stack-md">
      {left || right ? (
        <View className="mb-3 h-11 flex-row items-center justify-between">
          <View>{left}</View>
          <View className="flex-row items-center gap-2">{right}</View>
        </View>
      ) : (
        <View className="h-3" />
      )}
      {eyebrow ? (
        <Text className="font-inter-medium text-title-md text-on-surface-variant">{eyebrow}</Text>
      ) : null}
      <Text className="font-inter-bold text-large-title text-on-surface">{title}</Text>
      {subtitle ? (
        <Text className="mt-1 font-inter text-body-sm text-on-surface-variant">{subtitle}</Text>
      ) : null}
    </View>
  );
}

type SectionTitleProps = {
  title: string;
  action?: string;
  onAction?: () => void;
};

export function SectionTitle({ title, action, onAction }: SectionTitleProps) {
  return (
    <View className="mb-3 flex-row items-center justify-between px-margin-mobile">
      <Text className="font-inter-bold text-title-md text-on-surface">{title}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={8} className="active:opacity-60">
          <Text className="font-inter-semibold text-body-sm text-primary">{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

type EmptyStateProps = {
  icon: ComponentProps<typeof Icon>['name'];
  title: string;
  message?: string;
  children?: ReactNode;
};

export function EmptyState({ icon, title, message, children }: EmptyStateProps) {
  return (
    <View className="items-center px-8 py-12">
      <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-surface-container-lowest" style={shadows.soft}>
        <Icon name={icon} size={36} className="text-primary" />
      </View>
      <Text className="text-center font-inter-semibold text-title-md text-on-surface">{title}</Text>
      {message ? (
        <Text className="mt-2 text-center font-inter text-body-sm text-on-surface-variant">{message}</Text>
      ) : null}
      {children}
    </View>
  );
}
