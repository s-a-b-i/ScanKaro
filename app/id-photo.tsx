/**
 * ID Photo Maker: take or pick a portrait, crop it to a passport/visa size, then share the
 * photo, print a 4 x 6 inch sheet of copies, or save the sheet to the library.
 */
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassBackground } from '../components/Glass';
import { Icon } from '../components/Icon';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { useScan } from '../context/ScanProvider';
import { ID_PHOTO_SIZES, IdPhotoSize, makeIdPhoto, makeIdSheet } from '../utils/idPhoto';
import { goBackOr } from '../utils/navigation';
import { printPages } from '../utils/print';

type Result = { photo: string; sheet: string; copies: number; size: IdPhotoSize };

export default function IdPhotoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addPage, reset } = useScan();
  const [size, setSize] = useState<IdPhotoSize>(ID_PHOTO_SIZES[0]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const pick = async (source: 'camera' | 'library') => {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', `Allow ${source === 'camera' ? 'camera' : 'photo'} access to make an ID photo.`);
      return;
    }
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [size.widthMm, size.heightMm],
      quality: 1,
      cameraType: ImagePicker.CameraType.front,
    };
    const picked =
      source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (picked.canceled || !picked.assets[0]) return;

    setBusy(true);
    try {
      const photo = await makeIdPhoto(picked.assets[0].uri, size);
      const sheet = await makeIdSheet(photo.uri, size);
      setResult({ photo: photo.uri, sheet: sheet.image.uri, copies: sheet.copies, size });
    } catch (e) {
      Alert.alert('Could not make the photo', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    if (!result) return;
    await Sharing.shareAsync(result.photo, { mimeType: 'image/jpeg', dialogTitle: 'ID photo' });
  };

  const print = async () => {
    if (!result) return;
    try {
      await printPages([result.sheet], `ID photos (${result.size.label})`, 1);
    } catch (e) {
      Alert.alert('Could not print', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  /** Saves the sheet like a scan (Original filter keeps skin tones natural). */
  const save = () => {
    if (!result) return;
    reset();
    addPage(result.sheet);
    router.push({ pathname: '/enhance', params: { filter: 'original' } });
  };

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <LoadingOverlay visible={busy} message="Making your photo…" />
      <View className="h-16 flex-row items-center justify-between px-5">
        <Pressable
          onPress={() => goBackOr(router, '/(tabs)/tools')}
          accessibilityLabel="Back"
          className="h-12 w-12 items-center justify-center overflow-hidden rounded-full active:opacity-70"
        >
          <GlassBackground radius={24} />
          <Icon name="arrow-back" size={22} className="text-on-surface" />
        </Pressable>
        <Text className="font-inter-semibold text-[17px] text-on-surface">ID photo maker</Text>
        <View className="w-12" />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 24 }}>
        {result ? (
          <>
            <View className="mb-5 flex-row items-end gap-4 rounded-[28px] bg-surface-container p-4">
              <Image
                source={{ uri: result.photo }}
                style={{ width: 110, height: (110 * result.size.heightMm) / result.size.widthMm, borderRadius: 6 }}
                accessibilityLabel="Your ID photo"
              />
              <View className="flex-1">
                <Text className="font-inter-semibold text-[17px] text-on-surface">{result.size.label}</Text>
                <Text className="mt-0.5 font-inter text-[13px] text-on-surface-variant">{result.size.detail}</Text>
                <Text className="mt-2 font-inter text-[13px] text-on-surface-variant">
                  {result.copies} copies fit on a 4 × 6 in photo print.
                </Text>
              </View>
            </View>
            <Image
              source={{ uri: result.sheet }}
              style={{ width: '100%', aspectRatio: 4 / 6, borderRadius: 16, backgroundColor: '#fff' }}
              resizeMode="contain"
              accessibilityLabel="Sheet of copies"
            />
            <View className="mt-5 gap-3">
              <Pressable
                onPress={save}
                className="h-14 flex-row items-center justify-center gap-2 rounded-full bg-on-surface active:opacity-85"
              >
                <Icon name="save-alt" size={20} className="text-surface" />
                <Text className="font-inter-semibold text-[16px] text-surface">Save sheet to documents</Text>
              </Pressable>
              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => void share()}
                  className="h-14 flex-1 flex-row items-center justify-center gap-2 rounded-full border border-outline-variant active:bg-surface-container"
                >
                  <Icon name="share" size={20} className="text-on-surface" />
                  <Text className="font-inter-semibold text-[16px] text-on-surface">Share photo</Text>
                </Pressable>
                <Pressable
                  onPress={() => void print()}
                  className="h-14 flex-1 flex-row items-center justify-center gap-2 rounded-full border border-outline-variant active:bg-surface-container"
                >
                  <Icon name="print" size={20} className="text-on-surface" />
                  <Text className="font-inter-semibold text-[16px] text-on-surface">Print sheet</Text>
                </Pressable>
              </View>
              <Pressable onPress={() => setResult(null)} className="h-12 items-center justify-center">
                <Text className="font-inter-semibold text-[15px] text-on-surface-variant">Make another</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <Text className="mb-2 mt-2 font-inter-semibold text-[28px] tracking-[-0.6px] text-on-surface">
              Choose a size
            </Text>
            <Text className="mb-5 font-inter text-[15px] leading-[21px] text-on-surface-variant">
              Stand against a plain, light wall with even light. You crop the photo to the right shape next.
            </Text>
            <View className="mb-6 gap-2.5" accessibilityRole="radiogroup">
              {ID_PHOTO_SIZES.map((s) => {
                const active = s.key === size.key;
                return (
                  <Pressable
                    key={s.key}
                    onPress={() => setSize(s)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                    className={`flex-row items-center gap-3.5 rounded-[20px] border-2 bg-surface-container-lowest p-3.5 ${
                      active ? 'border-on-surface' : 'border-outline-variant/50'
                    }`}
                  >
                    <View className="h-12 w-12 items-center justify-center rounded-[14px] bg-surface-container">
                      <View
                        className="rounded-[3px] border-2 border-on-surface-variant"
                        style={{ width: (s.widthMm / Math.max(s.widthMm, s.heightMm)) * 26, height: (s.heightMm / Math.max(s.widthMm, s.heightMm)) * 26 }}
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="font-inter-semibold text-[16px] text-on-surface">{s.label}</Text>
                      <Text className="font-inter text-[13px] text-on-surface-variant">{s.detail}</Text>
                    </View>
                    {active ? <Icon name="check-circle" size={22} className="text-on-surface" /> : null}
                  </Pressable>
                );
              })}
            </View>
            <View className="gap-3">
              <Pressable
                onPress={() => void pick('camera')}
                className="h-14 flex-row items-center justify-center gap-2 rounded-full bg-on-surface active:opacity-85"
              >
                <Icon name="photo-camera" size={20} className="text-surface" />
                <Text className="font-inter-semibold text-[16px] text-surface">Take photo</Text>
              </Pressable>
              <Pressable
                onPress={() => void pick('library')}
                className="h-14 flex-row items-center justify-center gap-2 rounded-full border border-outline-variant active:bg-surface-container"
              >
                <Icon name="photo-library" size={20} className="text-on-surface" />
                <Text className="font-inter-semibold text-[16px] text-on-surface">Choose from gallery</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
