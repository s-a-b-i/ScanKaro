/**
 * Business card maker, step 2: your details and customisation for the chosen design, with a
 * live card that flips in 3D. Share a side as a print-ready image (3.5 x 2 in at 300 dpi),
 * both sides as a PDF, or save both sides to your documents.
 */
import type { SkImage } from '@shopify/react-native-skia';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FlipCard } from '../components/FlipCard';
import { GlassBackground } from '../components/Glass';
import { Icon } from '../components/Icon';
import { KeyboardAvoid } from '../components/KeyboardAvoid';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { useTheme } from '../constants/theme';
import { useScan } from '../context/ScanProvider';
import {
  ACCENTS,
  CARD_FONTS,
  CARD_H,
  CARD_TEMPLATES,
  CARD_W,
  CardData,
  CardSide,
  CardStyle,
  CardTemplate,
  isCardEmpty,
  keepLogo,
  loadCard,
  loadCardFonts,
  renderCardBase64,
  SAMPLE_CARD,
  saveCard,
  saveCardJpeg,
  saveCardPng,
} from '../utils/cardMaker';
import { goBackOr } from '../utils/navigation';
import { imagesToPdf, sharePdf } from '../utils/pdf';
import { loadImage } from '../utils/skiaImage';

type Field = {
  key: keyof Omit<CardData, 'qr'>;
  label: string;
  keyboard?: 'phone-pad' | 'email-address' | 'url';
  autoCap?: 'none' | 'words' | 'sentences';
};

const FIELDS: Field[] = [
  { key: 'name', label: 'Full name', autoCap: 'words' },
  { key: 'title', label: 'Job title', autoCap: 'words' },
  { key: 'company', label: 'Company or brand', autoCap: 'words' },
  { key: 'tagline', label: 'Tagline', autoCap: 'sentences' },
  { key: 'phone', label: 'Phone', keyboard: 'phone-pad' },
  { key: 'email', label: 'Email', keyboard: 'email-address', autoCap: 'none' },
  { key: 'website', label: 'Website', keyboard: 'url', autoCap: 'none' },
  { key: 'address', label: 'Address', autoCap: 'sentences' },
];

const uri = (b64: string) => `data:image/png;base64,${b64}`;

function SectionLabel({ children }: { children: string }) {
  return <Text className="mb-2 mt-7 font-inter-semibold text-[13px] uppercase tracking-[0.8px] text-on-surface-variant">{children}</Text>;
}

export default function CardDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { reset, addPage, setTitle } = useScan();
  const params = useLocalSearchParams<{ template?: string }>();
  const [card, setCard] = useState(() => {
    const saved = loadCard();
    const chosen = CARD_TEMPLATES.find((t) => t.key === params.template)?.key;
    return chosen && chosen !== saved.template ? { ...saved, template: chosen as CardTemplate, style: { ...saved.style, accent: undefined } } : saved;
  });
  const { data, template, style } = card;
  const [logo, setLogo] = useState<SkImage | null>(null);
  const [preview, setPreview] = useState<{ front?: string; back?: string }>({});
  const [busy, setBusy] = useState(false);
  // Real typefaces (Inter Tight, Playfair Display, Barlow Condensed); redraw once loaded.
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    loadCardFonts()
      .catch(() => undefined)
      .finally(() => setFontsReady(true));
  }, []);

  const empty = isCardEmpty(data);
  const shown = useMemo<CardData>(() => (empty ? { ...SAMPLE_CARD, qr: data.qr } : data), [empty, data]);
  const label = CARD_TEMPLATES.find((t) => t.key === template)?.label ?? '';
  const defaultAccent = CARD_TEMPLATES.find((t) => t.key === template)?.accent;

  useEffect(() => {
    if (!style.logo) {
      setLogo(null);
      return;
    }
    loadImage(style.logo).then(setLogo).catch(() => setLogo(null));
  }, [style.logo]);

  useEffect(() => {
    if (!fontsReady) return;
    const t = setTimeout(() => {
      try {
        const o = { style, logo };
        setPreview({ front: uri(renderCardBase64(shown, template, 'front', 760, o)), back: uri(renderCardBase64(shown, template, 'back', 760, o)) });
      } catch {
        // Keep the last preview.
      }
      saveCard(data, template, style);
    }, 150);
    return () => clearTimeout(t);
  }, [shown, data, template, style, logo, fontsReady]);

  const setField = (key: keyof CardData, value: string | boolean) => setCard((c) => ({ ...c, data: { ...c.data, [key]: value } }));
  const setStyle = (patch: Partial<CardStyle>) => setCard((c) => ({ ...c, style: { ...c.style, ...patch } }));

  const pickLogo = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to add your logo.');
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (picked.canceled || !picked.assets[0]) return;
    try {
      setStyle({ logo: keepLogo(picked.assets[0].uri) });
    } catch (e) {
      Alert.alert('Could not add the logo', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  const ready = Boolean(data.name.trim());
  const opts = { style, logo };

  const shareSide = async (side: CardSide) => {
    try {
      await Sharing.shareAsync(saveCardPng(data, template, side, opts), { mimeType: 'image/png', dialogTitle: `Card ${side}` });
    } catch (e) {
      Alert.alert('Could not share', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  const sharePdfBoth = async () => {
    setBusy(true);
    try {
      const pdf = await imagesToPdf([saveCardJpeg(data, template, 'front', opts), saveCardJpeg(data, template, 'back', opts)], {
        title: `${data.name.trim() || 'Business'} card`,
        pageSize: 'fit',
      });
      setBusy(false);
      await sharePdf(pdf);
    } catch (e) {
      setBusy(false);
      Alert.alert('Could not make the PDF', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  const share = () =>
    Alert.alert('Share card', undefined, [
      { text: 'Both sides (PDF)', onPress: () => void sharePdfBoth() },
      { text: 'Front (image)', onPress: () => void shareSide('front') },
      { text: 'Back (image)', onPress: () => void shareSide('back') },
    ]);

  const saveToDocuments = () => {
    try {
      const f = saveCardJpeg(data, template, 'front', opts);
      const b = saveCardJpeg(data, template, 'back', opts);
      reset();
      setTitle(`${data.name.trim() || 'Business'} card`);
      addPage(f);
      addPage(b);
      router.push({ pathname: '/enhance', params: { filter: 'original' } });
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  return (
    <KeyboardAvoid className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <LoadingOverlay visible={busy} message="Making the PDF…" />
      <View className="h-16 flex-row items-center justify-between px-5">
        <Pressable
          onPress={() => goBackOr(router, '/card-maker')}
          accessibilityLabel="Back to designs"
          className="h-12 w-12 items-center justify-center overflow-hidden rounded-full active:opacity-70"
        >
          <GlassBackground radius={24} />
          <Icon name="arrow-back" size={22} className="text-on-surface" />
        </Pressable>
        <Text className="font-inter-semibold text-[17px] text-on-surface">{label} card</Text>
        <Pressable onPress={() => goBackOr(router, '/card-maker')} hitSlop={8} className="h-12 justify-center">
          <Text className="font-inter-semibold text-[14px] text-on-surface-variant">Change</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 120 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View className="mt-3">
          <FlipCard front={preview.front} back={preview.back} ratio={CARD_W / CARD_H} />
        </View>
        {empty ? (
          <Text className="mt-3 text-center font-inter text-[13px] text-on-surface-variant">Showing sample details until you type yours.</Text>
        ) : null}

        <SectionLabel>Your details</SectionLabel>
        <View className="overflow-hidden rounded-[22px] bg-surface-container-lowest">
          {FIELDS.map((field, i) => (
            <View key={field.key} className={`px-4 py-2.5 ${i > 0 ? 'border-t border-outline-variant/40' : ''}`}>
              <Text className="font-inter-medium text-[12px] text-on-surface-variant">{field.label}</Text>
              <TextInput
                value={data[field.key]}
                onChangeText={(v) => setField(field.key, v)}
                keyboardType={field.keyboard ?? 'default'}
                autoCapitalize={field.autoCap ?? 'sentences'}
                autoCorrect={false}
                placeholder={SAMPLE_CARD[field.key]}
                placeholderTextColor={`${colors['on-surface-variant']}70`}
                className="py-1 font-inter text-[16px] text-on-surface"
              />
            </View>
          ))}
          <View className="flex-row items-center justify-between border-t border-outline-variant/40 px-4 py-3">
            <View className="flex-1 pr-3">
              <Text className="font-inter-semibold text-[15px] text-on-surface">Contact QR code</Text>
              <Text className="font-inter text-[12px] text-on-surface-variant">Scan the card to save your contact</Text>
            </View>
            <Switch value={data.qr} onValueChange={(v) => setField('qr', v)} />
          </View>
        </View>

        <SectionLabel>Customize</SectionLabel>
        <View className="rounded-[22px] bg-surface-container-lowest p-4">
          <Text className="font-inter-semibold text-[15px] text-on-surface">Colour</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4 mt-3" contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
            <Pressable
              onPress={() => setStyle({ accent: undefined })}
              accessibilityLabel="Design's own colour"
              className={`h-11 flex-row items-center gap-2 rounded-full border-2 px-3 ${style.accent ? 'border-outline-variant/60' : 'border-on-surface'}`}
            >
              <View className="h-6 w-6 rounded-full" style={{ backgroundColor: defaultAccent, borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)' }} />
              <Text className="font-inter-semibold text-[13px] text-on-surface">Original</Text>
            </Pressable>
            {ACCENTS.map((hex) => (
              <Pressable
                key={hex}
                onPress={() => setStyle({ accent: hex })}
                accessibilityLabel={`Colour ${hex}`}
                className={`h-11 w-11 items-center justify-center rounded-full border-2 ${style.accent === hex ? 'border-on-surface' : 'border-transparent'}`}
              >
                <View className="h-8 w-8 rounded-full" style={{ backgroundColor: hex, borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)' }} />
              </Pressable>
            ))}
          </ScrollView>

          <Text className="mt-5 font-inter-semibold text-[15px] text-on-surface">Font</Text>
          <View className="mt-3 flex-row rounded-full bg-surface-container p-1" accessibilityRole="radiogroup">
            {CARD_FONTS.map((f) => {
              const active = style.font === f.key;
              return (
                <Pressable
                  key={f.key}
                  onPress={() => setStyle({ font: f.key })}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  className={`h-10 flex-1 items-center justify-center rounded-full ${active ? 'bg-on-surface' : ''}`}
                >
                  <Text
                    className={`text-[14px] ${active ? 'text-surface' : 'text-on-surface'}`}
                    style={{
                      fontFamily:
                        f.key === 'serif' ? 'PlayfairDisplay_700Bold' : f.key === 'condensed' ? 'BarlowCondensed_600SemiBold' : 'InterTight_600SemiBold',
                    }}
                  >
                    {f.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text className="mt-5 font-inter-semibold text-[15px] text-on-surface">Logo</Text>
          <View className="mt-3 flex-row items-center gap-3">
            <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-surface-container">
              {style.logo ? (
                <Image source={{ uri: style.logo }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
              ) : (
                <Icon name="image" size={24} className="text-on-surface-variant" />
              )}
            </View>
            <Pressable onPress={() => void pickLogo()} className="h-11 flex-row items-center gap-1.5 rounded-full border border-outline-variant px-4 active:bg-surface-container">
              <Icon name="add-photo-alternate" size={18} className="text-on-surface" />
              <Text className="font-inter-semibold text-[14px] text-on-surface">{style.logo ? 'Change' : 'Add logo'}</Text>
            </Pressable>
            {style.logo ? (
              <Pressable onPress={() => setStyle({ logo: undefined })} className="h-11 justify-center px-3">
                <Text className="font-inter-semibold text-[14px] text-on-surface-variant">Remove</Text>
              </Pressable>
            ) : null}
          </View>
          <Text className="mt-2 font-inter text-[12px] text-on-surface-variant">Replaces the wordmark or monogram. A PNG with a transparent background looks best.</Text>
        </View>
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 overflow-hidden rounded-t-[28px] px-5 pt-4" style={{ paddingBottom: insets.bottom + 14 }}>
        <GlassBackground radius={28} topOnly />
        <View className="flex-row gap-3">
          <Pressable
            onPress={share}
            disabled={!ready}
            className={`h-14 flex-1 flex-row items-center justify-center gap-2 rounded-full border border-outline-variant ${ready ? 'active:bg-surface-container' : 'opacity-40'}`}
          >
            <Icon name="share" size={20} className="text-on-surface" />
            <Text className="font-inter-semibold text-[16px] text-on-surface">Share</Text>
          </Pressable>
          <Pressable
            onPress={saveToDocuments}
            disabled={!ready}
            className={`h-14 flex-1 flex-row items-center justify-center gap-2 rounded-full bg-on-surface ${ready ? 'active:opacity-85' : 'opacity-40'}`}
          >
            <Icon name="save-alt" size={20} className="text-surface" />
            <Text className="font-inter-semibold text-[16px] text-surface">Save both sides</Text>
          </Pressable>
        </View>
        {!ready ? <Text className="mt-2 text-center font-inter text-[12px] text-on-surface-variant">Add your name to share or save.</Text> : null}
      </View>
    </KeyboardAvoid>
  );
}
