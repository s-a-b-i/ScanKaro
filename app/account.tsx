import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '../components/ScreenHeader';
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
  const [plan, setPlan] = useState('Free');
  const [avatar, setAvatar] = useState('');
  const [loading, setLoading] = useState(appConfig.api.enabled);

  useEffect(() => {
    if (!profile) return;

    setName(profile.name);
    setEmail(profile.email);
    setPlan(profile.plan);
    setAvatar(profile.avatar);

    if (!appConfig.api.enabled) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const apiProfile = await userApi.getMe();
        setName(apiProfile.name);
        setEmail(apiProfile.email);
        setPlan(apiProfile.plan);
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
          <ActivityIndicator size="large" color="#00685f" />
        </View>
      ) : (
        <ScrollView contentContainerClassName="gap-stack-lg p-margin-mobile pb-28">
          <View className="items-center py-4">
            {avatar ? (
              <Image source={{ uri: avatar }} className="mb-4 h-24 w-24 rounded-full border-2 border-outline-variant" />
            ) : (
              <View className="mb-4 h-24 w-24 items-center justify-center rounded-full border-2 border-outline-variant bg-primary-container">
                <Text className="font-inter-semibold text-display-lg text-primary">{name.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View className="rounded-full bg-surface-container-low px-4 py-2">
              <Text className="font-inter text-label-md text-on-surface-variant">{plan} Plan</Text>
            </View>
          </View>

          <View className="gap-1">
            <Text className="ml-1 font-inter text-label-md text-on-surface-variant">Full Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              editable={false}
              className="h-12 rounded-xl bg-surface-container-low px-4 font-inter text-body-lg text-on-surface opacity-80"
            />
          </View>

          <View className="gap-1">
            <Text className="ml-1 font-inter text-label-md text-on-surface-variant">Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={false}
              className="h-12 rounded-xl bg-surface-container-low px-4 font-inter text-body-lg text-on-surface opacity-80"
            />
          </View>

          <Pressable
            onPress={async () => {
              await refreshProfile();
              goBackOr(router, '/(tabs)/settings');
            }}
            className="mt-4 h-14 items-center justify-center rounded-xl bg-primary active:opacity-90"
          >
            <Text className="font-inter-semibold text-title-md text-on-primary">Done</Text>
          </Pressable>

          <Text className="text-center font-inter text-body-sm text-on-surface-variant">
            Profile is synced from your Firebase account{appConfig.api.enabled ? ' and ScanKaro backend' : ''}.
          </Text>
        </ScrollView>
      )}
    </View>
  );
}
