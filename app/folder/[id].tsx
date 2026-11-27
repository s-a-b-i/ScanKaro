import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DocumentListItem } from '../../components/DocumentListItem';
import { Icon } from '../../components/Icon';
import { GlassBackground } from '../../components/Glass';
import { KeyboardAvoid } from '../../components/KeyboardAvoid';
import { ScreenHeader } from '../../components/ScreenHeader';
import { SearchField } from '../../components/SearchField';
import { EmptyState, shadows } from '../../components/ui';
import { useTheme } from '../../constants/theme';
import { useApp } from '../../context/AppProvider';
import { useDeleteWithUndo } from '../../hooks/useDeleteWithUndo';
import { goBackOr } from '../../utils/navigation';

export default function FolderDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { documents, folders, toggleFavorite, renameFolder, deleteFolder } = useApp();
  const deleteWithUndo = useDeleteWithUndo();
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameText, setRenameText] = useState('');

  const folder = useMemo(() => folders.find((f) => f.id === id), [folders, id]);

  const files = useMemo(() => {
    const inFolder = documents.filter((doc) => doc.folderId === folder?.id);
    const q = query.trim().toLowerCase();
    return q ? inFolder.filter((doc) => doc.title.toLowerCase().includes(q)) : inFolder;
  }, [documents, folder?.id, query]);

  if (!folder) {
    return (
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        <ScreenHeader title="Folder" onBack={() => goBackOr(router, '/(tabs)/folders')} />
        <EmptyState icon="folder-off" title="Folder not found" />
      </View>
    );
  }

  const showMenu = () => {
    Alert.alert(folder.title, undefined, [
      {
        text: 'Rename',
        onPress: () => {
          setRenameText(folder.title);
          setRenameOpen(true);
        },
      },
      {
        text: 'Delete folder',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Delete folder?', 'Documents in it are kept and moved to your library.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: async () => {
                await deleteFolder(folder.id);
                goBackOr(router, '/(tabs)/folders');
              },
            },
          ]),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleRename = async () => {
    setRenameOpen(false);
    if (renameText.trim() && renameText.trim() !== folder.title) await renameFolder(folder.id, renameText);
  };

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <ScreenHeader
        title={folder.title}
        onBack={() => goBackOr(router, '/(tabs)/folders')}
        right={
          <Pressable
            onPress={showMenu}
            hitSlop={6}
            accessibilityLabel="Folder options"
            className="h-11 w-11 items-center justify-center rounded-full active:bg-surface-container"
          >
            <Icon name="more-horiz" size={24} className="text-on-surface" />
          </Pressable>
        }
      />

      <Modal visible={renameOpen} transparent animationType="fade" onRequestClose={() => setRenameOpen(false)}>
        <KeyboardAvoid inModal className="flex-1 justify-end bg-black/50">
          <Pressable className="flex-1" onPress={() => setRenameOpen(false)} />
          <View className="overflow-hidden rounded-t-[32px] px-5 pt-3" style={{ paddingBottom: insets.bottom + 20 }}>
            <GlassBackground radius={32} variant="sheet" topOnly />
            <View className="mb-4 h-1 w-10 self-center rounded-full bg-outline-variant" />
            <Text className="mb-4 font-inter-semibold text-[22px] tracking-[-0.4px] text-on-surface">Rename folder</Text>
            <TextInput
              value={renameText}
              onChangeText={setRenameText}
              autoFocus
              selectTextOnFocus
              onSubmitEditing={() => void handleRename()}
              placeholder="Folder name"
              placeholderTextColor={`${colors['on-surface-variant']}99`}
              className="h-14 rounded-2xl bg-surface-container px-4 font-inter text-[17px] text-on-surface"
            />
            <Pressable
              onPress={() => void handleRename()}
              className="mt-4 h-14 items-center justify-center rounded-full bg-on-surface active:opacity-85"
            >
              <Text className="font-inter-semibold text-[17px] text-surface">Save</Text>
            </Pressable>
          </View>
        </KeyboardAvoid>
      </Modal>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View className="items-center px-margin-mobile pb-6 pt-2">
          <View className={`h-16 w-16 items-center justify-center rounded-3xl ${folder.color}`}>
            <Icon name={folder.folderIcon ?? 'folder'} size={32} className={folder.iconColor} />
          </View>
          <Text className="mt-3 font-inter-bold text-headline-lg-mobile text-on-surface">{folder.title}</Text>
          <Text className="font-inter text-body-sm text-on-surface-variant">
            {folder.count} {folder.count === 1 ? 'document' : 'documents'}
          </Text>
        </View>

        <View className="mb-5 px-margin-mobile">
          <SearchField value={query} onChangeText={setQuery} placeholder="Search in folder" />
        </View>

        {files.length === 0 ? (
          <EmptyState
            icon={query ? 'search-off' : 'description'}
            title={query ? 'No matches' : 'This folder is empty'}
            message={query ? 'Try a different name.' : 'Scan a document straight into this folder.'}
          />
        ) : (
          <View className="px-margin-mobile">
            {files.map((file) => (
              <DocumentListItem
                key={file.id}
                document={file}
                onPress={() => router.push(`/document/${file.id}`)}
                onToggleFavorite={() => toggleFavorite(file.id)}
                onDelete={() => void deleteWithUndo([file.id])}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <View className="absolute left-0 right-0 items-center" style={{ bottom: Math.max(insets.bottom, 12) + 4 }}>
        <Pressable
          onPress={() => router.push({ pathname: '/scan', params: { folderId: folder.id } })}
          className="h-14 flex-row items-center gap-2 rounded-full bg-primary px-7 active:opacity-85"
          style={[shadows.lifted, { shadowColor: '#000000', shadowOpacity: 0.3 }]}
        >
          <Icon name="document-scanner" size={22} className="text-on-primary" />
          <Text className="font-inter-semibold text-body-lg text-on-primary">Scan to this folder</Text>
        </Pressable>
      </View>
    </View>
  );
}
