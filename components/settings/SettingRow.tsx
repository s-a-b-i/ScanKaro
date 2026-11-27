import { ComponentProps } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';

import { Icon } from '../Icon';
import { useTheme } from '../../constants/theme';

export const TILE_COLORS = {
  teal: '#48484a',
  blue: '#2f7cf6',
  indigo: '#5b5bd6',
  orange: '#f28a1d',
  pink: '#e5487a',
  green: '#636366',
  red: '#e5484d',
  gray: '#8e8e93',
} as const;

export type TileColor = keyof typeof TILE_COLORS;

type SettingRowProps = {
  icon: ComponentProps<typeof Icon>['name'];
  label: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  showChevron?: boolean;
  toggle?: { value: boolean; onChange: (v: boolean) => void };
  /** Colour of the rounded icon tile. */
  color?: TileColor;
  destructive?: boolean;
};

export function SettingRow({
  icon,
  label,
  subtitle,
  value,
  onPress,
  showChevron = true,
  toggle,
  color = 'teal',
  destructive,
}: SettingRowProps) {
  const { colors } = useTheme();
  const content = (
    <View className="min-h-[54px] flex-row items-center gap-3 px-4 py-2.5">
      <View
        className="h-8 w-8 items-center justify-center rounded-[9px]"
        style={{ backgroundColor: destructive ? TILE_COLORS.red : TILE_COLORS[color] }}
      >
        <Icon name={icon} size={18} className="text-white" />
      </View>
      <View className="min-w-0 flex-1">
        <Text
          className={`font-inter-medium text-body-lg ${destructive ? 'text-error' : 'text-on-surface'}`}
          numberOfLines={1}
        >
          {label}
        </Text>
        {subtitle ? (
          <Text className="font-inter text-label-md text-on-surface-variant" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text className="max-w-[55%] font-inter text-body-sm text-on-surface-variant" numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {toggle ? (
        <Switch
          value={toggle.value}
          onValueChange={toggle.onChange}
          trackColor={{ false: colors['surface-container-highest'], true: colors.primary }}
          thumbColor={toggle.value ? colors['on-primary'] : '#ffffff'}
        />
      ) : showChevron ? (
        <Icon name="chevron-right" size={22} className="-mr-1 text-on-surface-variant/40" />
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

/** Hairline divider inset to line up with the row label (past the icon tile). */
export function SettingDivider() {
  return <View className="ml-[60px] h-px bg-outline-variant/40" />;
}
