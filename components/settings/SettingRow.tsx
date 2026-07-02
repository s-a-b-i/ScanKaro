import { ComponentProps } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';

import { Icon } from '../Icon';

type SettingRowProps = {
  icon: ComponentProps<typeof Icon>['name'];
  label: string;
  value?: string;
  onPress?: () => void;
  showChevron?: boolean;
  toggle?: { value: boolean; onChange: (v: boolean) => void };
};

export function SettingRow({ icon, label, value, onPress, showChevron = true, toggle }: SettingRowProps) {
  const content = (
    <View className="flex-row items-center gap-4 px-margin-mobile py-4">
      <Icon name={icon} size={22} className="text-primary" />
      <Text className="flex-1 font-inter text-body-lg text-on-surface">{label}</Text>
      {value ? <Text className="font-inter text-label-md text-primary">{value}</Text> : null}
      {toggle ? (
        <Switch
          value={toggle.value}
          onValueChange={toggle.onChange}
          trackColor={{ false: '#e0e3e5', true: '#00685f' }}
          thumbColor="#ffffff"
        />
      ) : showChevron ? (
        <Icon name="chevron-right" size={22} className="text-outline-variant" />
      ) : null}
    </View>
  );

  if (onPress && !toggle) {
    return (
      <Pressable onPress={onPress} className="active:bg-surface-container-low">
        {content}
      </Pressable>
    );
  }

  return content;
}

export function SettingDivider() {
  return <View className="mx-margin-mobile h-px bg-outline-variant" />;
}
