import { Text, View } from 'react-native';

import { shadows } from '../ui';

export function SectionHeader({ title }: { title: string }) {
  return (
    <Text className="mb-2 px-8 font-inter-semibold text-label-md uppercase tracking-wider text-on-surface-variant">
      {title}
    </Text>
  );
}

/** Inset grouped card, like iOS Settings. */
export function SettingsGroup({ children }: { children: React.ReactNode }) {
  return (
    <View className="mx-margin-mobile overflow-hidden rounded-3xl bg-surface-container-lowest" style={shadows.soft}>
      {children}
    </View>
  );
}
