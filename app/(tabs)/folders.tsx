import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CreateFolderSheet } from '../../components/CreateFolderSheet';
import { DocumentListItem } from '../../components/DocumentListItem';
import { Icon } from '../../components/Icon';
import { SearchField } from '../../components/SearchField';
import { useApp } from '../../context/AppProvider';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

export default function FoldersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { documents, folders, searchResults, runSearch, clearSearch, createFolder, toggleFavorite, removeDocument } =
    useApp();

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
  const filteredFolders = isSearching
    ? folders.filter((f) => f.title.toLowerCase().includes(debouncedQuery.trim().toLowerCase()))
    : folders;
  const displayDocs = isSearching ? (searchResults ?? []) : documents;

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
      <View className="h-14 flex-row items-center justify-between border-b border-outline-variant bg-surface px-margin-mobile">
        <Text className="font-inter-semibold text-headline-lg-mobile text-primary">ScanKaro</Text>
        <Pressable onPress={() => router.push('/(tabs)/settings')} className="rounded-full p-2">
          <Icon name="settings" size={22} className="text-on-surface-variant" />
        </Pressable>
      </View>

      <ScrollView contentContainerClassName="pb-28" showsVerticalScrollIndicator={false}>
        <View className="gap-stack-sm px-margin-mobile pt-stack-md">
          <SearchField value={query} onChangeText={setQuery} placeholder="Search folders or docs..." />

          {!isSearching ? (
            <View className="flex-row items-center justify-between px-1">
              <Text className="font-inter-semibold text-title-md text-secondary">Collections</Text>
              <View className="flex-row gap-2">
                <Pressable className="rounded-full p-2 opacity-40">
                  <Icon name="sort" size={22} className="text-secondary" />
                </Pressable>
                <Pressable className="rounded-full p-2 opacity-40">
                  <Icon name="grid-view" size={22} className="text-secondary" />
                </Pressable>
              </View>
            </View>
          ) : (
            <Text className="px-1 font-inter-semibold text-title-md text-secondary">
              {displayDocs.length} document{displayDocs.length === 1 ? '' : 's'} found
            </Text>
          )}
        </View>

        {!isSearching ? (
          <View className="mt-4 flex-row flex-wrap gap-4 px-margin-mobile">
            {filteredFolders.map((folder) => (
              <Pressable
                key={folder.id}
                onPress={() => router.push(`/folder/${folder.id}`)}
                className="w-[47%] rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm active:opacity-90"
              >
                <View className="mb-4 flex-row items-start justify-between">
                  <View className={`h-12 w-12 items-center justify-center rounded-xl ${folder.color}/20`}>
                    <Icon name={folder.folderIcon ?? 'folder'} size={32} className="text-primary" filled />
                  </View>
                  <View className={`rounded-full px-2 py-0.5 ${folder.color}`}>
                    <Text className={`font-inter text-label-md ${folder.iconColor}`}>{folder.count}</Text>
                  </View>
                </View>
                <Text className="font-inter-semibold text-title-md text-on-surface">{folder.title}</Text>
                <Text className="font-inter text-label-md text-on-surface-variant">{folder.subtitle}</Text>
              </Pressable>
            ))}

            <Pressable
              onPress={() => setShowCreateFolder(true)}
              className="min-h-[140px] w-[47%] items-center justify-center rounded-xl border-2 border-dashed border-outline-variant bg-surface-container active:bg-surface-container-high"
            >
              <Icon name="create-new-folder" size={32} className="mb-2 text-secondary" />
              <Text className="font-inter text-label-md text-secondary">New Folder</Text>
            </Pressable>
          </View>
        ) : null}

        <View className="mt-8">
          <View className="mb-4 flex-row items-center justify-between px-margin-mobile">
            <Text className="font-inter-semibold text-title-md text-secondary">
              {isSearching ? 'Search Results' : 'Recent Scans'}
            </Text>
          </View>
          {displayDocs.length === 0 ? (
            <Text className="px-margin-mobile py-8 text-center font-inter text-body-lg text-on-surface-variant">
              {isSearching ? 'No matching documents.' : 'No documents yet.'}
            </Text>
          ) : (
            displayDocs.map((doc) => (
              <DocumentListItem
                key={doc.id}
                document={doc}
                onPress={() => router.push(`/document/${doc.id}`)}
                onToggleFavorite={() => toggleFavorite(doc.id)}
                onDelete={() => removeDocument(doc.id)}
              />
            ))
          )}
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
