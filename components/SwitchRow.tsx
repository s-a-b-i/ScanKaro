import { Switch, Text, View } from 'react-native';

import { Icon } from './Icon';

type SwitchRowProps = {
  icon: React.ComponentProps<typeof Icon>['name'];
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
};

export function SwitchRow({ icon, title, subtitle, value, onValueChange }: SwitchRowProps) {
  return (
    <View className="flex-row items-center justify-between p-stack-md">
      <View className="mr-4 flex-1 flex-row items-center gap-3">
        <Icon name={icon} size={22} className="text-secondary" />
        <View className="flex-1">
          <Text className="font-inter text-body-lg text-on-surface">{title}</Text>
          {subtitle ? (
            <Text className="font-inter text-label-md text-on-surface-variant">{subtitle}</Text>
          ) : null}
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#e0e3e5', true: '#00685f' }}
        thumbColor="#ffffff"
      />
    </View>
  );
}
