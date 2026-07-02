import { useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SettingDivider, SettingRow } from '../../components/settings/SettingRow';
import { SectionHeader, SettingsGroup } from '../../components/settings/SettingsUI';
import { Icon } from '../../components/Icon';
import { appConfig } from '../../constants/config';
import { useApp } from '../../context/AppProvider';
import { MOCK_SETTINGS } from '../../services/mock/data';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, settings, loading, authReady, updateSettings, signOut } = useApp();
  const prefs = settings ?? MOCK_SETTINGS;

  const handleLogout = () => {
    Alert.alert('Log Out', 'You will be returned to the login screen.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/login');
        },
      },
    ]);
  };

  if (!authReady || loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background" style={{ paddingTop: insets.top }}>
        <ActivityIndicator size="large" color="#00685f" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        <View className="h-14 flex-row items-center border-b border-outline-variant bg-surface px-margin-mobile">
          <Text className="font-inter-semibold text-headline-lg-mobile text-primary">Settings</Text>
        </View>
        <View className="flex-1 items-center justify-center px-margin-mobile">
          <Icon name="settings" size={48} className="mb-4 text-on-surface-variant" />
          <Text className="mb-2 text-center font-inter-semibold text-title-md text-on-surface">
            Sign in to view settings
          </Text>
          <Pressable onPress={() => router.push('/login')} className="mt-4 rounded-xl bg-primary px-6 py-3">
            <Text className="font-inter-semibold text-title-md text-on-primary">Go to Login</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="h-14 flex-row items-center justify-between border-b border-outline-variant bg-surface px-margin-mobile">
        <Text className="font-inter-semibold text-headline-lg-mobile text-primary">Settings</Text>
        <Pressable className="rounded-full p-2">
          <Icon name="more-vert" size={22} className="text-on-surface-variant" />
        </Pressable>
      </View>

      <ScrollView contentContainerClassName="pb-32" showsVerticalScrollIndicator={false}>
        <View className="px-margin-mobile py-stack-lg">
          <View className="flex-row items-center gap-stack-md rounded-xl border border-outline-variant bg-surface-container-lowest p-stack-md shadow-sm">
            {profile.avatar ? (
              <Image source={{ uri: profile.avatar }} className="h-16 w-16 rounded-full border border-outline-variant" />
            ) : (
              <View className="h-16 w-16 items-center justify-center rounded-full border border-outline-variant bg-primary-container">
                <Text className="font-inter-semibold text-title-md text-primary">
                  {profile.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View className="flex-1">
              <Text className="font-inter-semibold text-title-md text-on-surface">{profile.name}</Text>
              <Text className="font-inter text-body-sm text-on-surface-variant">{profile.email}</Text>
            </View>
            <Pressable
              onPress={() => router.push('/account')}
              className="rounded-full bg-primary-container px-4 py-2 active:opacity-90"
            >
              <Text className="font-inter text-label-md text-on-primary-container">Edit</Text>
            </Pressable>
          </View>
        </View>

        <SectionHeader title="Account" />
        <SettingsGroup>
          <SettingRow icon="person" label="Personal Information" onPress={() => router.push('/account')} />
          <SettingDivider />
          <SettingRow
            icon="email"
            label="Email Notifications"
            onPress={() => updateSettings({ emailNotifications: !prefs.emailNotifications })}
            value={prefs.emailNotifications ? 'On' : 'Off'}
          />
        </SettingsGroup>

        <View className="mt-8">
          <SectionHeader title="Security" />
          <SettingsGroup>
            <SettingRow icon="lock" label="Change Password" onPress={() => router.push('/security')} />
            <SettingDivider />
            <SettingRow
              icon="fingerprint"
              label="Biometric Unlock"
              showChevron={false}
              toggle={{
                value: prefs.biometricUnlock,
                onChange: (v) => updateSettings({ biometricUnlock: v }),
              }}
            />
            <SettingDivider />
            <SettingRow icon="verified-user" label="App Lock & Privacy" onPress={() => router.push('/security')} />
          </SettingsGroup>
        </View>

        <View className="mt-8">
          <SectionHeader title="Cloud Sync" />
          <SettingsGroup>
            <SettingRow
              icon="cloud-upload"
              label="Google Drive"
              value={prefs.googleDriveConnected ? 'Connected' : 'Not Linked'}
              onPress={() => updateSettings({ googleDriveConnected: !prefs.googleDriveConnected })}
            />
            <SettingDivider />
            <SettingRow
              icon="add-to-drive"
              label="Dropbox"
              value={prefs.dropboxConnected ? 'Connected' : 'Not Linked'}
              onPress={() => updateSettings({ dropboxConnected: !prefs.dropboxConnected })}
            />
          </SettingsGroup>
        </View>

        <View className="mt-8">
          <SectionHeader title="Appearance" />
          <SettingsGroup>
            <SettingRow
              icon="dark-mode"
              label="Dark Mode"
              showChevron={false}
              toggle={{
                value: prefs.darkMode,
                onChange: (v) => updateSettings({ darkMode: v }),
              }}
            />
          </SettingsGroup>
        </View>

        <View className="mt-8">
          <SectionHeader title="Subscription" />
          <SettingsGroup>
            <SettingRow
              icon="workspace-premium"
              label="Current Plan"
              value={profile.plan}
              onPress={() => router.push('/paywall')}
            />
          </SettingsGroup>
        </View>

        <View className="mt-10 px-margin-mobile">
          <Pressable
            onPress={handleLogout}
            className="items-center rounded-xl border border-error/20 py-4 active:bg-error-container/20"
          >
            <Text className="font-inter-semibold text-title-md text-error">Log Out</Text>
          </Pressable>
          <Text className="mt-6 text-center font-inter text-label-md text-outline">
            ScanKaro v{appConfig.app.version}
            {!appConfig.api.enabled ? ' • Mock data mode' : ''}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
