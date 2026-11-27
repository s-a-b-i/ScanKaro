import { useFocusEffect, useRouter } from 'expo-router';
import { ComponentProps, useCallback, useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DocumentListItem } from '../../components/DocumentListItem';
import { DraftListItem, draftTitle } from '../../components/DraftListItem';
import { Icon } from '../../components/Icon';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import { SearchField } from '../../components/SearchField';
import { EmptyState, useTabBarInset } from '../../components/ui';
import { useApp } from '../../context/AppProvider';
import { useDeleteWithUndo } from '../../hooks/useDeleteWithUndo';
import { useScan } from '../../context/ScanProvider';
import { pastel, PastelName } from '../../constants/pastel';
import { useTheme } from '../../constants/theme';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useStartScan } from '../../hooks/useStartScan';
import { importFromGallery } from '../../utils/galleryImport';
import { discardDraft, listDrafts, ScanDraft } from '../../utils/scanDraft';

/** Drafts shown before "Show all". */
const DRAFTS_PREVIEW = 3;

type Shortcut = {
  key: string;
  title: string;
  icon: ComponentProps<typeof Icon>['name'];
  color: PastelName;
  onPress: () => void;
};

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomInset = useTabBarInset();
  const {
    profile,
    documents,
    folders,
    searchResults,
    runSearch,
    clearSearch,
    toggleFavorite,
  } = useApp();
  const { reset, addPage, restoreDraft, draftId: activeDraftId } = useScan();
  const startScan = useStartScan();
  const { isDark } = useTheme();

  const [query, setQuery] = useState('');
  const deleteWithUndo = useDeleteWithUndo();
  const [importing, setImporting] = useState(false);
  const debouncedQuery = useDebouncedValue(query);

  // Unsaved scans. Re-read every time Home is shown, so leaving a scan (or the app
  // closing mid-scan) shows it here right away, with its latest pages and title.
  const [drafts, setDrafts] = useState<ScanDraft[]>([]);
  const [showAllDrafts, setShowAllDrafts] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setDrafts(listDrafts());
    }, []),
  );

  const continueDraft = (draft: ScanDraft) => {
    restoreDraft(draft);
    // Imported photos keep their detected frame until cropped: go back to Crop for those.
    const uncropped = draft.pages.some((uri) => draft.pageCorners?.[uri]);
    router.push(uncropped ? '/crop' : '/enhance');
  };

  const confirmDiscardDraft = (draft: ScanDraft) => {
    const n = draft.pages.length;
    Alert.alert(`Discard "${draftTitle(draft)}"?`, `Its ${n} unsaved page${n === 1 ? '' : 's'} will be deleted.`, [
      { text: 'Keep draft', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          // Still loaded as the current scan: drop it, or its next change would re-save it.
          if (activeDraftId === draft.id) reset();
          discardDraft(draft.id);
          setDrafts(listDrafts());
        },
      },
    ]);
  };

  useEffect(() => {
    if (debouncedQuery.trim().length >= 2) {
      runSearch(debouncedQuery);
    } else {
      clearSearch();
    }
  }, [debouncedQuery, runSearch, clearSearch]);

  const isSearching = debouncedQuery.trim().length >= 2;
  const recentScans = documents.slice(0, 6);
  const results = searchResults ?? [];
  const firstName = profile?.name?.split(' ')[0];

  const importPhoto = async () => {
    if (importing) return;
    try {
      // Opens the gallery directly, then finds the page edges so the crop frame starts on them.
      const page = await importFromGallery(() => setImporting(true));
      if (!page) return;
      reset();
      addPage(page.uri, page.corners);
      router.push('/crop');
    } catch (error) {
      Alert.alert('Import failed', error instanceof Error ? error.message : 'Could not import this photo.');
    } finally {
      setImporting(false);
    }
  };

  const shortcuts: Shortcut[] = [
    { key: 'id', title: 'ID card', icon: 'badge', color: 'green', onPress: () => startScan({ mode: 'id' }) },
    { key: 'qr', title: 'QR scan', icon: 'qr-code-scanner', color: 'blue', onPress: () => router.push('/qr') },
    { key: 'translate', title: 'Translate', icon: 'translate', color: 'yellow', onPress: () => router.push('/translate') },
    { key: 'locker', title: 'Locker', icon: 'lock', color: 'pink', onPress: () => router.push('/locker') },
  ];

  const hour = new Date().getHours();
  const greeting = hour >= 5 && hour < 12 ? 'Good morning' : hour >= 12 && hour < 17 ? 'Good afternoon' : 'Good evening';

  const showHelp = () =>
    Alert.alert(
      'How to scan',
      [
        '1. Tap Scan to open the camera, or Import to pick a photo.',
        '2. Adjust the corners if needed, then tap Next.',
        '3. Pick a filter or adjust the lighting, then save.',
      ].join('\n'),
    );

  const renderDoc = (doc: (typeof documents)[number]) => (
    <DocumentListItem
      key={doc.id}
      document={doc}
      onPress={() => router.push(`/document/${doc.id}`)}
      onToggleFavorite={() => toggleFavorite(doc.id)}
      onDelete={() => void deleteWithUndo([doc.id])}
    />
  );

  return (
    <View className="flex-1 bg-background">
      <LoadingOverlay visible={importing} message="Finding page edges…" />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: bottomInset, paddingHorizontal: 20 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header: greeting, with help and account at the trailing edge. */}
        <View className="flex-row items-center">
          <View className="flex-1">
            <Text className="font-inter text-[15px] text-on-surface-variant">{greeting}</Text>
            <Text
              className="font-inter-semibold text-[28px] leading-[34px] tracking-[-0.6px] text-on-surface"
              numberOfLines={1}
            >
              {firstName ?? 'ScanKaro'}
            </Text>
          </View>
          <Pressable
            onPress={showHelp}
            accessibilityLabel="How to scan"
            className="mr-2 h-11 w-11 items-center justify-center rounded-full active:bg-surface-container"
          >
            <Icon name="help-outline" size={24} className="text-on-surface-variant" />
          </Pressable>
          <Pressable
            onPress={() => router.push('/(tabs)/settings')}
            accessibilityLabel="Account and settings"
            className="active:opacity-70"
          >
            {profile?.avatar ? (
              <Image source={{ uri: profile.avatar }} className="h-11 w-11 rounded-full" />
            ) : (
              <View className="h-11 w-11 items-center justify-center rounded-full bg-surface-container">
                <Text className="font-inter-bold text-[17px] text-on-surface">
                  {(firstName ?? 'S').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Search: primary position, scoped to documents. */}
        <View className="mt-5">
          <SearchField value={query} onChangeText={setQuery} placeholder="Search documents and text" />
        </View>

        {isSearching ? (
          <View className="mt-6">
            <Text className="mb-3 font-inter-semibold text-[17px] text-on-surface">
              {results.length} result{results.length === 1 ? '' : 's'}
            </Text>
            {results.length === 0 ? (
              <EmptyState icon="search-off" title="No matches" message="Try a different word or document name." />
            ) : (
              results.map(renderDoc)
            )}
          </View>
        ) : (
          <>
            {/* One primary action, one secondary. */}
            <View className="mt-5 flex-row gap-3">
              <Pressable
                onPress={() => startScan()}
                accessibilityRole="button"
                className="h-14 flex-1 flex-row items-center justify-center gap-2 rounded-full bg-on-surface active:opacity-85"
              >
                <Icon name="document-scanner" size={22} className="text-surface" />
                <Text className="font-inter-semibold text-[16px] text-surface">Scan</Text>
              </Pressable>
              <Pressable
                onPress={() => void importPhoto()}
                accessibilityRole="button"
                className="h-14 flex-1 flex-row items-center justify-center gap-2 rounded-full border border-outline-variant active:bg-surface-container"
              >
                <Icon name="add-photo-alternate" size={22} className="text-on-surface" />
                <Text className="font-inter-semibold text-[16px] text-on-surface">Import</Text>
              </Pressable>
            </View>

            {/* Shortcuts */}
            <View className="mb-1 mt-7 flex-row items-center justify-between">
              <Text accessibilityRole="header" className="font-inter-semibold text-[17px] text-on-surface">
                Shortcuts
              </Text>
              <Pressable onPress={() => router.push('/(tabs)/tools')} hitSlop={8} className="h-11 justify-center">
                <Text className="font-inter-semibold text-[15px] text-on-surface-variant">All tools</Text>
              </Pressable>
            </View>
            <View className="-mx-1 flex-row">
              {shortcuts.map((sc) => (
                <Pressable
                  key={sc.key}
                  onPress={sc.onPress}
                  accessibilityRole="button"
                  accessibilityLabel={sc.title}
                  className="w-1/4 items-center px-1 py-2 active:opacity-60"
                >
                  <View
                    className="h-[52px] w-[52px] items-center justify-center rounded-full"
                    style={{ backgroundColor: pastel(sc.color, isDark) }}
                  >
                    <Icon name={sc.icon} size={24} className="text-on-surface" />
                  </View>
                  <Text className="mt-2 font-inter-medium text-[12.5px] text-on-surface" numberOfLines={1}>
                    {sc.title}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Drafts: scans started but not saved yet. Tap one to continue it. */}
            {drafts.length > 0 ? (
              <>
                <View className="mb-2 mt-6 flex-row items-center justify-between">
                  <Text accessibilityRole="header" className="font-inter-semibold text-[17px] text-on-surface">
                    Drafts
                  </Text>
                  {drafts.length > DRAFTS_PREVIEW ? (
                    <Pressable
                      onPress={() => setShowAllDrafts((v) => !v)}
                      hitSlop={8}
                      className="h-11 justify-center"
                    >
                      <Text className="font-inter-semibold text-[15px] text-on-surface-variant">
                        {showAllDrafts ? 'Show less' : 'Show all'}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
                {(showAllDrafts ? drafts : drafts.slice(0, DRAFTS_PREVIEW)).map((draft) => (
                  <DraftListItem
                    key={draft.id}
                    draft={draft}
                    onContinue={() => continueDraft(draft)}
                    onDiscard={() => confirmDiscardDraft(draft)}
                  />
                ))}
              </>
            ) : null}

            {/* Recent documents: a list, since titles and dates are text. */}
            <View className="mb-2 mt-6 flex-row items-center justify-between">
              <Text accessibilityRole="header" className="font-inter-semibold text-[17px] text-on-surface">
                Recent
              </Text>
              {documents.length > 0 ? (
                <Pressable onPress={() => router.push('/(tabs)/folders')} hitSlop={8} className="h-11 justify-center">
                  <Text className="font-inter-semibold text-[15px] text-on-surface-variant">See all</Text>
                </Pressable>
              ) : null}
            </View>
            {recentScans.length === 0 ? (
              <View className="items-center rounded-[24px] bg-surface-container-lowest px-6 py-8">
                <View className="h-14 w-14 items-center justify-center rounded-full bg-surface-container">
                  <Icon name="document-scanner" size={26} className="text-on-surface" />
                </View>
                <Text className="mt-3 font-inter-semibold text-[17px] text-on-surface">No documents yet</Text>
                <Text className="mt-1 text-center font-inter text-[14px] leading-[20px] text-on-surface-variant">
                  Scan a page or import a photo to get started.
                </Text>
              </View>
            ) : (
              recentScans.map(renderDoc)
            )}

            {folders.length > 0 ? (
              <>
                <Text accessibilityRole="header" className="mb-3 mt-6 font-inter-semibold text-[17px] text-on-surface">
                  Folders
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  className="-mx-5"
                  contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
                >
                  {folders.map((folder) => (
                    <Pressable
                      key={folder.id}
                      onPress={() => router.push(`/folder/${folder.id}`)}
                      className="h-11 flex-row items-center gap-2 rounded-full bg-surface-container px-4 active:opacity-70"
                    >
                      <Icon name="folder" size={18} className="text-on-surface-variant" />
                      <Text className="font-inter-semibold text-[14px] text-on-surface">{folder.title}</Text>
                      <Text className="font-inter text-[13px] text-on-surface-variant">{folder.count}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}
