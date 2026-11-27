/**
 * Locker: private photos and files behind a separate PIN. Locks again whenever you leave
 * the screen or the app goes to the background.
 */
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as IntentLauncher from 'expo-intent-launcher';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { ComponentProps, useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Image, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassBackground } from '../components/Glass';
import { Icon } from '../components/Icon';
import { PinPad } from '../components/lock/PinPad';
import { useToast } from '../components/Toast';
import { useTheme } from '../constants/theme';
import {
  addToLocker,
  deleteLockerItems,
  listLocker,
  lockerBiometricsAvailable,
  lockerHasPin,
  LockerItem,
  lockerItemUri,
  renameLockerItem,
  resetLocker,
  setLockerPin,
  unlockLockerWithBiometrics,
  verifyLockerPin,
} from '../services/locker';
import { formatBytes } from '../utils/pdf';
import { goBackOr } from '../utils/navigation';

type IconName = ComponentProps<typeof Icon>['name'];
type Stage = 'loading' | 'setup' | 'locked' | 'open';
type Filter = 'all' | 'image' | 'file';

const fileIcon = (item: LockerItem): IconName => {
  if (item.mimeType === 'application/pdf') return 'picture-as-pdf';
  if (item.mimeType.startsWith('video/')) return 'movie';
  if (item.mimeType.startsWith('audio/')) return 'audiotrack';
  if (/word|document/.test(item.mimeType)) return 'description';
  if (/sheet|excel/.test(item.mimeType)) return 'table-chart';
  if (/zip|compressed/.test(item.mimeType)) return 'folder-zip';
  return 'insert-drive-file';
};

export default function LockerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { colors } = useTheme();

  const [stage, setStage] = useState<Stage>('loading');
  const [pin, setPin] = useState('');
  const [firstPin, setFirstPin] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [biometric, setBiometric] = useState(false);

  const [items, setItems] = useState<LockerItem[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [viewing, setViewing] = useState<LockerItem | null>(null);
  const [renaming, setRenaming] = useState<LockerItem | null>(null);
  const [newName, setNewName] = useState('');

  const refresh = useCallback(() => setItems(listLocker()), []);

  // Our own pickers, share sheet and file viewers open other screens; don't lock for those.
  const awayForTask = useRef(false);
  const whileAway = async <T,>(task: () => Promise<T>): Promise<T> => {
    awayForTask.current = true;
    try {
      return await task();
    } finally {
      setTimeout(() => (awayForTask.current = false), 800);
    }
  };

  const tryBiometric = useCallback(async () => {
    if (await unlockLockerWithBiometrics()) setStage('open');
  }, []);

  useEffect(() => {
    void (async () => {
      const has = await lockerHasPin();
      setStage(has ? 'locked' : 'setup');
      const bio = has && (await lockerBiometricsAvailable());
      setBiometric(bio);
      if (bio) void tryBiometric();
    })();
  }, [tryBiometric]);

  useEffect(() => {
    if (stage === 'open') refresh();
  }, [stage, refresh]);

  // Lock again as soon as the app leaves the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' && !awayForTask.current) {
        setViewing(null);
        setStage((s) => (s === 'open' ? 'locked' : s));
      }
    });
    return () => sub.remove();
  }, []);

  const onPin = async (next: string) => {
    setPin(next);
    setMessage(null);
    if (next.length < 4) return;
    if (stage === 'setup') {
      if (firstPin === null) {
        setFirstPin(next);
        setPin('');
        return;
      }
      if (next !== firstPin) {
        setFirstPin(null);
        setPin('');
        setMessage("PINs didn't match. Try again.");
        return;
      }
      await setLockerPin(next);
      setPin('');
      setStage('open');
      return;
    }
    const result = await verifyLockerPin(next);
    setPin('');
    if (result.ok) setStage('open');
    else
      setMessage(
        result.waitSeconds
          ? `Too many attempts. Wait ${result.waitSeconds} s.`
          : `Wrong PIN${result.attemptsLeft ? ` · ${result.attemptsLeft} tries left` : ''}`,
      );
  };

  const forgotPin = () =>
    Alert.alert(
      'Reset the Locker?',
      'Without the PIN the Locker cannot be opened. Resetting erases everything in it and lets you choose a new PIN.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Erase and reset',
          style: 'destructive',
          onPress: async () => {
            await resetLocker();
            setFirstPin(null);
            setStage('setup');
          },
        },
      ],
    );

  const addPhotos = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to move photos into the Locker.');
      return;
    }
    const picked = await whileAway(() => ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 30,
      quality: 1,
    }));
    if (picked.canceled) return;
    const n = addToLocker(picked.assets.map((a) => ({ uri: a.uri, name: a.fileName, mimeType: a.mimeType ?? 'image/jpeg' })));
    refresh();
    toast.show(`${n} photo${n === 1 ? '' : 's'} added. Delete the originals from your gallery to keep them private.`);
  };

  const addFiles = async () => {
    const picked = await whileAway(() => DocumentPicker.getDocumentAsync({ type: '*/*', multiple: true, copyToCacheDirectory: true }));
    if (picked.canceled) return;
    const n = addToLocker(picked.assets.map((a) => ({ uri: a.uri, name: a.name, mimeType: a.mimeType })));
    refresh();
    toast.show(`${n} file${n === 1 ? '' : 's'} added.`);
  };

  const add = () =>
    Alert.alert('Add to Locker', undefined, [
      { text: 'Photos', onPress: () => void addPhotos() },
      { text: 'Files', onPress: () => void addFiles() },
      { text: 'Cancel', style: 'cancel' },
    ]);

  const share = async (item: LockerItem) => {
    await whileAway(() => Sharing.shareAsync(lockerItemUri(item), { mimeType: item.mimeType, dialogTitle: item.name }));
  };

  const openFile = async (item: LockerItem) => {
    try {
      await whileAway(() => IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: new File(lockerItemUri(item)).contentUri,
        type: item.mimeType,
        flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
      }));
    } catch {
      // No app can open this type: offer the share sheet instead.
      await share(item);
    }
  };

  const remove = (item: LockerItem) =>
    Alert.alert('Delete for good?', `"${item.name}" will be erased. This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteLockerItems([item.id]);
          setViewing(null);
          refresh();
        },
      },
    ]);

  const itemMenu = (item: LockerItem) =>
    Alert.alert(item.name, undefined, [
      { text: 'Share or save', onPress: () => void share(item) },
      {
        text: 'Rename',
        onPress: () => {
          setNewName(item.name);
          setRenaming(item);
        },
      },
      { text: 'Delete', style: 'destructive', onPress: () => remove(item) },
      { text: 'Cancel', style: 'cancel' },
    ]);

  const header = (
    <View className="h-16 flex-row items-center justify-between px-5">
      <Pressable
        onPress={() => goBackOr(router, '/(tabs)')}
        accessibilityLabel="Back"
        className="h-12 w-12 items-center justify-center overflow-hidden rounded-full active:opacity-70"
      >
        <GlassBackground radius={24} />
        <Icon name="arrow-back" size={22} className="text-on-surface" />
      </Pressable>
      <Text className="font-inter-semibold text-[17px] text-on-surface">Locker</Text>
      {stage === 'open' ? (
        <Pressable
          onPress={() => setStage('locked')}
          accessibilityLabel="Lock now"
          className="h-12 w-12 items-center justify-center overflow-hidden rounded-full active:opacity-70"
        >
          <GlassBackground radius={24} />
          <Icon name="lock" size={22} className="text-on-surface" />
        </Pressable>
      ) : (
        <View className="w-12" />
      )}
    </View>
  );

  if (stage === 'loading') return <View className="flex-1 bg-background" />;

  if (stage === 'setup' || stage === 'locked') {
    const setup = stage === 'setup';
    return (
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top, paddingBottom: insets.bottom + 16 }}>
        {header}
        <View className="flex-1 items-center justify-center">
          <PinPad
            title={setup ? (firstPin === null ? 'Choose a Locker PIN' : 'Enter it again') : 'Enter Locker PIN'}
            subtitle={
              setup
                ? firstPin === null
                  ? 'A separate 4-digit PIN just for your private photos and files.'
                  : 'Confirm your new PIN.'
                : 'Your private photos and files.'
            }
            message={message}
            value={pin}
            onChange={(v) => void onPin(v)}
            onBiometric={!setup && biometric ? () => void tryBiometric() : undefined}
          />
          {!setup ? (
            <Pressable onPress={forgotPin} hitSlop={8} className="mt-6 h-11 justify-center px-4">
              <Text className="font-inter-semibold text-[15px] text-on-surface-variant">Forgot PIN?</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  const shown = items.filter((i) => filter === 'all' || i.kind === filter);
  const photos = shown.filter((i) => i.kind === 'image');
  const files = shown.filter((i) => i.kind === 'file');

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {header}
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 110 }}>
        <View className="mb-4 flex-row items-center gap-2 rounded-2xl bg-surface-container px-3.5 py-3">
          <Icon name="verified-user" size={18} className="text-on-surface-variant" />
          <Text className="flex-1 font-inter text-[13px] leading-[18px] text-on-surface-variant">
            Kept in ScanKaro's private storage, hidden from your gallery and other apps. Not included in backups.
          </Text>
        </View>

        <View className="mb-4 flex-row self-start rounded-full bg-surface-container p-1" accessibilityRole="tablist">
          {(
            [
              ['all', 'All'],
              ['image', 'Photos'],
              ['file', 'Files'],
            ] as const
          ).map(([key, label]) => {
            const active = filter === key;
            return (
              <Pressable
                key={key}
                onPress={() => setFilter(key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                className={`h-10 justify-center rounded-full px-5 ${active ? 'bg-on-surface' : ''}`}
              >
                <Text className={`font-inter-semibold text-[14px] ${active ? 'text-surface' : 'text-on-surface-variant'}`}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {shown.length === 0 ? (
          <View className="items-center py-16">
            <View className="h-16 w-16 items-center justify-center rounded-full bg-surface-container">
              <Icon name="lock" size={28} className="text-on-surface" />
            </View>
            <Text className="mt-4 font-inter-semibold text-[18px] text-on-surface">Nothing here yet</Text>
            <Text className="mt-1 text-center font-inter text-[14px] leading-[20px] text-on-surface-variant">
              Add photos or files you want to keep private.
            </Text>
          </View>
        ) : null}

        {photos.length > 0 ? (
          <>
            {filter === 'all' ? (
              <Text className="mb-2 font-inter-semibold text-[17px] text-on-surface">Photos</Text>
            ) : null}
            <View className="-mx-0.5 mb-5 flex-row flex-wrap">
              {photos.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => setViewing(item)}
                  onLongPress={() => itemMenu(item)}
                  accessibilityLabel={item.name}
                  className="aspect-square w-1/3 p-0.5"
                >
                  <Image source={{ uri: lockerItemUri(item) }} className="h-full w-full rounded-lg bg-surface-container" />
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        {files.length > 0 ? (
          <>
            {filter === 'all' ? <Text className="mb-2 font-inter-semibold text-[17px] text-on-surface">Files</Text> : null}
            {files.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => void openFile(item)}
                onLongPress={() => itemMenu(item)}
                className="mb-2 flex-row items-center gap-3 rounded-2xl bg-surface-container-lowest p-3 active:opacity-70"
              >
                <View className="h-11 w-11 items-center justify-center rounded-xl bg-surface-container">
                  <Icon name={fileIcon(item)} size={22} className="text-on-surface" />
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="font-inter-semibold text-[15px] text-on-surface" numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text className="font-inter text-[12px] text-on-surface-variant">
                    {formatBytes(item.size)} · {new Date(item.addedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                  </Text>
                </View>
                <Pressable
                  onPress={() => itemMenu(item)}
                  accessibilityLabel={`More for ${item.name}`}
                  className="h-11 w-11 items-center justify-center rounded-full active:bg-surface-container"
                >
                  <Icon name="more-vert" size={22} className="text-on-surface-variant" />
                </Pressable>
              </Pressable>
            ))}
          </>
        ) : null}
      </ScrollView>

      {/* Add */}
      <View className="absolute left-5 right-5" style={{ bottom: insets.bottom + 20 }}>
        <Pressable
          onPress={add}
          className="h-14 flex-row items-center justify-center gap-2 rounded-full bg-on-surface active:opacity-85"
        >
          <Icon name="add" size={22} className="text-surface" />
          <Text className="font-inter-semibold text-[16px] text-surface">Add photos or files</Text>
        </Pressable>
      </View>

      {/* Photo viewer */}
      <Modal visible={!!viewing} animationType="fade" onRequestClose={() => setViewing(null)} statusBarTranslucent>
        <View className="flex-1 bg-black" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
          <View className="h-16 flex-row items-center justify-between px-3">
            <Pressable
              onPress={() => setViewing(null)}
              accessibilityLabel="Close"
              className="h-12 w-12 items-center justify-center rounded-full active:bg-white/10"
            >
              <Icon name="close" size={24} className="text-white" />
            </Pressable>
            <Text className="flex-1 px-2 text-center font-inter-semibold text-[15px] text-white" numberOfLines={1}>
              {viewing?.name}
            </Text>
            <View className="w-12" />
          </View>
          {viewing ? (
            <Image source={{ uri: lockerItemUri(viewing) }} className="flex-1" resizeMode="contain" />
          ) : null}
          <View className="flex-row justify-around py-3">
            {viewing ? (
              <>
                <Pressable onPress={() => void share(viewing)} className="h-14 items-center justify-center px-6">
                  <Icon name="share" size={24} className="text-white" />
                  <Text className="mt-1 font-inter text-[12px] text-white">Share</Text>
                </Pressable>
                <Pressable onPress={() => remove(viewing)} className="h-14 items-center justify-center px-6">
                  <Icon name="delete-outline" size={24} className="text-white" />
                  <Text className="mt-1 font-inter text-[12px] text-white">Delete</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* Rename */}
      <Modal visible={!!renaming} transparent animationType="fade" onRequestClose={() => setRenaming(null)}>
        <View className="flex-1 items-center justify-center bg-black/50 px-8">
          <View className="w-full rounded-[28px] bg-surface p-5">
            <Text className="mb-3 font-inter-semibold text-[18px] text-on-surface">Rename</Text>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              autoFocus
              selectTextOnFocus
              placeholderTextColor={colors['on-surface-variant']}
              className="h-12 rounded-xl bg-surface-container px-4 font-inter text-[16px] text-on-surface"
            />
            <View className="mt-4 flex-row justify-end gap-2">
              <Pressable onPress={() => setRenaming(null)} className="h-11 justify-center px-4">
                <Text className="font-inter-semibold text-[15px] text-on-surface-variant">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (renaming) renameLockerItem(renaming.id, newName);
                  setRenaming(null);
                  refresh();
                }}
                className="h-11 justify-center rounded-full bg-on-surface px-5"
              >
                <Text className="font-inter-semibold text-[15px] text-surface">Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
