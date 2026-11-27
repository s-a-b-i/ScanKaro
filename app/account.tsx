import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '../components/ScreenHeader';
import { SettingDivider, SettingRow } from '../components/settings/SettingRow';
import { SectionHeader, SettingsGroup } from '../components/settings/SettingsUI';
import { appConfig } from '../constants/config';
import { useApp } from '../context/AppProvider';
import { userApi } from '../services/api/user';
import { goBackOr } from '../utils/navigation';

export default function AccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, refreshProfile } = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [avatar, setAvatar] = useState('');
  const [loading, setLoading] = useState(appConfig.cloud.enabled);

  useEffect(() => {
    if (!profile) return;

    setName(profile.name);
    setEmail(profile.email);
    setAvatar(profile.avatar);

    if (!appConfig.cloud.enabled) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const apiProfile = await userApi.getMe();
        setName(apiProfile.name);
        setEmail(apiProfile.email);
        setAvatar(apiProfile.avatar);
      } catch {
        // keep Firebase profile values
      } finally {
        setLoading(false);
      }
    })();
  }, [profile]);

  if (!profile) return null;

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <ScreenHeader title="Personal Information" onBack={() => goBackOr(router, '/(tabs)/settings')} />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#8e8e93" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingTop: 8, paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="mb-8 items-center px-margin-mobile">
            {avatar ? (
              <Image source={{ uri: avatar }} className="mb-3 h-24 w-24 rounded-full" />
            ) : (
              <View className="mb-3 h-24 w-24 items-center justify-center rounded-full bg-primary/10">
                <Text className="font-inter-bold text-[36px] text-primary">{name.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <Text className="font-inter-bold text-headline-lg-mobile text-on-surface">{name}</Text>
            <Text className="mt-1 font-inter text-body-sm text-on-surface-variant">{email}</Text>
          </View>

          <SectionHeader title="Profile" />
          <SettingsGroup>
            <SettingRow icon="person" color="blue" label="Full Name" value={name} showChevron={false} />
            <SettingDivider />
            <SettingRow icon="email" color="red" label="Email" value={email} showChevron={false} />
          </SettingsGroup>

          <Text className="mt-3 px-8 font-inter text-label-md text-on-surface-variant">
            Your profile is synced from your sign-in account{appConfig.cloud.enabled ? ' and the ScanKaro backend' : ''}.
          </Text>

          <View className="mt-8 px-margin-mobile">
            <Pressable
              onPress={async () => {
                await refreshProfile();
                goBackOr(router, '/(tabs)/settings');
              }}
              className="h-14 items-center justify-center rounded-full bg-primary active:opacity-85"
            >
              <Text className="font-inter-semibold text-body-lg text-on-primary">Done</Text>
            </Pressable>
          </View>
        </ScrollView>
      )}
    </View>
  );
}
