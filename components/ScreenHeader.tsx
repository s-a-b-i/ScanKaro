import { ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Icon } from './Icon';
import { shadows } from './ui';

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backIcon?: ComponentProps<typeof Icon>['name'];
  right?: React.ReactNode;
  className?: string;
};

/** Compact iOS-style navigation bar: round back button, centred title, optional right slot. */
export function ScreenHeader({
  title,
  subtitle,
  onBack,
  backIcon = 'arrow-back-ios-new',
  right,
  className,
}: ScreenHeaderProps) {
  return (
    <View className={`h-14 flex-row items-center px-margin-mobile ${className ?? ''}`}>
      <View className="w-11">
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="h-11 w-11 items-center justify-center rounded-full bg-surface-container-lowest active:opacity-70"
            style={shadows.soft}
          >
            <Icon name={backIcon} size={backIcon === 'arrow-back-ios-new' ? 18 : 22} className="text-on-surface" />
          </Pressable>
        ) : null}
      </View>

      <View className="flex-1 items-center px-2">
        <Text className="font-inter-semibold text-body-lg text-on-surface" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="font-inter text-label-md text-on-surface-variant" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      <View className="min-w-11 flex-row items-center justify-end">{right}</View>
    </View>
  );
}
