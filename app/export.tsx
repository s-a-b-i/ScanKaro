import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CreateFolderSheet } from '../components/CreateFolderSheet';
import { Icon } from '../components/Icon';
import { GlassBackground } from '../components/Glass';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { ScreenHeader } from '../components/ScreenHeader';
import { appConfig } from '../constants/config';
import { useApp } from '../context/AppProvider';
import { useScan } from '../context/ScanProvider';
import { uploadScanPages } from '../services/uploadScan';
import { imagesToPdf, PdfFileSize, sharePdf } from '../utils/pdf';
import { pageSizeFor } from '../utils/pageShape';
import { clearTempFiles } from '../utils/tempFiles';
import { goBackOr } from '../utils/navigation';

const QUALITY_LABELS = ['Low', 'Medium', 'High'];
/** PDF image quality for each label: smaller files at Low, sharpest at High. */
const QUALITY_SIZES: PdfFileSize[] = ['smaller', 'medium', 'standard'];

export default function ExportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { folders, createFolder, refreshDocuments, refreshFolders } = useApp();
  const { pages, pageCount, title, folderId, documentId, setTitle, setFolderId, reset } = useScan();

  const [showFolders, setShowFolders] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [format, setFormat] = useState<'PDF' | 'JPEG'>('PDF');
  const [pageSize, setPageSize] = useState<'A4' | 'Letter' | 'Fit'>('A4');
  const [sharing, setSharing] = useState(false);
  const [quality, setQuality] = useState(3);
  const [saving, setSaving] = useState(false);

  // Receipts (long, narrow pages) default to a page cut to their shape.
  useEffect(() => {
    let alive = true;
    void pageSizeFor(pages).then((size) => alive && size === 'fit' && setPageSize('Fit'));
    return () => {
      alive = false;
    };
  }, [pages]);

  useEffect(() => {
    if (!title && pages.length > 0) {
      const date = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      setTitle(`Scan ${date}`);
    }
  }, [pages.length, title, setTitle]);

  const selectedFolder = folders.find((f) => f.id === folderId);
  const previewUri = pages[0];

  if (pageCount === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-surface px-8" style={{ paddingTop: insets.top }}>
        <Text className="mb-4 text-center font-inter text-body-lg text-on-surface-variant">
          No pages to export. Scan a document first.
        </Text>
        <Pressable onPress={() => router.replace('/scan')} className="rounded-xl bg-primary px-6 py-3">
          <Text className="font-inter-semibold text-title-md text-on-primary">Start Scanning</Text>
        </Pressable>
      </View>
    );
  }

  const save = async () => {
    const docTitle = title.trim() || 'Untitled Scan';

    setSaving(true);
    try {
      const { documentId: savedId } = await uploadScanPages(pages, {
        title: docTitle,
        folderId,
        documentId,
      });
      await Promise.all([refreshDocuments(), refreshFolders()]);
      reset();
      // Pages are now copied into the library; working files are no longer needed.
      clearTempFiles();
      // Close the scan flow (Scan, Crop, Enhance, Save) so Back from the document goes Home.
      router.dismissAll();
      router.push(`/document/${savedId}`);
    } catch (error) {
      Alert.alert(
        appConfig.cloud.enabled ? 'Upload failed' : 'Save failed',
        error instanceof Error ? error.message : 'Could not save your document. Try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    if (pages.length === 0) return;
    const docTitle = title.trim() || 'Scan';
    try {
      if (format === 'PDF') {
        // Build a real PDF of every page and open the share sheet (save, send, print).
        setSharing(true);
        const pdf = await imagesToPdf(pages, {
          title: docTitle,
          pageSize: pageSize === 'A4' ? 'a4' : pageSize === 'Letter' ? 'letter' : 'fit',
          size: QUALITY_SIZES[quality - 1],
          searchable: true,
        });
        setSharing(false);
        await sharePdf(pdf);
      } else {
        // JPEG: share the page image as a file.
        await Sharing.shareAsync(pages[0], { mimeType: 'image/jpeg', dialogTitle: docTitle });
      }
    } catch (error) {
      setSharing(false);
      Alert.alert('Could not share', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const handleCreateFolder = async (name: string) => {
    setCreatingFolder(true);
    try {
      const folder = await createFolder(name);
      setFolderId(folder.id);
      setShowCreateFolder(false);
      setShowFolders(false);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Could not create folder');
    } finally {
      setCreatingFolder(false);
    }
  };

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <ScreenHeader title="Save Document" onBack={() => goBackOr(router, '/scan')} />
      <LoadingOverlay visible={saving} message={appConfig.cloud.enabled ? 'Uploading your scan…' : 'Saving your scan…'} />
      <LoadingOverlay visible={sharing} message="Creating PDF…" />

      <ScrollView contentContainerClassName="gap-stack-lg px-margin-mobile pb-36 pt-stack-lg">
        <View className="flex-row gap-gutter">
          <View className="aspect-[3/4] w-1/3 overflow-hidden rounded-2xl bg-white">
            <Image source={{ uri: previewUri }} className="h-full w-full" resizeMode="cover" />
            <View className="absolute bottom-2 left-2 right-2 items-center rounded-full bg-black/60 py-1">
              <Text className="font-inter-semibold text-[11px] text-white">
                Page 1 of {pageCount}
              </Text>
            </View>
          </View>

          <View className="flex-1 gap-gutter">
            <View className="gap-1">
              <Text className="ml-1 font-inter text-label-md text-on-surface-variant">Document Name</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Enter document name"
                placeholderTextColor="#6d7a77"
                className="h-12 rounded-2xl bg-surface-container-lowest px-4 font-inter text-body-lg text-on-surface"
              />
            </View>

            <View className="gap-1">
              <Text className="ml-1 font-inter text-label-md text-on-surface-variant">Save to Folder</Text>
              <Pressable
                onPress={() => setShowFolders((v) => !v)}
                className="h-12 flex-row items-center justify-between rounded-2xl bg-surface-container-lowest px-4"
              >
                <View className="flex-row items-center gap-3">
                  <Icon name="folder" size={20} className="text-primary" />
                  <Text className="font-inter text-body-lg text-on-surface">
                    {selectedFolder?.title ?? 'Root (no folder)'}
                  </Text>
                </View>
                <Icon name="expand-more" size={22} className="text-on-surface-variant" />
              </Pressable>
              {showFolders ? (
                <View className="mt-2 overflow-hidden rounded-2xl bg-surface-container-lowest">
                  <Pressable
                    onPress={() => {
                      setFolderId(null);
                      setShowFolders(false);
                    }}
                    className={`flex-row items-center gap-3 p-3 ${folderId == null ? 'bg-primary/10' : ''}`}
                  >
                    <Icon name="home" size={18} className="text-on-surface" />
                    <Text className="font-inter text-body-lg text-on-surface">Root (no folder)</Text>
                  </Pressable>
                  {folders.map((folder) => (
                    <Pressable
                      key={folder.id}
                      onPress={() => {
                        setFolderId(folder.id);
                        setShowFolders(false);
                      }}
                      className={`flex-row items-center gap-3 p-3 ${folderId === folder.id ? 'bg-primary/10' : ''}`}
                    >
                      {folderId === folder.id ? (
                        <Icon name="check" size={18} className="text-primary" />
                      ) : (
                        <Icon name="folder" size={18} className="text-on-surface" />
                      )}
                      <Text className="font-inter text-body-lg text-on-surface">{folder.title}</Text>
                    </Pressable>
                  ))}
                  <Pressable
                    onPress={() => {
                      setShowFolders(false);
                      setShowCreateFolder(true);
                    }}
                    className="flex-row items-center gap-3 border-t border-outline-variant/30 p-3"
                  >
                    <Icon name="create-new-folder" size={18} className="text-primary" />
                    <Text className="font-inter text-body-lg text-primary">New Folder</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {pageCount > 1 ? (
          <View>
            <Text className="mb-2 ml-1 font-inter text-label-md text-on-surface-variant">All pages</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2.5">
              {pages.map((uri, index) => (
                <View key={`${uri}-${index}`} className="h-[104px] w-[78px] overflow-hidden rounded-xl bg-white">
                  <Image source={{ uri }} className="h-full w-full" resizeMode="cover" />
                  <View className="absolute bottom-1 right-1 rounded-full bg-black/60 px-1.5">
                    <Text className="font-inter-semibold text-[11px] text-white">{index + 1}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View className="gap-gutter">
          <View className="rounded-3xl bg-surface-container-lowest p-4">
            <Text className="mb-3 font-inter text-label-md text-on-surface-variant">Export Format</Text>
            <View className="flex-row rounded-full bg-surface-container p-1">
              {(['PDF', 'JPEG'] as const).map((f) => (
                <Pressable
                  key={f}
                  onPress={() => setFormat(f)}
                  className={`flex-1 items-center rounded-full py-2 ${format === f ? 'bg-primary' : ''}`}
                >
                  <Text className={`font-inter-semibold text-title-md ${format === f ? 'text-on-primary' : 'text-secondary'}`}>
                    {f}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text className="mt-2 font-inter text-body-sm text-on-surface-variant">
              {format === 'PDF'
                ? 'Share creates a PDF of all pages. Save keeps the pages in your library.'
                : 'Share sends the page as a JPEG image. Save keeps the pages in your library.'}
            </Text>
          </View>

          <View className={`rounded-3xl bg-surface-container-lowest p-4 ${format === 'PDF' ? '' : 'opacity-50'}`}>
            <Text className="mb-3 font-inter text-label-md text-on-surface-variant">PDF Page Size</Text>
            <View className="flex-row rounded-full bg-surface-container p-1">
              {(['A4', 'Letter', 'Fit'] as const).map((size) => (
                <Pressable
                  key={size}
                  onPress={() => setPageSize(size)}
                  className={`flex-1 items-center rounded-full py-2 ${pageSize === size ? 'bg-primary' : ''}`}
                >
                  <Text className={`font-inter-semibold text-title-md ${pageSize === size ? 'text-on-primary' : 'text-secondary'}`}>
                    {size}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View className={`rounded-3xl bg-surface-container-lowest p-4 ${format === 'PDF' ? '' : 'opacity-50'}`}>
            <Text className="mb-3 font-inter text-label-md text-on-surface-variant">PDF Quality</Text>
            <View className="flex-row rounded-full bg-surface-container p-1" accessibilityRole="radiogroup">
              {QUALITY_LABELS.map((label, index) => {
                const active = quality === index + 1;
                return (
                  <Pressable
                    key={label}
                    onPress={() => setQuality(index + 1)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                    className={`h-11 flex-1 items-center justify-center rounded-full ${active ? 'bg-primary' : ''}`}
                  >
                    <Text
                      className={`font-inter-semibold text-title-md ${active ? 'text-on-primary' : 'text-on-surface-variant'}`}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </ScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 overflow-hidden rounded-t-[28px] px-4 pt-4"
        style={{ paddingBottom: insets.bottom + 16 }}
      >
          <GlassBackground radius={28} topOnly />
        <View className="flex-row items-center gap-4">
          <Pressable
            onPress={save}
            disabled={saving}
            className={`h-14 flex-1 flex-row items-center justify-center gap-2 rounded-full active:opacity-85 ${saving ? 'bg-primary/50' : 'bg-primary'}`}
          >
            <Icon name="save" size={22} className="text-on-primary" />
            <Text className="font-inter-semibold text-body-lg text-on-primary">Save Document</Text>
          </Pressable>
          <Pressable accessibilityLabel="Share"
            onPress={handleShare}
            className="h-14 w-14 items-center justify-center rounded-full bg-surface-container-lowest active:opacity-70"
          >
            <Icon name="share" size={22} className="text-primary" />
          </Pressable>
        </View>
      </View>

      <CreateFolderSheet
        visible={showCreateFolder}
        loading={creatingFolder}
        onClose={() => setShowCreateFolder(false)}
        onCreate={handleCreateFolder}
      />
    </View>
  );
}
