import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { SettingDivider, SettingRow } from '../../components/settings/SettingRow';
import { SectionHeader, SettingsGroup } from '../../components/settings/SettingsUI';
import { Card, EmptyState, LargeHeader, useTabBarInset } from '../../components/ui';
import { appConfig } from '../../constants/config';
import { useApp } from '../../context/AppProvider';
import { authService } from '../../services';
import { libraryBytes } from '../../services/local/library';
import { MOCK_SETTINGS } from '../../services/mock/data';
import { clearTempFiles, formatBytes, tempBytes } from '../../utils/tempFiles';
import { useAppLock } from '../../components/lock/AppLockGate';
import { resolveAppearance } from '../../constants/theme';
import * as DocumentPicker from 'expo-document-picker';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import { createBackup, openBackup, OpenedBackup, shareBackup } from '../../utils/backup';
import { RestoreSheet } from '../../components/RestoreSheet';
import { SetPinSheet } from '../../components/lock/SetPinSheet';
import {
  biometricsAvailable,
  disableLock,
  isBiometricEnabled,
  isLockEnabled,
  setBiometricEnabled,
} from '../../services/appLock';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const bottomInset = useTabBarInset();
  const {
    profile,
    settings,
    loading,
    authReady,
    updateSettings,
    signOut,
    deleteAccount,
    refreshDocuments,
    refreshFolders,
    documents,
  } = useApp();
  const prefs = settings ?? MOCK_SETTINGS;

  const handleLogout = () => {
    Alert.alert('Log out?', 'Your documents stay on this phone and you can keep using ScanKaro.', [
      { text: 'Stay signed in', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
        },
      },
    ]);
  };

  const [storage, setStorage] = useState<{ library: number; temp: number } | null>(null);
  const { refreshLock } = useAppLock();
  const [lockOn, setLockOn] = useState(false);
  const [bioOn, setBioOn] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  // enable: choose PIN · disable: confirm PIN · change-verify: confirm, then choose a new one.
  const [pinFlow, setPinFlow] = useState<null | 'enable' | 'disable' | 'change-verify' | 'change-create'>(null);

  const refreshSecurity = useCallback(async () => {
    setLockOn(await isLockEnabled());
    setBioOn(await isBiometricEnabled());
    setBioAvailable(await biometricsAvailable());
    await refreshLock();
  }, [refreshLock]);

  const onPinFlowDone = async () => {
    const flow = pinFlow;
    if (flow === 'change-verify') {
      setPinFlow('change-create');
      return;
    }
    setPinFlow(null);
    if (flow === 'disable') await disableLock();
    await refreshSecurity();
    if (flow === 'enable') Alert.alert('App lock is on', 'You will be asked for your PIN when opening ScanKaro.');
    if (flow === 'change-create') Alert.alert('PIN changed');
  };

  const refreshStorage = useCallback(async () => {
    setStorage({ library: await libraryBytes(), temp: tempBytes() });
  }, []);

  // Recalculate whenever the tab is shown (scans may have been saved meanwhile).
  useFocusEffect(
    useCallback(() => {
      void refreshStorage();
      void refreshSecurity();
    }, [refreshStorage, refreshSecurity]),
  );

  const [backupBusy, setBackupBusy] = useState<string | null>(null);
  const [openedBackup, setOpenedBackup] = useState<OpenedBackup | null>(null);

  const handleBackup = async () => {
    setBackupBusy('Preparing backup…');
    try {
      const file = await createBackup((done, total) =>
        setBackupBusy(`Backing up… ${Math.round((done / total) * 100)}%`),
      );
      setBackupBusy(null);
      await shareBackup(file);
    } catch (error) {
      setBackupBusy(null);
      Alert.alert('Backup failed', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const handleRestore = async () => {
    // Pick first: Android will not open the file picker while a modal is showing.
    const picked = await DocumentPicker.getDocumentAsync({
      type: ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'],
      copyToCacheDirectory: true,
    });
    if (picked.canceled || !picked.assets[0]) return;
    setBackupBusy('Checking backup…');
    try {
      // Unpack and check every file first; the user then picks what to restore.
      const backup = await openBackup(
        picked.assets[0].uri,
        documents.map((d) => d.id),
      );
      setBackupBusy(null);
      setOpenedBackup(backup);
    } catch (error) {
      setBackupBusy(null);
      Alert.alert('Restore failed', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const closeBackup = () => {
    openedBackup?.close();
    setOpenedBackup(null);
  };

  const restoreChosen = async (ids: string[]) => {
    const backup = openedBackup;
    if (!backup) return;
    setOpenedBackup(null);
    setBackupBusy('Restoring…');
    try {
      const { added } = await backup.restore(ids);
      await Promise.all([refreshDocuments(), refreshFolders()]);
      void refreshStorage();
      setBackupBusy(null);
      toast.show(`Restored ${added} document${added === 1 ? '' : 's'}`);
    } catch (error) {
      setBackupBusy(null);
      Alert.alert('Restore failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      backup.close();
    }
  };

  const handleClearTemp = () => {
    Alert.alert('Clear temporary files?', 'Saved documents are not affected.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        onPress: () => {
          const freed = clearTempFiles();
          void refreshStorage();
          toast.show(`Freed ${formatBytes(freed)}`);
        },
      },
    ]);
  };

  const handleChangePassword = () => {
    if (!profile?.email) return;
    Alert.alert('Change password', `We will email a password reset link to ${profile.email}.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send link',
        onPress: async () => {
          try {
            await authService.resetPassword(profile.email);
            Alert.alert('Check your email', 'Follow the link in the email to set a new password.');
          } catch (error) {
            Alert.alert('Could not send email', error instanceof Error ? error.message : 'Please try again.');
          }
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete account?',
      'Your account and every document saved on this device will be permanently deleted. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount();
              router.replace('/(tabs)');
            } catch (error) {
              Alert.alert('Could not delete account', error instanceof Error ? error.message : 'Please try again.');
            }
          },
        },
      ],
    );
  };

  if (!authReady || loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#8e8e93" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: bottomInset }}
        showsVerticalScrollIndicator={false}
      >
        <LargeHeader title="Settings" />

        {/* Profile card. Signed out: the optional way in to an account. */}
        <View className="mb-8 px-margin-mobile">
          {!profile ? (
            <Card
              onPress={() => router.push('/login')}
              className="flex-row items-center gap-4 p-4"
            >
              <View className="h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Icon name="person-outline" size={30} className="text-primary" />
              </View>
              <View className="min-w-0 flex-1">
                <Text className="font-inter-bold text-title-md text-on-surface" numberOfLines={1}>
                  Sign in or create account
                </Text>
                <Text className="font-inter text-body-sm text-on-surface-variant" numberOfLines={2}>
                  Optional. ScanKaro works fully without one.
                </Text>
              </View>
              <Icon name="chevron-right" size={24} className="text-on-surface-variant/40" />
            </Card>
          ) : (
          <Card onPress={() => router.push('/account')} className="flex-row items-center gap-4 p-4">
            {profile.avatar ? (
              <Image source={{ uri: profile.avatar }} className="h-16 w-16 rounded-full" />
            ) : (
              <View className="h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Text className="font-inter-bold text-[24px] text-primary">{profile.name.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View className="min-w-0 flex-1">
              <Text className="font-inter-bold text-title-md text-on-surface" numberOfLines={1}>
                {profile.name}
              </Text>
              <Text className="font-inter text-body-sm text-on-surface-variant" numberOfLines={1}>
                {profile.email}
              </Text>
            </View>
            <Icon name="chevron-right" size={24} className="text-on-surface-variant/40" />
          </Card>
          )}
        </View>

        {profile ? (
          <>
            <SectionHeader title="Account" />
            <SettingsGroup>
              <SettingRow icon="person" color="blue" label="Personal Information" onPress={() => router.push('/account')} />
              <SettingDivider />
              <SettingRow icon="lock-reset" color="gray" label="Change Password" onPress={handleChangePassword} />
            </SettingsGroup>
          </>
        ) : null}

        <View className={profile ? 'mt-7' : ''}>
          <SectionHeader title="Preferences" />
          <SettingsGroup>
            <View className="px-4 py-3.5">
              <View className="mb-3 flex-row items-center gap-3">
                <View className="h-8 w-8 items-center justify-center rounded-lg bg-[#5e5ce6]">
                  <Icon name="dark-mode" size={18} className="text-white" />
                </View>
                <Text className="font-inter-medium text-[16px] text-on-surface">Appearance</Text>
              </View>
              <View className="flex-row rounded-full bg-surface-container p-1" accessibilityRole="radiogroup">
                {(
                  [
                    ['system', 'Automatic'],
                    ['light', 'Light'],
                    ['dark', 'Dark'],
                  ] as const
                ).map(([value, label]) => {
                  const active = resolveAppearance(prefs) === value;
                  return (
                    <Pressable
                      key={value}
                      onPress={() => updateSettings({ appearance: value })}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: active }}
                      className={`h-11 flex-1 items-center justify-center rounded-full ${active ? 'bg-surface-container-lowest' : ''}`}
                    >
                      <Text
                        className={`text-[15px] ${active ? 'font-inter-semibold text-on-surface' : 'font-inter text-on-surface-variant'}`}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text className="mt-2 font-inter text-[13px] text-on-surface-variant">
                Automatic follows your phone's light or dark setting.
              </Text>
            </View>
          </SettingsGroup>
        </View>

        <View className="mt-7">
          <SectionHeader title="Security" />
          <SettingsGroup>
            <SettingRow
              icon="lock"
              color="green"
              label="App lock"
              subtitle="Ask for a PIN when opening ScanKaro"
              showChevron={false}
              toggle={{ value: lockOn, onChange: (v) => setPinFlow(v ? 'enable' : 'disable') }}
            />
            {lockOn && bioAvailable ? (
              <>
                <SettingDivider />
                <SettingRow
                  icon="fingerprint"
                  color="teal"
                  label="Unlock with fingerprint"
                  showChevron={false}
                  toggle={{
                    value: bioOn,
                    onChange: async (v) => {
                      await setBiometricEnabled(v);
                      await refreshSecurity();
                    },
                  }}
                />
              </>
            ) : null}
            {lockOn ? (
              <>
                <SettingDivider />
                <SettingRow
                  icon="password"
                  color="gray"
                  label="Change PIN"
                  onPress={() => setPinFlow('change-verify')}
                />
              </>
            ) : null}
          </SettingsGroup>
        </View>

        <View className="mt-7">
          <SectionHeader title="Backup" />
          <SettingsGroup>
            <SettingRow
              icon="backup"
              color="blue"
              label="Back up library"
              subtitle="Save all documents as one .zip (Drive, Files…)"
              onPress={() => void handleBackup()}
            />
            <SettingDivider />
            <SettingRow
              icon="settings-backup-restore"
              color="indigo"
              label="Restore from backup"
              subtitle="Check a ScanKaro .zip and pick what to restore"
              onPress={() => void handleRestore()}
            />
          </SettingsGroup>
        </View>

        <View className="mt-7">
          <SectionHeader title="Storage" />
          <SettingsGroup>
            <SettingRow
              icon="folder"
              color="teal"
              label="Documents"
              subtitle={appConfig.cloud.enabled ? 'Stored in your ScanKaro cloud' : 'Saved on this device'}
              value={storage ? formatBytes(storage.library) : '…'}
              showChevron={false}
            />
            <SettingDivider />
            <SettingRow
              icon="delete-outline"
              color="red"
              label="Recently deleted"
              subtitle="Restore documents deleted in the last 30 days"
              onPress={() => router.push('/trash')}
            />
            <SettingDivider />
            <SettingRow
              icon="content-copy"
              color="pink"
              label="Find duplicates"
              subtitle="Documents that look the same"
              onPress={() => router.push('/duplicates')}
            />
            <SettingDivider />
            <SettingRow
              icon="cleaning-services"
              color="orange"
              label="Temporary files"
              subtitle="Leftovers from scanning and PDF tools"
              value={storage ? formatBytes(storage.temp) : '…'}
              onPress={handleClearTemp}
            />
          </SettingsGroup>
        </View>

        {profile ? (
          <View className="mt-7">
            <SettingsGroup>
              <SettingRow icon="logout" label="Log Out" destructive showChevron={false} onPress={handleLogout} />
              <SettingDivider />
              <SettingRow
                icon="delete-forever"
                label="Delete Account"
                subtitle="Removes your account and every document on this device"
                destructive
                showChevron={false}
                onPress={handleDeleteAccount}
              />
            </SettingsGroup>
          </View>
        ) : null}

        <Text className="mt-6 text-center font-inter text-label-md text-on-surface-variant">
          ScanKaro v{appConfig.app.version}
          {appConfig.cloud.enabled ? ' · Cloud storage' : ' · Saved on this device'}
        </Text>
      </ScrollView>

      <LoadingOverlay visible={!!backupBusy} message={backupBusy ?? ''} />
      <RestoreSheet backup={openedBackup} onCancel={closeBackup} onRestore={(ids) => void restoreChosen(ids)} />

      <SetPinSheet
        visible={pinFlow !== null}
        mode={pinFlow === 'disable' || pinFlow === 'change-verify' ? 'verify' : 'create'}
        onDone={() => void onPinFlowDone()}
        onCancel={() => setPinFlow(null)}
      />
    </View>
  );
}
