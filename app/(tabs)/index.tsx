import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CreateFolderSheet } from '../../components/CreateFolderSheet';
import { DocumentListItem } from '../../components/DocumentListItem';
import { Icon } from '../../components/Icon';
import { SearchField } from '../../components/SearchField';
import { useApp } from '../../context/AppProvider';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    documents,
    folders,
    searchResults,
    runSearch,
    clearSearch,
    createFolder,
    toggleFavorite,
    removeDocument,
  } = useApp();

  const [query, setQuery] = useState('');
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const debouncedQuery = useDebouncedValue(query);

  useEffect(() => {
    if (debouncedQuery.trim().length >= 2) {
      runSearch(debouncedQuery);
    } else {
      clearSearch();
    }
  }, [debouncedQuery, runSearch, clearSearch]);

  const isSearching = debouncedQuery.trim().length >= 2;
  const recentScans = isSearching ? (searchResults ?? []) : documents.slice(0, 3);
  const filteredFolders = isSearching
    ? folders.filter((f) => f.title.toLowerCase().includes(debouncedQuery.trim().toLowerCase()))
    : folders;

  const handleCreateFolder = async (name: string) => {
    setCreatingFolder(true);
    try {
      await createFolder(name);
      setShowCreateFolder(false);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Could not create folder');
    } finally {
      setCreatingFolder(false);
    }
  };

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="border-b border-outline-variant bg-surface">
        <View className="h-14 flex-row items-center justify-between px-margin-mobile">
          <View className="flex-row items-center gap-3">
            <Icon name="menu" size={24} className="text-on-surface-variant" />
            <Text className="font-inter text-display-lg text-primary">ScanKaro</Text>
          </View>
          <Pressable onPress={() => router.push('/(tabs)/settings')} className="rounded-full p-2">
            <Icon name="settings" size={24} className="text-on-surface-variant" />
          </Pressable>
        </View>

        <View className="px-margin-mobile pb-4 pt-2">
          <SearchField
            value={query}
            onChangeText={setQuery}
            placeholder="Search folders and docs..."
          />
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-stack-lg pb-28 pt-stack-md"
        showsVerticalScrollIndicator={false}
      >
        <View>
          <View className="mb-stack-sm flex-row items-center justify-between px-margin-mobile">
            <Text className="font-inter text-title-md text-on-surface">
              {isSearching ? `Results (${recentScans.length})` : 'Recent Scans'}
            </Text>
            {!isSearching && documents.length > 3 ? (
              <Pressable onPress={() => router.push('/(tabs)/folders')}>
                <Text className="font-inter text-label-md text-primary">See All</Text>
              </Pressable>
            ) : null}
          </View>

          {recentScans.length === 0 ? (
            <View className="px-margin-mobile py-8">
              <Text className="text-center font-inter text-body-lg text-on-surface-variant">
                {isSearching ? 'No documents match your search.' : 'No scans yet. Tap + to scan your first document.'}
              </Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-gutter px-margin-mobile">
              {recentScans.map((scan) => (
                <Pressable
                  key={scan.id}
                  onPress={() => router.push(`/document/${scan.id}`)}
                  className="w-40 rounded-xl border border-outline-variant bg-surface-container-lowest p-2 shadow-sm active:opacity-90"
                >
                  <View className="relative mb-2 h-44 w-full overflow-hidden rounded-lg border border-outline-variant/20 bg-surface-container">
                    {scan.image ? (
                      <Image source={{ uri: scan.image }} className="h-full w-full" resizeMode="cover" />
                    ) : (
                      <View className="h-full w-full items-center justify-center">
                        <Icon name="description" size={32} className="text-on-surface-variant" />
                      </View>
                    )}
                  </View>
                  <Text className="font-inter text-label-md text-on-surface" numberOfLines={1}>
                    {scan.title}
                  </Text>
                  <Text className="font-inter text-[11px] text-on-surface-variant/70">{scan.meta}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          {isSearching && recentScans.length > 0 ? (
            <View className="mt-4 px-margin-mobile">
              {recentScans.map((doc) => (
                <DocumentListItem
                  key={doc.id}
                  document={doc}
                  onPress={() => router.push(`/document/${doc.id}`)}
                  onToggleFavorite={() => toggleFavorite(doc.id)}
                  onDelete={() => removeDocument(doc.id)}
                />
              ))}
            </View>
          ) : null}
        </View>

        {!isSearching ? (
          <View className="px-margin-mobile">
            <View className="mb-stack-sm flex-row items-center justify-between">
              <Text className="font-inter text-title-md text-on-surface">Folders</Text>
              <Pressable onPress={() => setShowCreateFolder(true)}>
                <Text className="font-inter text-label-md text-primary">New Folder</Text>
              </Pressable>
            </View>

            <View className="flex-row flex-wrap gap-gutter">
              {filteredFolders.map((folder) => (
                <Pressable
                  key={folder.id}
                  onPress={() => router.push(`/folder/${folder.id}`)}
                  className="w-[47%] gap-3 rounded-2xl border border-outline-variant/40 bg-surface-container-low p-4 active:opacity-90"
                >
                  <View className={`h-10 w-10 items-center justify-center rounded-xl ${folder.color}`}>
                    <Icon name={folder.icon} size={22} className={folder.iconColor} filled />
                  </View>
                  <View>
                    <Text className="font-inter text-title-md text-on-surface">{folder.title}</Text>
                    <Text className="font-inter text-body-sm text-on-surface-variant">{folder.count} items</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        <View className="px-margin-mobile">
          <View className="relative flex-row items-center gap-4 overflow-hidden rounded-2xl bg-inverse-surface p-4">
            <View className="z-10 flex-1">
              <Text className="font-inter text-title-md text-inverse-on-surface">Storage Cloud</Text>
              <View className="mb-1 mt-2 h-1.5 w-full rounded-full bg-white/20">
                <View className="h-full w-3/4 rounded-full bg-primary-fixed" />
              </View>
              <Text className="font-inter text-body-sm text-white/70">1.2GB of 2GB used</Text>
            </View>
            <Pressable onPress={() => router.push('/paywall')} className="z-10 rounded-full bg-primary-fixed px-4 py-2">
              <Text className="font-inter text-label-md text-on-primary-fixed">Upgrade</Text>
            </Pressable>
            <View className="absolute -bottom-5 -right-2 opacity-10">
              <Icon name="cloud-upload" size={96} className="text-inverse-on-surface" />
            </View>
          </View>
        </View>
      </ScrollView>

      <CreateFolderSheet
        visible={showCreateFolder}
        loading={creatingFolder}
        onClose={() => setShowCreateFolder(false)}
        onCreate={handleCreateFolder}
      />
    </View>
  );
}
