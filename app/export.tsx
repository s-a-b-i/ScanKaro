import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CreateFolderSheet } from '../components/CreateFolderSheet';
import { Icon } from '../components/Icon';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { ScreenHeader } from '../components/ScreenHeader';
import { appConfig } from '../constants/config';
import { useApp } from '../context/AppProvider';
import { useScan } from '../context/ScanProvider';
import { uploadScanPages } from '../services/uploadScan';
import { shareDocument } from '../utils/shareDocument';
import { goBackOr } from '../utils/navigation';

const QUALITY_LABELS = ['Low', 'Medium', 'High'];

export default function ExportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { folders, createFolder, refreshDocuments, refreshFolders } = useApp();
  const { pages, pageCount, title, folderId, documentId, setTitle, setFolderId, reset } = useScan();

  const [showFolders, setShowFolders] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [format, setFormat] = useState<'PDF' | 'JPEG'>('PDF');
  const [pageSize, setPageSize] = useState<'A4' | 'Letter'>('A4');
  const [quality, setQuality] = useState(3);
  const [saving, setSaving] = useState(false);

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

    if (!appConfig.api.enabled) {
      Alert.alert('Saved locally', 'Mock mode — connect the API to upload scans to the cloud.', [
        { text: 'OK', onPress: () => router.replace('/(tabs)') },
      ]);
      reset();
      return;
    }

    setSaving(true);
    try {
      const { documentId: savedId } = await uploadScanPages(pages, {
        title: docTitle,
        folderId,
        documentId,
      });
      await Promise.all([refreshDocuments(), refreshFolders()]);
      reset();
      router.replace(`/document/${savedId}`);
    } catch (error) {
      Alert.alert(
        'Upload failed',
        error instanceof Error ? error.message : 'Could not save your document. Try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    if (previewUri) {
      await shareDocument(title || 'Scan', previewUri);
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
    <View className="flex-1 bg-surface" style={{ paddingTop: insets.top }}>
      <ScreenHeader title="Save Document" onBack={() => goBackOr(router, '/scan')} />
      <LoadingOverlay visible={saving} message="Uploading your scan…" />

      <ScrollView contentContainerClassName="gap-stack-lg px-margin-mobile pb-36 pt-stack-lg">
        <View className="flex-row gap-gutter">
          <View className="aspect-[3/4] w-1/3 overflow-hidden rounded-xl border border-outline-variant bg-white shadow-sm">
            <Image source={{ uri: previewUri }} className="h-full w-full" resizeMode="cover" />
            <View className="absolute bottom-2 right-2 rounded bg-primary px-2 py-1">
              <Text className="font-inter text-label-md text-on-primary">
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
                className="h-12 rounded-xl bg-surface-container-low px-4 font-inter text-body-lg text-on-surface"
              />
            </View>

            <View className="gap-1">
              <Text className="ml-1 font-inter text-label-md text-on-surface-variant">Save to Folder</Text>
              <Pressable
                onPress={() => setShowFolders((v) => !v)}
                className="h-12 flex-row items-center justify-between rounded-xl bg-surface-container-low px-4"
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
                <View className="mt-2 overflow-hidden rounded-xl border border-outline-variant bg-surface-container-highest">
                  <Pressable
                    onPress={() => {
                      setFolderId(null);
                      setShowFolders(false);
                    }}
                    className={`flex-row items-center gap-3 p-3 ${folderId == null ? 'bg-secondary-container' : ''}`}
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
                      className={`flex-row items-center gap-3 p-3 ${folderId === folder.id ? 'bg-secondary-container' : ''}`}
                    >
                      {folderId === folder.id ? (
                        <Icon name="check" size={18} className="text-on-secondary-container" />
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

        <View className="gap-gutter">
          <View className="rounded-xl border border-outline-variant bg-white p-4 shadow-sm">
            <Text className="mb-3 font-inter text-label-md text-on-surface-variant">Export Format</Text>
            <View className="flex-row rounded-lg bg-surface-container p-1">
              {(['PDF', 'JPEG'] as const).map((f) => (
                <Pressable
                  key={f}
                  onPress={() => setFormat(f)}
                  className={`flex-1 items-center rounded-md py-2 ${format === f ? 'bg-primary' : ''}`}
                >
                  <Text className={`font-inter-semibold text-title-md ${format === f ? 'text-on-primary' : 'text-secondary'}`}>
                    {f}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text className="mt-2 font-inter text-body-sm text-on-surface-variant">
              Pages are stored as images in the cloud. PDF export coming soon.
            </Text>
          </View>

          <View className="rounded-xl border border-outline-variant bg-white p-4 shadow-sm opacity-60">
            <Text className="mb-3 font-inter text-label-md text-on-surface-variant">Page Size</Text>
            <View className="flex-row rounded-lg bg-surface-container p-1">
              {(['A4', 'Letter'] as const).map((size) => (
                <Pressable
                  key={size}
                  onPress={() => setPageSize(size)}
                  className={`flex-1 items-center rounded-md py-2 ${pageSize === size ? 'bg-primary' : ''}`}
                >
                  <Text className={`font-inter-semibold text-title-md ${pageSize === size ? 'text-on-primary' : 'text-secondary'}`}>
                    {size}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View className="rounded-xl border border-outline-variant bg-white p-4 shadow-sm opacity-60">
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="font-inter text-label-md text-on-surface-variant">Scanning Quality</Text>
              <Text className="font-inter-semibold text-title-md text-primary">{QUALITY_LABELS[quality - 1]}</Text>
            </View>
            <View className="flex-row justify-between px-1">
              {QUALITY_LABELS.map((label, index) => (
                <Pressable key={label} onPress={() => setQuality(index + 1)}>
                  <Text className={`font-inter text-label-md ${quality === index + 1 ? 'text-primary' : 'text-outline'}`}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 border-t border-outline-variant bg-surface/95 p-4"
        style={{ paddingBottom: insets.bottom + 16 }}
      >
        <View className="flex-row items-center gap-4">
          <Pressable
            onPress={save}
            disabled={saving}
            className={`h-14 flex-1 flex-row items-center justify-center gap-2 rounded-2xl shadow-lg active:scale-95 ${saving ? 'bg-primary/50' : 'bg-primary'}`}
          >
            <Icon name="save" size={22} className="text-on-primary" />
            <Text className="font-inter-semibold text-title-md text-on-primary">Save Document</Text>
          </Pressable>
          <Pressable
            onPress={handleShare}
            className="h-14 w-14 items-center justify-center rounded-2xl bg-secondary-container active:scale-95"
          >
            <Icon name="share" size={22} className="text-on-secondary-container" />
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
