import { Pressable, TextInput, View } from 'react-native';

import { Icon } from './Icon';

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
  return (
    <View className="h-12 flex-row items-center rounded-xl border border-outline-variant bg-surface-container-low px-4">
      <Icon name="search" size={22} className="mr-3 text-on-surface-variant" />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#3d494799"
        returnKeyType="search"
        onSubmitEditing={onSubmit}
        className="flex-1 font-inter text-body-lg text-on-surface"
      />
      {value.length > 0 ? (
        <Pressable onPress={() => onChangeText('')} className="p-1">
          <Icon name="close" size={20} className="text-on-surface-variant" />
        </Pressable>
      ) : null}
    </View>
  );
}
