/**
 * ID Photo Maker: take or pick a portrait. The face is found and framed to the chosen
 * passport/visa size, the background is replaced with a solid colour, and a suit can be
 * fitted to the shoulders. Then share the photo, print a 4 x 6 inch sheet of copies, or
 * save the sheet to documents.
 */
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassBackground } from '../components/Glass';
import { Icon } from '../components/Icon';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { useScan } from '../context/ScanProvider';
import * as People from '../modules/person-segmentation';
import {
  Background,
  BACKGROUNDS,
  ID_PHOTO_SIZES,
  IdPhotoSize,
  makeIdSheet,
  PreparedPortrait,
  preparePortrait,
  RenderedIdPhoto,
  renderIdPhoto,
  Suit,
  SUITS,
} from '../utils/idPhoto';
import { goBackOr } from '../utils/navigation';
import { imageAtTrueSize } from '../utils/pdf';
import { printPdf } from '../utils/print';

type Result = { photo: RenderedIdPhoto; sheet: string; copies: number; size: IdPhotoSize };

const SUIT_SCALE_STEP = 0.05;
const SUIT_OFFSET_STEP = 0.15;

export default function IdPhotoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addPage, reset, setTitle } = useScan();
  const [size, setSize] = useState<IdPhotoSize>(ID_PHOTO_SIZES[0]);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [background, setBackground] = useState<Background>(BACKGROUNDS[0]);
  const [suit, setSuit] = useState<Suit>(SUITS[0]);
  const [suitScale, setSuitScale] = useState(1);
  const [suitOffset, setSuitOffset] = useState(0);
  // Face, shoulders and cut-out of the current photo (found once, reused for every option).
  const prepared = useRef<PreparedPortrait | null>(null);
  const renderId = useRef(0);
  // From the passport camera: the full photo, its size and the on-screen frame.
  const params = useLocalSearchParams<{ photo?: string; size?: string; frame?: string }>();

  const render = async (chosen: IdPhotoSize) => {
    const p = prepared.current;
    if (!p) return;
    const id = ++renderId.current;
    try {
      const photo = renderIdPhoto(p, chosen, { background, suit, suitScale, suitOffset });
      const sheet = await makeIdSheet(photo.uri, chosen);
      if (id !== renderId.current) return; // a newer option change won
      setResult({ photo, sheet: sheet.image.uri, copies: sheet.copies, size: chosen });
    } catch (e) {
      Alert.alert('Could not make the photo', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  const process = async (uri: string, chosen: IdPhotoSize, frame?: string) => {
    setBusy('Finding your face…');
    try {
      let frameRect = null;
      try {
        frameRect = frame ? JSON.parse(frame) : null;
      } catch {
        frameRect = null;
      }
      prepared.current = await preparePortrait(uri, frameRect);
      setBusy('Making your photo…');
      await render(chosen);
    } catch (e) {
      Alert.alert('Could not make the photo', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    if (!params.photo) return;
    const chosen = ID_PHOTO_SIZES.find((s) => s.key === params.size) ?? ID_PHOTO_SIZES[0];
    setSize(chosen);
    void process(params.photo, chosen, params.frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.photo]);

  // Re-render when an option changes (fast: the face and cut-out are already found).
  useEffect(() => {
    if (result) void render(result.size);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [background, suit, suitScale, suitOffset]);

  const pick = async (source: 'camera' | 'library') => {
    if (source === 'camera') {
      // Our own camera, with the passport frame and face guide.
      router.push({ pathname: '/passport-camera', params: { size: size.key } });
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo access to make an ID photo.');
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      // With face detection the head is framed automatically; without it, crop by hand.
      allowsEditing: !People.isAvailable,
      aspect: [size.widthMm, size.heightMm],
      quality: 1,
    });
    if (picked.canceled || !picked.assets[0]) return;
    await process(picked.assets[0].uri, size);
  };

  const share = async () => {
    if (!result) return;
    try {
      await Sharing.shareAsync(result.photo.uri, { mimeType: 'image/jpeg', dialogTitle: 'ID photo' });
    } catch (e) {
      Alert.alert('Could not share', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  const print = async () => {
    if (!result) return;
    try {
      // The 4 x 6 inch sheet at its real size on A4, so each photo prints at its true
      // size (35 x 45 mm etc.) instead of being stretched to fill the paper.
      const pdf = await imageAtTrueSize(result.sheet, 4, 6, `ID photos (${result.size.label})`);
      await printPdf(pdf.uri);
    } catch (e) {
      Alert.alert('Could not print', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  /** Saves the sheet like a scan (Original filter keeps skin tones natural). */
  const save = () => {
    if (!result) return;
    reset();
    addPage(result.sheet);
    setTitle(`ID photos (${result.size.label})`);
    router.push({ pathname: '/enhance', params: { filter: 'original' } });
  };

  const startOver = () => {
    prepared.current = null;
    setResult(null);
    setSuitScale(1);
    setSuitOffset(0);
  };

  const notices: string[] = [];
  if (result) {
    if (!result.photo.framed) notices.push('No face found, so the photo is centred. Face the camera with your eyes open.');
    if (background.color && !result.photo.cutOut) {
      notices.push(
        People.isAvailable
          ? 'Could not separate you from the background. Try a photo with more contrast behind you.'
          : 'Changing the background needs the latest app build.',
      );
    }
    if (suit.key !== 'none' && !result.photo.suited) notices.push('The suit needs a clearly visible face.');
  }

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <LoadingOverlay visible={busy != null} message={busy ?? ''} />
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
                source={{ uri: result.photo.uri }}
                style={{ width: 120, height: (120 * result.size.heightMm) / result.size.widthMm, borderRadius: 6 }}
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

            {notices.map((n) => (
              <View key={n} className="mb-3 flex-row items-start gap-2 rounded-[16px] bg-surface-container px-3.5 py-3">
                <Icon name="info-outline" size={18} className="text-on-surface-variant" />
                <Text className="flex-1 font-inter text-[13px] leading-[18px] text-on-surface-variant">{n}</Text>
              </View>
            ))}

            <Text className="mb-2.5 mt-1 font-inter-semibold text-[15px] text-on-surface">Background</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 4 }}>
              {BACKGROUNDS.map((b) => {
                const active = b.key === background.key;
                return (
                  <Pressable
                    key={b.key}
                    onPress={() => setBackground(b)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                    accessibilityLabel={`${b.label} background`}
                    className="items-center gap-1.5"
                  >
                    <View
                      className={`h-12 w-12 items-center justify-center rounded-full border-2 ${
                        active ? 'border-on-surface' : 'border-outline-variant/60'
                      }`}
                    >
                      <View
                        className="h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-outline-variant/40"
                        style={{ backgroundColor: b.color ?? 'transparent' }}
                      >
                        {b.color ? null : <Icon name="image" size={18} className="text-on-surface-variant" />}
                      </View>
                    </View>
                    <Text className="font-inter text-[12px] text-on-surface-variant">{b.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text className="mb-2.5 mt-4 font-inter-semibold text-[15px] text-on-surface">Suit</Text>
            <View className="flex-row flex-wrap gap-2">
              {SUITS.map((s) => {
                const active = s.key === suit.key;
                return (
                  <Pressable
                    key={s.key}
                    onPress={() => setSuit(s)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                    className={`h-10 flex-row items-center gap-2 rounded-full border px-4 ${
                      active ? 'border-on-surface bg-on-surface' : 'border-outline-variant'
                    }`}
                  >
                    {s.jacket ? <View className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: s.jacket }} /> : null}
                    <Text className={`font-inter-semibold text-[14px] ${active ? 'text-surface' : 'text-on-surface'}`}>
                      {s.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {suit.key !== 'none' && result.photo.suited ? (
              <View className="mt-3 gap-2">
                <Stepper
                  label="Suit size"
                  onMinus={() => setSuitScale((v) => Math.max(0.7, +(v - SUIT_SCALE_STEP).toFixed(2)))}
                  onPlus={() => setSuitScale((v) => Math.min(1.4, +(v + SUIT_SCALE_STEP).toFixed(2)))}
                  value={`${Math.round(suitScale * 100)}%`}
                />
                <Stepper
                  label="Suit position"
                  minusIcon="arrow-upward"
                  plusIcon="arrow-downward"
                  onMinus={() => setSuitOffset((v) => Math.max(-1.5, +(v - SUIT_OFFSET_STEP).toFixed(2)))}
                  onPlus={() => setSuitOffset((v) => Math.min(1.5, +(v + SUIT_OFFSET_STEP).toFixed(2)))}
                  value={suitOffset === 0 ? 'Auto' : suitOffset < 0 ? 'Higher' : 'Lower'}
                />
              </View>
            ) : null}

            <Text className="mb-2.5 mt-6 font-inter-semibold text-[15px] text-on-surface">Print sheet</Text>
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
              <Text className="text-center font-inter text-[13px] text-on-surface-variant">
                When printing, choose 100% or "Actual size" so the photos come out at their real size.
              </Text>
              <Pressable onPress={startOver} className="h-12 items-center justify-center">
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
              Face the camera with even light and your shoulders in view. Your face is framed and the background
              replaced automatically.
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

function Stepper({
  label,
  value,
  onMinus,
  onPlus,
  minusIcon = 'remove',
  plusIcon = 'add',
}: {
  label: string;
  value: string;
  onMinus: () => void;
  onPlus: () => void;
  minusIcon?: string;
  plusIcon?: string;
}) {
  return (
    <View className="h-12 flex-row items-center rounded-full bg-surface-container pl-4 pr-1.5">
      <Text className="flex-1 font-inter-medium text-[14px] text-on-surface">{label}</Text>
      <Text className="mr-2 font-inter text-[13px] text-on-surface-variant">{value}</Text>
      <Pressable
        onPress={onMinus}
        accessibilityLabel={`${label}: ${minusIcon === 'remove' ? 'smaller' : 'up'}`}
        className="h-9 w-9 items-center justify-center rounded-full active:bg-surface-container-high"
      >
        <Icon name={minusIcon as never} size={20} className="text-on-surface" />
      </Pressable>
      <Pressable
        onPress={onPlus}
        accessibilityLabel={`${label}: ${plusIcon === 'add' ? 'bigger' : 'down'}`}
        className="h-9 w-9 items-center justify-center rounded-full active:bg-surface-container-high"
      >
        <Icon name={plusIcon as never} size={20} className="text-on-surface" />
      </Pressable>
    </View>
  );
}
