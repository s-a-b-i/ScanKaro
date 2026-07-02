import { ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Icon } from './Icon';

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backIcon?: ComponentProps<typeof Icon>['name'];
  right?: React.ReactNode;
  className?: string;
};

export function ScreenHeader({
  title,
  subtitle,
  onBack,
  backIcon = 'arrow-back',
  right,
  className,
}: ScreenHeaderProps) {
  return (
    <View className={`border-b border-outline-variant bg-surface px-margin-mobile ${className ?? ''}`}>
      <View className="h-14 flex-row items-center justify-between">
        <View className="flex-1 flex-row items-center gap-3">
          {onBack ? (
            <Pressable onPress={onBack} className="rounded-full p-2 active:opacity-70">
              <Icon name={backIcon} size={24} className="text-primary" />
            </Pressable>
          ) : null}
          <View className="flex-1">
            <Text className="font-inter-semibold text-headline-lg-mobile text-on-surface" numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text className="font-inter text-label-md text-on-surface-variant">{subtitle}</Text>
            ) : null}
          </View>
        </View>
        {right}
      </View>
    </View>
  );
}
