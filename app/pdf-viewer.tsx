import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../components/Icon';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { ScreenHeader } from '../components/ScreenHeader';
import { useTheme } from '../constants/theme';
import { useApp } from '../context/AppProvider';
import { localDocumentService } from '../services/local/library';
import { goBackOr } from '../utils/navigation';
import { baseName, getPdfPageCount, sharePdf } from '../utils/pdf';
import { RenderedPage, renderPage } from '../utils/pdfRender';

/** In-app PDF viewer: renders pages on the device, one after another. */
export default function PdfViewerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { colors } = useTheme();
  const { refreshDocuments } = useApp();
  const { uri, name } = useLocalSearchParams<{ uri: string; name?: string }>();
  const title = baseName(name ?? 'Document');

  const [pageCount, setPageCount] = useState<number | null>(null);
  const [pages, setPages] = useState<RenderedPage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!uri) return;
    let cancelled = false;
    void (async () => {
      try {
        const count = await getPdfPageCount(uri);
        if (cancelled) return;
        setPageCount(count);
        // Render sequentially so the first pages appear quickly and memory stays low.
        for (let i = 0; i < count && !cancelled; i++) {
          const page = await renderPage(uri, i);
          if (!cancelled) setPages((current) => [...current, page]);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not open this PDF.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uri]);

  const share = async () => {
    if (!uri) return;
    try {
      await sharePdf({ uri, name: name ?? `${title}.pdf`, pages: pageCount ?? 0, size: 0 });
    } catch (e) {
      Alert.alert('Could not share', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  /** Copies the rendered pages into the library as a new document. */
  const saveToLibrary = async () => {
    if (!pageCount || pages.length < pageCount) return;
    setSaving(true);
    try {
      const { documentId } = await localDocumentService.savePages(
        pages.map((p) => p.uri),
        { title },
      );
      await refreshDocuments();
      router.replace(`/document/${documentId}`);
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const allRendered = pageCount !== null && pages.length === pageCount;
  const pageWidth = screenWidth - 32;

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <LoadingOverlay visible={saving} message="Saving to your library…" />
      <ScreenHeader
        title={title}
        subtitle={pageCount === null ? 'Opening…' : `${pageCount} page${pageCount === 1 ? '' : 's'}`}
        onBack={() => goBackOr(router, '/pdf-tools')}
        right={
          <Pressable
            onPress={() => void share()}
            hitSlop={6}
            accessibilityLabel="Share PDF"
            className="h-11 w-11 items-center justify-center rounded-full active:bg-surface-container"
          >
            <Icon name="ios-share" size={22} className="text-on-surface" />
          </Pressable>
        }
      />

      {error ? (
        <View className="flex-1 items-center justify-center px-8">
          <Icon name="error-outline" size={40} className="mb-3 text-error" />
          <Text className="text-center font-inter-semibold text-[17px] text-on-surface">{error}</Text>
        </View>
      ) : (
        <FlatList
          data={pages}
          keyExtractor={(item, index) => `${item.uri}-${index}`}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 110, gap: 14 }}
          renderItem={({ item, index }) => (
            <View>
              <Image
                source={{ uri: item.uri }}
                style={{ width: pageWidth, height: (pageWidth * item.height) / item.width, backgroundColor: '#fff' }}
                className="rounded-xl"
                resizeMode="contain"
              />
              <Text className="mt-1.5 text-center font-inter text-[12px] text-on-surface-variant">
                {index + 1} / {pageCount}
              </Text>
            </View>
          )}
          ListFooterComponent={
            !allRendered ? (
              <View className="items-center py-6">
                <ActivityIndicator color={colors.primary} />
                <Text className="mt-2 font-inter text-[13px] text-on-surface-variant">
                  {pageCount ? `Rendering page ${pages.length + 1} of ${pageCount}…` : 'Opening PDF…'}
                </Text>
              </View>
            ) : null
          }
        />
      )}

      {allRendered && !error ? (
        <View className="absolute left-0 right-0 px-5" style={{ bottom: Math.max(insets.bottom, 12) + 8 }}>
          <Pressable
            onPress={() => void saveToLibrary()}
            className="h-14 flex-row items-center justify-center gap-2 rounded-full bg-on-surface active:opacity-85"
          >
            <Icon name="library-add" size={20} className="text-surface" />
            <Text className="font-inter-semibold text-[16px] text-surface">Save to library as images</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
