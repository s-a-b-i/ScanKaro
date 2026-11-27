import { Switch, Text, View } from 'react-native';

import { Icon } from './Icon';
import { useTheme } from '../constants/theme';

type SwitchRowProps = {
  icon: React.ComponentProps<typeof Icon>['name'];
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
};

export function SwitchRow({ icon, title, subtitle, value, onValueChange }: SwitchRowProps) {
  const { colors } = useTheme();
  return (
    <View className="min-h-[60px] flex-row items-center justify-between px-4 py-3">
      <View className="mr-4 flex-1 flex-row items-center gap-3">
        <View className="h-8 w-8 items-center justify-center rounded-[9px] bg-primary/10">
          <Icon name={icon} size={18} className="text-primary" />
        </View>
        <View className="flex-1">
          <Text className="font-inter-medium text-body-lg text-on-surface">{title}</Text>
          {subtitle ? (
            <Text className="font-inter text-label-md text-on-surface-variant">{subtitle}</Text>
          ) : null}
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors['surface-container-highest'], true: colors.primary }}
        thumbColor={value ? colors['on-primary'] : '#ffffff'}
      />
    </View>
  );
}
