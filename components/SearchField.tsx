import { Pressable, TextInput, View } from 'react-native';

import { GlassBackground } from './Glass';
import { Icon } from './Icon';
import { useTheme } from '../constants/theme';

type SearchFieldProps = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
};

export function SearchField({
  value,
  onChangeText,
  placeholder = 'Search…',
  onSubmit,
}: SearchFieldProps) {
  const { colors } = useTheme();
  return (
    <View className="h-[52px] flex-row items-center overflow-hidden rounded-full px-5">
      <GlassBackground radius={26} />
      <Icon name="search" size={21} className="mr-2.5 text-on-surface-variant" />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={`${colors['on-surface-variant']}99`}
        returnKeyType="search"
        onSubmitEditing={onSubmit}
        className="flex-1 py-0 font-inter text-body-lg text-on-surface"
      />
      {value.length > 0 ? (
        <Pressable accessibilityLabel="Clear search"
          onPress={() => onChangeText('')}
          hitSlop={10}
          className="h-7 w-7 items-center justify-center rounded-full bg-on-surface-variant/20"
        >
          <Icon name="close" size={14} className="text-on-surface-variant" />
        </Pressable>
      ) : null}
    </View>
  );
}
