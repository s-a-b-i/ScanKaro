import { useLocalSearchParams, useRouter } from 'expo-router';
import { ComponentProps, useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../components/Icon';
import { GlassBackground } from '../components/Glass';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { FallbackCameraScan } from '../components/scan/FallbackCameraScan';
import { pastel, PastelName } from '../constants/pastel';
import { useTheme } from '../constants/theme';
import { useScan } from '../context/ScanProvider';
import {
  getNativeScannerUnavailableMessage,
  isNativeDocumentScannerAvailable,
  scanDocumentsNative,
} from '../services/nativeDocumentScanner';
import { cropDocumentFromUri } from '../utils/documentScan';
import { importFromGallery, prepareGalleryImage } from '../utils/galleryImport';
import { composeIdCard } from '../utils/idCard';
import { splitSpread } from '../utils/imageFiles';
import { pickImages } from '../utils/scanPicker';
import { formatStamp, stampImage } from '../utils/timestamp';
import { goBackOr } from '../utils/navigation';

type IconName = ComponentProps<typeof Icon>['name'];

const SCAN_MODES = ['single', 'batch', 'id', 'receipt', 'book', 'card', 'whiteboard', 'slides', 'timestamp'] as const;
type ScanMode = (typeof SCAN_MODES)[number];
/** Headline and one-line instruction for each mode, so the screen says what will happen. */
const MODE_COPY: Record<ScanMode, { title: string; hint: string }> = {
  single: {
    title: 'Ready to scan\nyour document?',
    hint: 'Edges are found and the page is straightened automatically. You can fine-tune the crop and lighting next.',
  },
  batch: { title: 'Scan several\npages at once', hint: 'Capture up to 20 pages in a row. They are saved together as one document.' },
  id: { title: 'Scan both sides\nof the card', hint: 'Capture the front, then the back. Both sides are placed on one page, like a photocopy.' },
  receipt: { title: 'Scan a\nreceipt', hint: 'Faded print is made darker and easier to read.' },
  book: { title: 'Scan an\nopen book', hint: 'Photograph two facing pages at once. Each photo is split into a left and a right page.' },
  card: { title: 'Scan a\nbusiness card', hint: 'The name, phone, email and company are read from the card, ready to save as a contact.' },
  whiteboard: { title: 'Scan a\nwhiteboard', hint: 'Glare and shadows are removed and the ink is made sharper.' },
  slides: { title: 'Scan\nslides', hint: 'Photos of a screen or projector are straightened and their colours cleaned up.' },
  timestamp: { title: 'Scan with\ndate and time', hint: "Each page gets today's date and time printed in the corner." },
};

/** Modes that capture several pages and then open Enhance with a matching filter. */
const MULTI_MODES: ScanMode[] = ['batch', 'book', 'whiteboard', 'slides', 'timestamp'];

function ModeCard({
  icon,
  title,
  subtitle,
  color,
  selected,
  onPress,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  color: PastelName;
  selected: boolean;
  onPress: () => void;
}) {
  const { isDark } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      className={`flex-1 rounded-[24px] border-2 p-3.5 active:opacity-80 ${
        selected ? 'border-on-surface' : 'border-transparent'
      }`}
      style={{ backgroundColor: pastel(color, isDark) }}
    >
      <View className="mb-3 flex-row items-start justify-between">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-white">
          <Icon name={icon} size={20} className="text-[#111111]" />
        </View>
        <View
          className={`h-6 w-6 items-center justify-center rounded-full border-2 ${
            selected ? 'border-on-surface bg-on-surface' : 'border-on-surface/30'
          }`}
        >
          {selected ? <Icon name="check" size={14} className="text-surface" /> : null}
        </View>
      </View>
      <Text className="font-inter-semibold text-[16px] tracking-tight text-on-surface" numberOfLines={1}>
        {title}
      </Text>
      <Text className="mt-0.5 font-inter text-[12px] text-on-surface-variant" numberOfLines={1}>
        {subtitle}
      </Text>
    </Pressable>
  );
}

function Tip({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View className="flex-row items-center gap-3">
      <View className="h-8 w-8 items-center justify-center rounded-full bg-surface-container">
        <Icon name={icon} size={16} className="text-on-surface-variant" />
      </View>
      <Text className="flex-1 font-inter text-[14px] text-on-surface-variant">{text}</Text>
    </View>
  );
}

export default function ScanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { folderId: folderParam, mode: modeParam } = useLocalSearchParams<{ folderId?: string; mode?: string }>();
  const { pageCount, setFolderId, addPage, discard } = useScan();
  const { colors } = useTheme();

  const [scanning, setScanning] = useState(false);
  const [mode, setMode] = useState<ScanMode>(() =>
    modeParam && (SCAN_MODES as readonly string[]).includes(modeParam) ? (modeParam as ScanMode) : 'single',
  );
  const batchMode = mode === 'batch';
  const [showFallbackCamera, setShowFallbackCamera] = useState(false);
  const [importing, setImporting] = useState(false);
  const [busyMessage, setBusyMessage] = useState('Finding page edges…');

  const nativeScanner = isNativeDocumentScannerAvailable();

  useEffect(() => {
    if (folderParam) {
      setFolderId(folderParam);
    }
  }, [folderParam, setFolderId]);

  const openNativeScanner = useCallback(async () => {
    if (scanning) return;

    setScanning(true);
    try {
      const images = await scanDocumentsNative({
        croppedImageQuality: 92,
        maxNumDocuments: MULTI_MODES.includes(mode) ? 20 : mode === 'id' ? 2 : 1,
      });

      // Cancelled: stay on this screen so the user can try again or import instead.
      if (!images?.length) return;

      if (mode === 'id') {
        await finishIdCard(images);
        return;
      }
      if (mode === 'card') {
        router.push({ pathname: '/card', params: { uri: images[0] } });
        return;
      }
      if (mode === 'book') {
        await finishBook(images);
        return;
      }
      if (mode === 'whiteboard' || mode === 'slides' || mode === 'timestamp') {
        await finishSpecial(images);
        return;
      }

      images.forEach((uri) => addPage(uri));

      if (mode === 'receipt') {
        // Gray boosts faded thermal print without the colour shifts of Enhance.
        router.push({ pathname: '/enhance', params: { filter: 'gray' } });
        return;
      }

      // The native scanner already found, cropped and straightened the pages.
      router.push('/enhance');
    } catch (error) {
      Alert.alert('Scanner error', error instanceof Error ? error.message : 'Could not open the document scanner.');
    } finally {
      setScanning(false);
    }
  }, [addPage, mode, router, scanning]);

  /** Puts front and back on one page, then opens Enhance (No Shadow keeps card photos natural). */
  const finishIdCard = async (cardUris: string[]) => {
    if (cardUris.length < 2) {
      // Only one side captured: keep it, and let the user add the back or go on without it.
      const front = cardUris[0];
      Alert.alert('Only one side captured', 'Scan the back of the card too, or use just this side.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Use front only',
          onPress: () => {
            addPage(front);
            router.push({ pathname: '/enhance', params: { filter: 'noShadow' } });
          },
        },
        {
          text: 'Scan the back',
          onPress: async () => {
            try {
              const back = await scanDocumentsNative({ croppedImageQuality: 92, maxNumDocuments: 1 });
              if (back?.length) await finishIdCard([front, back[0]]);
            } catch (error) {
              Alert.alert('Scanner error', error instanceof Error ? error.message : 'Could not open the scanner.');
            }
          },
        },
      ]);
      return;
    }
    setBusyMessage('Putting both sides on one page…');
    setImporting(true);
    try {
      const page = await composeIdCard(cardUris[0], cardUris[1]);
      addPage(page);
      router.push({ pathname: '/enhance', params: { filter: 'noShadow' } });
    } catch (error) {
      Alert.alert('Could not combine the sides', error instanceof Error ? error.message : 'Please scan the card again.');
    } finally {
      setImporting(false);
      setBusyMessage('Finding page edges…');
    }
  };

  /** Whiteboard and Slides open Enhance with their filter; Timestamp stamps the date and time on each page. */
  const finishSpecial = async (uris: string[]) => {
    if (mode === 'timestamp') {
      setBusyMessage('Adding date and time…');
      setImporting(true);
      try {
        const label = formatStamp();
        for (const uri of uris) addPage((await stampImage(uri, label)).uri);
      } catch (error) {
        Alert.alert('Could not add the timestamp', error instanceof Error ? error.message : 'Please try again.');
        return;
      } finally {
        setImporting(false);
        setBusyMessage('Finding page edges…');
      }
      router.push('/enhance');
      return;
    }
    uris.forEach((uri) => addPage(uri));
    router.push({ pathname: '/enhance', params: { filter: mode } });
  };

  /** Each two-page spread becomes two pages (left, then right). */
  const finishBook = async (spreads: string[]) => {
    setBusyMessage('Splitting pages…');
    setImporting(true);
    try {
      for (const spread of spreads) {
        const [left, right] = await splitSpread(spread);
        addPage(left.uri);
        addPage(right.uri);
      }
      router.push('/enhance');
    } catch (error) {
      Alert.alert('Could not split pages', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setImporting(false);
      setBusyMessage('Finding page edges…');
    }
  };

  const handleImportFromGallery = async () => {
    if (importing) return;
    if (mode === 'id') {
      // Pick the front, then the back.
      const photos = await pickImages(2);
      if (photos.length === 0) return;
      if (photos.length < 2) {
        Alert.alert('Pick both sides', 'Select two photos: the front and then the back of the card.');
        return;
      }
      setImporting(true);
      try {
        const cards = [];
        for (const photo of photos.slice(0, 2)) {
          const prepared = await prepareGalleryImage(photo);
          cards.push(prepared.corners ? await cropDocumentFromUri(prepared.uri, prepared.corners) : prepared.uri);
        }
        setImporting(false);
        await finishIdCard(cards);
      } catch (error) {
        Alert.alert('Import failed', error instanceof Error ? error.message : 'Could not import these photos.');
      } finally {
        setImporting(false);
      }
      return;
    }
    try {
      // Opens the gallery directly, then finds the page edges in the chosen photo.
      const page = await importFromGallery(() => setImporting(true));
      if (!page) return;

      if (mode === 'card' || mode === 'book' || mode === 'whiteboard' || mode === 'slides' || mode === 'timestamp') {
        // Crop to the detected edges straight away, then continue like a camera scan.
        const uri = page.corners ? await cropDocumentFromUri(page.uri, page.corners) : page.uri;
        setImporting(false);
        if (mode === 'card') router.push({ pathname: '/card', params: { uri } });
        else if (mode === 'book') await finishBook([uri]);
        else await finishSpecial([uri]);
        return;
      }

      if (batchMode) {
        // No crop screen in batch mode: crop to the detected page straight away.
        const uri = page.corners ? await cropDocumentFromUri(page.uri, page.corners) : page.uri;
        addPage(uri);
        router.push('/enhance');
      } else {
        // Crop screen opens with the frame already on the page; Next crops and straightens.
        addPage(page.uri, page.corners);
        // Receipts keep their Gray filter after the crop step, like camera scans.
        router.push(mode === 'receipt' ? { pathname: '/crop', params: { filter: 'gray' } } : '/crop');
      }
    } catch (error) {
      Alert.alert('Import failed', error instanceof Error ? error.message : 'Could not import this photo.');
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    if (pageCount > 0) {
      Alert.alert('Discard scan?', 'Your captured pages will be lost.', [
        { text: 'Keep Scanning', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            discard();
            goBackOr(router, '/(tabs)');
          },
        },
      ]);
      return;
    }
    goBackOr(router, '/(tabs)');
  };

  if (showFallbackCamera && !nativeScanner) {
    return <FallbackCameraScan batchMode={mode !== 'single'} onClose={handleClose} />;
  }

  const openCamera = () => (nativeScanner ? void openNativeScanner() : setShowFallbackCamera(true));

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <LoadingOverlay visible={importing} message={busyMessage} />

      {/* Top bar */}
      <View className="h-16 flex-row items-center justify-between px-5">
        <Pressable
          onPress={handleClose}
          hitSlop={6}
          accessibilityLabel="Close"
          className="h-12 w-12 items-center justify-center overflow-hidden rounded-full active:opacity-70"
        >
            <GlassBackground radius={24} />
          <Icon name="close" size={22} className="text-on-surface" />
        </Pressable>
        {pageCount > 0 ? (
          <View className="rounded-full bg-surface-container px-3 py-1.5">
            <Text className="font-inter-semibold text-[13px] text-on-surface">
              {pageCount} page{pageCount === 1 ? '' : 's'} added
            </Text>
          </View>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <Text className="mt-4 font-inter-semibold text-[38px] leading-[42px] tracking-[-1.4px] text-on-surface">
          {MODE_COPY[mode].title}
        </Text>
        <Text className="mb-7 mt-3 font-inter text-[15px] leading-[21px] text-on-surface-variant">
          {nativeScanner ? MODE_COPY[mode].hint : getNativeScannerUnavailableMessage()}
        </Text>

        <View className="mb-2.5 flex-row gap-2.5">
          <ModeCard
            icon="description"
            title="Single page"
            subtitle="One page at a time"
            color="blue"
            selected={mode === 'single'}
            onPress={() => setMode('single')}
          />
          <ModeCard
            icon="auto-stories"
            title="Batch"
            subtitle="Up to 20 pages"
            color="yellow"
            selected={mode === 'batch'}
            onPress={() => setMode('batch')}
          />
        </View>
        <View className="mb-2.5 flex-row gap-2.5">
          <ModeCard
            icon="badge"
            title="ID card"
            subtitle="Both sides, one page"
            color="green"
            selected={mode === 'id'}
            onPress={() => setMode('id')}
          />
          <ModeCard
            icon="receipt-long"
            title="Receipt"
            subtitle="Long, faded slips"
            color="pink"
            selected={mode === 'receipt'}
            onPress={() => setMode('receipt')}
          />
        </View>
        <View className="mb-2.5 flex-row gap-2.5">
          <ModeCard
            icon="menu-book"
            title="Book"
            subtitle="Two pages at once"
            color="blue"
            selected={mode === 'book'}
            onPress={() => setMode('book')}
          />
          <ModeCard
            icon="contact-page"
            title="Business card"
            subtitle="Save as a contact"
            color="yellow"
            selected={mode === 'card'}
            onPress={() => setMode('card')}
          />
        </View>
        <View className="mb-2.5 flex-row gap-2.5">
          <ModeCard
            icon="developer-board"
            title="Whiteboard"
            subtitle="Clean board, bold ink"
            color="green"
            selected={mode === 'whiteboard'}
            onPress={() => setMode('whiteboard')}
          />
          <ModeCard
            icon="slideshow"
            title="Slides"
            subtitle="Screens and projectors"
            color="pink"
            selected={mode === 'slides'}
            onPress={() => setMode('slides')}
          />
        </View>
        <View className="mb-6 flex-row gap-2.5">
          <ModeCard
            icon="schedule"
            title="Timestamp"
            subtitle="Date and time on page"
            color="blue"
            selected={mode === 'timestamp'}
            onPress={() => setMode('timestamp')}
          />
          <View className="flex-1" />
        </View>

        <Pressable
          onPress={() => router.push('/qr')}
          className="mb-7 flex-row items-center gap-4 rounded-[28px] border border-outline-variant/60 bg-surface-container-lowest p-4 active:opacity-75"
        >
          <View className="h-12 w-12 items-center justify-center rounded-full bg-on-surface">
            <Icon name="qr-code-scanner" size={22} className="text-surface" />
          </View>
          <View className="flex-1">
            <Text className="font-inter-semibold text-[17px] text-on-surface">QR code &amp; barcode</Text>
            <Text className="font-inter text-[13px] text-on-surface-variant">Links, Wi-Fi, contacts and products</Text>
          </View>
          <Icon name="chevron-right" size={24} className="text-on-surface-variant" />
        </Pressable>

        <View className="gap-3.5">
          <Tip icon="wb-sunny" text="Use good, even light and avoid glare" />
          <Tip icon="contrast" text="Place the page on a darker, contrasting surface" />
          <Tip icon="crop-free" text="Let the page fill most of the frame" />
        </View>
      </ScrollView>

      {/* Actions */}
      <View className="gap-3 overflow-hidden rounded-t-[28px] px-5 pt-4" style={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}>
        <GlassBackground radius={28} topOnly />
        <Pressable
          onPress={openCamera}
          disabled={scanning}
          className="h-[60px] flex-row items-center justify-center gap-2.5 rounded-full bg-on-surface active:opacity-85"
        >
          {scanning ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <Icon name="photo-camera" size={22} className="text-surface" />
          )}
          <Text className="font-inter-semibold text-[17px] text-surface">
            {nativeScanner ? 'Open camera' : 'Use basic camera'}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => void handleImportFromGallery()}
          className="h-[60px] flex-row items-center justify-center gap-2.5 rounded-full border border-outline-variant active:bg-surface-container"
        >
          <Icon name="photo-library" size={21} className="text-on-surface" />
          <Text className="font-inter-semibold text-[17px] text-on-surface">Import from gallery</Text>
        </Pressable>
        {!nativeScanner && Platform.OS !== 'web' ? (
          <Text className="text-center font-inter text-[12px] text-on-surface-variant">
            For live edge detection, use a development build (npx expo run:android).
          </Text>
        ) : null}
      </View>
    </View>
  );
}
