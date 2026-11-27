/**
 * Photo translation: read the text in a photo or saved document, then translate it on the
 * phone (e.g. English to Urdu). Opened with ?documentId= for a saved document.
 */
import TextRecognition from '@react-native-ml-kit/text-recognition';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassBackground } from '../components/Glass';
import { Icon } from '../components/Icon';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { useToast } from '../components/Toast';
import { localDocumentService } from '../services/local/library';
import { goBackOr } from '../utils/navigation';
import { shareText } from '../utils/ocr';
import { orderBlocks } from '../utils/readingOrder';
import { FROM_LANGUAGES, Lang, TO_LANGUAGES, translateText } from '../utils/translate';

const RTL_CODES = ['ur', 'ar', 'fa', 'he'];

function Chips({ items, value, onChange }: { items: Lang[]; value: Lang; onChange: (l: Lang) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-5" style={{ flexGrow: 0 }}>
      {items.map((l) => {
        const active = l.code === value.code;
        return (
          <Pressable
            key={l.code}
            onPress={() => onChange(l)}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            className={`h-10 justify-center rounded-full px-4 ${active ? 'bg-on-surface' : 'bg-surface-container'}`}
          >
            <Text className={`font-inter-semibold text-[14px] ${active ? 'text-surface' : 'text-on-surface'}`}>{l.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export default function TranslateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { documentId } = useLocalSearchParams<{ documentId?: string }>();
  const [from, setFrom] = useState<Lang>(FROM_LANGUAGES[0]);
  const [to, setTo] = useState<Lang>(TO_LANGUAGES[0]);
  const [pages, setPages] = useState<string[]>([]);
  const [title, setTitle] = useState('Translation');
  const [source, setSource] = useState('');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!documentId) return;
    void localDocumentService.getById(documentId).then((doc) => {
      if (!doc?.pageUrls?.length) return;
      setTitle(doc.title);
      setPages(doc.pageUrls);
    });
  }, [documentId]);

  const pick = async (kind: 'camera' | 'library') => {
    const perm =
      kind === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow access to pick a photo to translate.');
      return;
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.9 };
    const picked = kind === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (picked.canceled || !picked.assets[0]) return;
    setTitle('Translation');
    setPages([picked.assets[0].uri]);
    setSource('');
    setResult('');
  };

  const run = async () => {
    if (pages.length === 0) return;
    try {
      setBusy('Reading text…');
      const parts: string[] = [];
      for (let i = 0; i < pages.length; i++) {
        const r = await TextRecognition.recognize(pages[i], from.script);
        const text = orderBlocks(r.blocks)
          .map((b) => b.text.trim())
          .filter(Boolean)
          .join('\n\n');
        parts.push(pages.length > 1 ? `— Page ${i + 1} —\n\n${text}` : text);
      }
      const read = parts.join('\n\n').trim();
      setSource(read);
      if (!read) throw new Error('No text was found. Try a sharper photo with more light.');
      setBusy('Translating… (the first time downloads the language, about 30 MB)');
      setResult(
        await translateText(read, from.code, to.code, (done, total) =>
          setBusy(`Translating… ${Math.round((done / total) * 100)}%`),
        ),
      );
    } catch (e) {
      Alert.alert('Could not translate', e instanceof Error ? e.message : 'Check your internet connection the first time.');
    } finally {
      setBusy(null);
    }
  };

  const rtl = RTL_CODES.includes(to.code);

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <LoadingOverlay visible={!!busy} message={busy ?? ''} />
      <View className="h-16 flex-row items-center justify-between px-5">
        <Pressable
          onPress={() => goBackOr(router, '/(tabs)/tools')}
          accessibilityLabel="Back"
          className="h-12 w-12 items-center justify-center overflow-hidden rounded-full active:opacity-70"
        >
          <GlassBackground radius={24} />
          <Icon name="arrow-back" size={22} className="text-on-surface" />
        </Pressable>
        <Text className="font-inter-semibold text-[17px] text-on-surface">Photo translation</Text>
        <View className="w-12" />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <Text className="mb-2 mt-2 px-5 font-inter-semibold text-[13px] uppercase tracking-[0.8px] text-on-surface-variant">
          From
        </Text>
        <Chips items={FROM_LANGUAGES} value={from} onChange={setFrom} />
        <Text className="mb-2 mt-4 px-5 font-inter-semibold text-[13px] uppercase tracking-[0.8px] text-on-surface-variant">
          To
        </Text>
        <Chips items={TO_LANGUAGES} value={to} onChange={setTo} />

        <View className="mx-5 mt-5 flex-row gap-3">
          <Pressable
            onPress={() => void pick('camera')}
            className="h-14 flex-1 flex-row items-center justify-center gap-2 rounded-full border border-outline-variant active:bg-surface-container"
          >
            <Icon name="photo-camera" size={20} className="text-on-surface" />
            <Text className="font-inter-semibold text-[15px] text-on-surface">Camera</Text>
          </Pressable>
          <Pressable
            onPress={() => void pick('library')}
            className="h-14 flex-1 flex-row items-center justify-center gap-2 rounded-full border border-outline-variant active:bg-surface-container"
          >
            <Icon name="photo-library" size={20} className="text-on-surface" />
            <Text className="font-inter-semibold text-[15px] text-on-surface">Gallery</Text>
          </Pressable>
        </View>
        <Text className="mx-5 mt-2 font-inter text-[13px] text-on-surface-variant">
          {pages.length
            ? `${pages.length === 1 ? '1 page' : `${pages.length} pages`} ready${documentId ? ` · ${title}` : ''}`
            : 'Take or choose a photo with text.'}
        </Text>

        <Pressable
          onPress={() => void run()}
          disabled={pages.length === 0}
          className={`mx-5 mt-4 h-14 flex-row items-center justify-center gap-2 rounded-full bg-on-surface ${
            pages.length === 0 ? 'opacity-40' : 'active:opacity-85'
          }`}
        >
          <Icon name="translate" size={20} className="text-surface" />
          <Text className="font-inter-semibold text-[16px] text-surface">Translate to {to.label}</Text>
        </Pressable>

        {result ? (
          <View className="mx-5 mt-6 rounded-[24px] bg-surface-container-lowest p-4">
            <View className="mb-2 flex-row items-center justify-between">
              <Text className="font-inter-semibold text-[15px] text-on-surface">{to.label}</Text>
              <View className="flex-row gap-1">
                <Pressable
                  onPress={() => void Clipboard.setStringAsync(result).then(() => toast.show('Copied'))}
                  accessibilityLabel="Copy translation"
                  className="h-11 w-11 items-center justify-center rounded-full active:bg-surface-container"
                >
                  <Icon name="content-copy" size={20} className="text-on-surface" />
                </Pressable>
                <Pressable
                  onPress={() => void shareText(result, `${title} (${to.label})`)}
                  accessibilityLabel="Share translation"
                  className="h-11 w-11 items-center justify-center rounded-full active:bg-surface-container"
                >
                  <Icon name="share" size={20} className="text-on-surface" />
                </Pressable>
              </View>
            </View>
            <Text
              selectable
              className="font-inter text-[16px] leading-[26px] text-on-surface"
              style={rtl ? { textAlign: 'right', writingDirection: 'rtl' } : undefined}
            >
              {result}
            </Text>
          </View>
        ) : null}
        {source ? (
          <View className="mx-5 mt-3 rounded-[24px] bg-surface-container p-4">
            <Text className="mb-2 font-inter-semibold text-[15px] text-on-surface-variant">Original ({from.label})</Text>
            <Text selectable className="font-inter text-[14px] leading-[21px] text-on-surface-variant">
              {source}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
