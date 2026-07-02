import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DocumentListItem } from '../../components/DocumentListItem';
import { Icon } from '../../components/Icon';
import { useApp } from '../../context/AppProvider';
import { goBackOr } from '../../utils/navigation';

export default function FolderDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { documents, folders, toggleFavorite, removeDocument } = useApp();

  const folder = useMemo(
    () => folders.find((f) => f.id === id) ?? folders[0],
    [folders, id],
  );

  const files = useMemo(
    () => documents.filter((doc) => doc.folderId === folder?.id),
    [documents, folder?.id],
  );

  if (!folder) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Text className="font-inter text-body-lg text-on-surface-variant">Folder not found</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="h-14 flex-row items-center justify-between border-b border-outline-variant bg-surface px-margin-mobile">
        <Pressable onPress={() => goBackOr(router, '/(tabs)/folders')} className="rounded-full p-2">
          <Icon name="arrow-back" size={24} className="text-primary" />
        </Pressable>
        <Text className="font-inter-semibold text-headline-lg-mobile text-primary">{folder.title}</Text>
        <Pressable className="rounded-full p-2">
          <Icon name="more-vert" size={24} className="text-on-surface-variant" />
        </Pressable>
      </View>

      <View className="gap-stack-sm px-margin-mobile pt-stack-md">
        <View className="flex-row items-center rounded-xl border border-outline-variant bg-surface-container-low px-4 py-3">
          <Icon name="search" size={22} className="mr-3 text-on-surface-variant" />
          <TextInput
            placeholder="Search in folder..."
            placeholderTextColor="#3d494799"
            className="flex-1 font-inter text-body-lg text-on-surface"
          />
        </View>
        <Text className="px-1 font-inter-semibold text-title-md text-secondary">{files.length} documents</Text>
      </View>

      <ScrollView contentContainerClassName="pb-28 pt-2">
        {files.length === 0 ? (
          <View className="items-center px-margin-mobile py-16">
            <Text className="font-inter text-body-lg text-on-surface-variant">No documents in this folder yet.</Text>
          </View>
        ) : (
          files.map((file) => (
            <DocumentListItem
              key={file.id}
              document={file}
              onPress={() => router.push(`/document/${file.id}`)}
              onToggleFavorite={() => toggleFavorite(file.id)}
              onDelete={() => removeDocument(file.id)}
            />
          ))
        )}

        <Pressable
          onPress={() => router.push({ pathname: '/scan', params: { folderId: folder.id } })}
          className="mx-margin-mobile mt-4 min-h-[80px] items-center justify-center rounded-xl border-2 border-dashed border-outline-variant bg-surface-container active:bg-surface-container-high"
        >
          <Icon name="add-a-photo" size={28} className="mb-1 text-secondary" />
          <Text className="font-inter text-label-md text-secondary">Scan Document</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
