import { Text, View } from 'react-native';

export function SectionHeader({ title }: { title: string }) {
  return (
    <Text className="mb-2 px-margin-mobile font-inter text-label-caps uppercase tracking-widest text-secondary">
      {title}
    </Text>
  );
}

export function SettingsGroup({ children }: { children: React.ReactNode }) {
  return (
    <View className="border-y border-outline-variant bg-surface-container-lowest">{children}</View>
  );
}
