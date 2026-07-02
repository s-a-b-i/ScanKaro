import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../components/Icon';
import { ScreenHeader } from '../components/ScreenHeader';
import { SwitchRow } from '../components/SwitchRow';
import { useApp } from '../context/AppProvider';
import { goBackOr } from '../utils/navigation';

export default function SecurityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { settings, updateSettings } = useApp();

  if (!settings) return null;

  const showComingSoon = (title: string) =>
    Alert.alert(title, 'This feature will connect to the backend when ready.');

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <ScreenHeader title="Security & App Lock" onBack={() => goBackOr(router, '/(tabs)/settings')} />

      <ScrollView contentContainerClassName="gap-stack-lg p-margin-mobile pb-28" showsVerticalScrollIndicator={false}>
        <View className="flex-row items-center gap-4 rounded-xl border border-outline-variant bg-surface-container-low p-stack-md shadow-sm">
          <View className="h-12 w-12 items-center justify-center rounded-full bg-primary-container">
            <Icon name="verified-user" size={26} className="text-on-primary-container" filled />
          </View>
          <View className="flex-1">
            <Text className="font-inter-semibold text-title-md text-on-surface">Storage Encrypted</Text>
            <Text className="font-inter text-body-sm text-on-surface-variant">AES-256 military-grade protection active</Text>
          </View>
          <View className="h-2 w-2 rounded-full bg-primary" />
        </View>

        <View className="gap-stack-sm">
          <Text className="px-2 font-inter text-label-caps uppercase text-outline">Access Control</Text>
          <View className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest">
            <SwitchRow
              icon="fingerprint"
              title="App Lock"
              subtitle="Require Face ID or PIN to open"
              value={settings.biometricUnlock}
              onValueChange={(value) => updateSettings({ biometricUnlock: value })}
            />
            <View className="h-px bg-outline-variant" />
            <Pressable
              onPress={() => showComingSoon('Auto-lock timer')}
              className="flex-row items-center justify-between p-stack-md active:bg-surface-container-low"
            >
              <View className="flex-row items-center gap-3">
                <Icon name="timer" size={22} className="text-secondary" />
                <View>
                  <Text className="font-inter text-body-lg text-on-surface">Auto-lock timer</Text>
                  <Text className="font-inter text-label-md text-on-surface-variant">Lock after 1 minute of inactivity</Text>
                </View>
              </View>
              <Icon name="chevron-right" size={22} className="text-outline" />
            </Pressable>
          </View>
        </View>

        <View className="gap-stack-sm">
          <Text className="px-2 font-inter text-label-caps uppercase text-outline">Confidentiality</Text>
          <View className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest">
            <View className="flex-row items-center justify-between bg-primary/5 p-stack-md">
              <View className="mr-3 flex-1 flex-row items-center gap-3">
                <View className="rounded-lg bg-primary/10 p-2">
                  <Icon name="lock" size={22} className="text-primary" filled />
                </View>
                <View className="flex-1">
                  <Text className="font-inter-semibold text-body-lg text-on-surface">Private Folder</Text>
                  <Text className="font-inter text-label-md text-on-surface-variant">Hidden from main document list</Text>
                </View>
              </View>
              <Pressable
                onPress={() => showComingSoon('Private Folder')}
                className="rounded-full bg-primary px-4 py-1.5 active:opacity-90"
              >
                <Text className="font-inter text-label-md text-on-primary">Configure</Text>
              </Pressable>
            </View>
            <View className="h-px bg-outline-variant" />
            <View className="flex-row items-center justify-between p-stack-md">
              <View className="flex-row items-center gap-3">
                <Icon name="visibility-off" size={22} className="text-secondary" />
                <Text className="font-inter text-body-lg text-on-surface">Stealth Mode</Text>
              </View>
              <Switch
                value={settings.stealthMode}
                onValueChange={(value) => updateSettings({ stealthMode: value })}
                trackColor={{ false: '#e0e3e5', true: '#00685f' }}
                thumbColor="#ffffff"
              />
            </View>
          </View>
        </View>

        <View className="gap-stack-sm">
          <Text className="px-2 font-inter text-label-caps uppercase text-outline">Data Privacy</Text>
          <View className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest">
            <Pressable
              onPress={() => showComingSoon('Export My Data')}
              className="flex-row items-center justify-between p-stack-md active:bg-surface-container-low"
            >
              <View className="flex-row items-center gap-3">
                <Icon name="download-for-offline" size={22} className="text-secondary" />
                <View>
                  <Text className="font-inter text-body-lg text-on-surface">Export My Data</Text>
                  <Text className="font-inter text-label-md text-on-surface-variant">Download all scans as ZIP archive</Text>
                </View>
              </View>
              <Icon name="open-in-new" size={20} className="text-outline" />
            </Pressable>
            <View className="h-px bg-outline-variant" />
            <Pressable
              onPress={() => showComingSoon('Delete Account')}
              className="flex-row items-center justify-between p-stack-md active:bg-error-container/20"
            >
              <View className="flex-row items-center gap-3">
                <Icon name="delete-forever" size={22} className="text-error" />
                <View>
                  <Text className="font-inter-semibold text-body-lg text-error">Delete Account</Text>
                  <Text className="font-inter text-label-md text-on-error-container">Irreversibly wipe all cloud and local data</Text>
                </View>
              </View>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
