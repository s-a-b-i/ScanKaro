/**
 * Restore Photo: brings back faded, yellowed or dull photos (levels per colour channel,
 * a little colour and sharpening). Runs on the device; compare before and after.
 */
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassBackground } from '../components/Glass';
import { Icon } from '../components/Icon';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { useScan } from '../context/ScanProvider';
import { goBackOr } from '../utils/navigation';
import { restorePhotoToFile } from '../utils/skiaImage';

type Result = { before: string; after: string; ratio: number };

export default function RestorePhotoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addPage, reset } = useScan();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [showBefore, setShowBefore] = useState(false);

  const pick = async (source: 'camera' | 'library') => {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', `Allow ${source === 'camera' ? 'camera' : 'photo'} access to restore a photo.`);
      return;
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, quality: 1 };
    const picked =
      source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    const asset = picked.canceled ? undefined : picked.assets[0];
    if (!asset) return;
    setBusy(true);
    try {
      const out = await restorePhotoToFile(asset.uri);
      setResult({ before: asset.uri, after: out.uri, ratio: out.width / out.height });
      setShowBefore(false);
    } catch (e) {
      Alert.alert('Could not restore', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (!result) return;
    reset();
    addPage(result.after);
    router.push({ pathname: '/enhance', params: { filter: 'original' } });
  };

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top, paddingBottom: insets.bottom + 16 }}>
      <LoadingOverlay visible={busy} message="Restoring your photo…" />
      <View className="h-16 flex-row items-center justify-between px-5">
        <Pressable
          onPress={() => goBackOr(router, '/(tabs)/tools')}
          accessibilityLabel="Back"
          className="h-12 w-12 items-center justify-center overflow-hidden rounded-full active:opacity-70"
        >
          <GlassBackground radius={24} />
          <Icon name="arrow-back" size={22} className="text-on-surface" />
        </Pressable>
        <Text className="font-inter-semibold text-[17px] text-on-surface">Restore photo</Text>
        <View className="w-12" />
      </View>

      {result ? (
        <View className="flex-1 px-5">
          <View className="flex-1 items-center justify-center">
            <Image
              source={{ uri: showBefore ? result.before : result.after }}
              style={{ width: '100%', aspectRatio: result.ratio, maxHeight: '100%', borderRadius: 16 }}
              resizeMode="contain"
              accessibilityLabel={showBefore ? 'Original photo' : 'Restored photo'}
            />
          </View>
          <View className="my-4 flex-row self-center rounded-full bg-surface-container p-1" accessibilityRole="radiogroup">
            {(['Before', 'After'] as const).map((label) => {
              const active = (label === 'Before') === showBefore;
              return (
                <Pressable
                  key={label}
                  onPress={() => setShowBefore(label === 'Before')}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  className={`h-11 w-28 items-center justify-center rounded-full ${active ? 'bg-on-surface' : ''}`}
                >
                  <Text className={`font-inter-semibold text-[15px] ${active ? 'text-surface' : 'text-on-surface-variant'}`}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View className="flex-row gap-3">
            <Pressable
              onPress={() => void Sharing.shareAsync(result.after, { mimeType: 'image/jpeg', dialogTitle: 'Restored photo' })}
              className="h-14 flex-1 flex-row items-center justify-center gap-2 rounded-full border border-outline-variant active:bg-surface-container"
            >
              <Icon name="share" size={20} className="text-on-surface" />
              <Text className="font-inter-semibold text-[16px] text-on-surface">Share</Text>
            </Pressable>
            <Pressable
              onPress={save}
              className="h-14 flex-1 flex-row items-center justify-center gap-2 rounded-full bg-on-surface active:opacity-85"
            >
              <Icon name="save-alt" size={20} className="text-surface" />
              <Text className="font-inter-semibold text-[16px] text-surface">Save</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View className="flex-1 justify-center px-5">
          <View className="mb-6 h-20 w-20 items-center justify-center self-center rounded-[24px] bg-surface-container">
            <Icon name="auto-fix-high" size={36} className="text-on-surface" />
          </View>
          <Text className="text-center font-inter-semibold text-[26px] tracking-[-0.5px] text-on-surface">
            Bring old photos back
          </Text>
          <Text className="mb-8 mt-2 text-center font-inter text-[15px] leading-[21px] text-on-surface-variant">
            Fixes fading, yellowing and dull colours, and sharpens a little. Photograph the print flat, without glare.
          </Text>
          <View className="gap-3">
            <Pressable
              onPress={() => void pick('camera')}
              className="h-14 flex-row items-center justify-center gap-2 rounded-full bg-on-surface active:opacity-85"
            >
              <Icon name="photo-camera" size={20} className="text-surface" />
              <Text className="font-inter-semibold text-[16px] text-surface">Photograph a print</Text>
            </Pressable>
            <Pressable
              onPress={() => void pick('library')}
              className="h-14 flex-row items-center justify-center gap-2 rounded-full border border-outline-variant active:bg-surface-container"
            >
              <Icon name="photo-library" size={20} className="text-on-surface" />
              <Text className="font-inter-semibold text-[16px] text-on-surface">Choose from gallery</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}
