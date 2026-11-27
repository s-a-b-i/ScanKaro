import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CreateFolderSheet } from '../../components/CreateFolderSheet';
import { DocumentListItem } from '../../components/DocumentListItem';
import { Icon } from '../../components/Icon';
import { GlassBackground } from '../../components/Glass';
import { KeyboardAvoid } from '../../components/KeyboardAvoid';
import { SearchField } from '../../components/SearchField';
import { Card, CircleButton, EmptyState, LargeHeader, SectionTitle, useTabBarInset } from '../../components/ui';
import { useTheme } from '../../constants/theme';
import { useApp } from '../../context/AppProvider';
import { useDeleteWithUndo } from '../../hooks/useDeleteWithUndo';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { localDocumentService } from '../../services/local/library';
import { daysUntil } from '../../utils/reminders';

/** Smart filters: all, favourites, expiring within 60 days (or expired), or a tag. */
type Filter = { kind: 'all' } | { kind: 'favorites' } | { kind: 'expiring' } | { kind: 'tag'; tag: string };

const EXPIRING_DAYS = 60;

export default function FoldersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomInset = useTabBarInset();
  const { colors } = useTheme();
  const { documents, folders, searchResults, runSearch, clearSearch, createFolder, toggleFavorite, refreshDocuments } =
    useApp();

  const [query, setQuery] = useState('');
  const deleteWithUndo = useDeleteWithUndo();
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [filter, setFilter] = useState<Filter>({ kind: 'all' });
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameBase, setRenameBase] = useState('');
  const [tagOpen, setTagOpen] = useState(false);
  const [tagDraft, setTagDraft] = useState('');
  const debouncedQuery = useDebouncedValue(query);

  useEffect(() => {
    if (debouncedQuery.trim().length >= 2) {
      runSearch(debouncedQuery);
    } else {
      clearSearch();
    }
  }, [debouncedQuery, runSearch, clearSearch]);

  const isSearching = debouncedQuery.trim().length >= 2;

  // Tags in use, most used first.
  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    documents.forEach((d) => d.tags.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  }, [documents]);
  const expiringCount = documents.filter((d) => d.expiresAt && daysUntil(d.expiresAt) <= EXPIRING_DAYS).length;

  // A tag that no longer exists falls back to "All".
  useEffect(() => {
    if (filter.kind === 'tag' && !tags.includes(filter.tag)) setFilter({ kind: 'all' });
  }, [filter, tags]);

  const displayDocs = useMemo(() => {
    const base = isSearching ? (searchResults ?? []) : documents;
    switch (filter.kind) {
      case 'favorites':
        return base.filter((d) => d.favorite);
      case 'expiring':
        return base
          .filter((d) => d.expiresAt && daysUntil(d.expiresAt) <= EXPIRING_DAYS)
          .sort((a, b) => (a.expiresAt ?? 0) - (b.expiresAt ?? 0));
      case 'tag':
        return base.filter((d) => d.tags.includes(filter.tag));
      default:
        return base;
    }
  }, [isSearching, searchResults, documents, filter]);

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

  const toggleSelected = (id: string) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const exitSelect = () => {
    setSelecting(false);
    setSelected([]);
  };

  /** Selected documents in the order shown (so renaming numbers them top to bottom). */
  const selectedInOrder = () => displayDocs.filter((d) => selected.includes(d.id)).map((d) => d.id);

  const doRename = async () => {
    try {
      await localDocumentService.renameMany(selectedInOrder(), renameBase);
      await refreshDocuments();
      setRenameOpen(false);
      exitSelect();
    } catch (error) {
      Alert.alert('Could not rename', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const addTagToSelected = async (tag: string) => {
    const t = tag.trim();
    if (!t) return;
    try {
      for (const id of selected) {
        const doc = documents.find((d) => d.id === id);
        if (doc) await localDocumentService.setTags(id, [...doc.tags, t]);
      }
      await refreshDocuments();
      setTagOpen(false);
      setTagDraft('');
      exitSelect();
    } catch (error) {
      Alert.alert('Could not tag', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const deleteSelected = () => {
    const ids = selected;
    exitSelect();
    void deleteWithUndo(ids);
  };

  const filters: { key: string; label: string; active: boolean; onPress: () => void; count?: number }[] = [
    { key: 'all', label: 'All', active: filter.kind === 'all', onPress: () => setFilter({ kind: 'all' }) },
    {
      key: 'fav',
      label: 'Favorites',
      active: filter.kind === 'favorites',
      onPress: () => setFilter({ kind: 'favorites' }),
    },
    ...(expiringCount
      ? [
          {
            key: 'exp',
            label: 'Expiring',
            count: expiringCount,
            active: filter.kind === 'expiring',
            onPress: () => setFilter({ kind: 'expiring' }),
          },
        ]
      : []),
    ...tags.map((t) => ({
      key: `tag:${t}`,
      label: t,
      active: filter.kind === 'tag' && filter.tag === t,
      onPress: () => setFilter({ kind: 'tag', tag: t }),
    })),
  ];

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: bottomInset + (selecting ? 72 : 0) }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <LargeHeader
          title="Files"
          subtitle={`${folders.length} folder${folders.length === 1 ? '' : 's'} · ${documents.length} document${documents.length === 1 ? '' : 's'}`}
          right={<CircleButton icon="create-new-folder" label="New folder" onPress={() => setShowCreateFolder(true)} />}
        />

        <View className="mb-6 px-margin-mobile">
          <SearchField value={query} onChangeText={setQuery} placeholder="Search folders or docs" />
        </View>

        {!isSearching && !selecting ? (
          <View className="mb-8">
            <SectionTitle title="Collections" />
            <View className="flex-row flex-wrap justify-between gap-y-3 px-margin-mobile">
              {folders.map((folder) => (
                <Card key={folder.id} onPress={() => router.push(`/folder/${folder.id}`)} className="w-[48.5%] p-4">
                  <View className="mb-4 flex-row items-start justify-between">
                    <View className={`h-12 w-12 items-center justify-center rounded-2xl ${folder.color}`}>
                      <Icon name={folder.folderIcon ?? 'folder'} size={26} className={folder.iconColor} />
                    </View>
                    <View className="min-w-7 items-center rounded-full bg-surface-container px-2 py-0.5">
                      <Text className="font-inter-semibold text-label-md text-on-surface-variant">{folder.count}</Text>
                    </View>
                  </View>
                  <Text className="font-inter-semibold text-body-lg text-on-surface" numberOfLines={1}>
                    {folder.title}
                  </Text>
                  <Text className="font-inter text-label-md text-on-surface-variant" numberOfLines={1}>
                    {folder.subtitle}
                  </Text>
                </Card>
              ))}

              <Pressable
                onPress={() => setShowCreateFolder(true)}
                className="min-h-[136px] w-[48.5%] items-center justify-center rounded-3xl border-2 border-dashed border-outline-variant/70 active:bg-surface-container"
              >
                <View className="mb-2 h-11 w-11 items-center justify-center rounded-full bg-surface-container-lowest">
                  <Icon name="add" size={24} className="text-primary" />
                </View>
                <Text className="font-inter-semibold text-label-md text-on-surface-variant">New Folder</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <SectionTitle
          title={
            selecting
              ? `${selected.length} selected`
              : isSearching
                ? `${displayDocs.length} result${displayDocs.length === 1 ? '' : 's'}`
                : 'All Documents'
          }
          action={documents.length ? (selecting ? 'Done' : 'Select') : undefined}
          onAction={() => (selecting ? exitSelect() : setSelecting(true))}
        />

        {documents.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-2 px-margin-mobile pb-4"
            style={{ flexGrow: 0 }}
          >
            {filters.map((f) => (
              <Pressable
                key={f.key}
                onPress={f.onPress}
                className={`h-9 flex-row items-center gap-1.5 rounded-full px-3.5 ${
                  f.active ? 'bg-on-surface' : 'bg-surface-container'
                }`}
              >
                {f.key.startsWith('tag:') ? (
                  <Icon name="label" size={14} className={f.active ? 'text-surface' : 'text-on-surface-variant'} />
                ) : null}
                <Text className={`font-inter-semibold text-[13px] ${f.active ? 'text-surface' : 'text-on-surface'}`}>
                  {f.label}
                </Text>
                {f.count ? (
                  <View className="min-w-5 items-center rounded-full bg-error px-1.5">
                    <Text className="font-inter-semibold text-[11px] text-white">{f.count}</Text>
                  </View>
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        {displayDocs.length === 0 ? (
          <EmptyState
            icon={isSearching ? 'search-off' : 'description'}
            title={isSearching ? 'No matching documents' : filter.kind === 'all' ? 'No documents yet' : 'Nothing here'}
            message={
              isSearching
                ? 'Try a different search term.'
                : filter.kind === 'all'
                  ? 'Scanned documents will show up here.'
                  : 'No documents match this filter.'
            }
          />
        ) : (
          <View className="px-margin-mobile">
            {displayDocs.map((doc) => (
              <DocumentListItem
                key={doc.id}
                document={doc}
                selecting={selecting}
                selected={selected.includes(doc.id)}
                onPress={() => (selecting ? toggleSelected(doc.id) : router.push(`/document/${doc.id}`))}
                onLongPress={() => {
                  if (!selecting) setSelecting(true);
                  toggleSelected(doc.id);
                }}
                onToggleFavorite={() => toggleFavorite(doc.id)}
                onDelete={() => void deleteWithUndo([doc.id])}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Actions for the selected documents */}
      {selecting ? (
        <View className="absolute left-4 right-4 flex-row gap-2" style={{ bottom: bottomInset - 8 }}>
          {[
            {
              icon: 'drive-file-rename-outline' as const,
              label: 'Rename',
              onPress: () => {
                setRenameBase('');
                setRenameOpen(true);
              },
            },
            { icon: 'label' as const, label: 'Tag', onPress: () => setTagOpen(true) },
            { icon: 'delete-outline' as const, label: 'Delete', onPress: deleteSelected, danger: true },
          ].map((a) => (
            <Pressable
              key={a.label}
              onPress={a.onPress}
              disabled={selected.length === 0}
              className={`h-12 flex-1 flex-row items-center justify-center gap-1.5 rounded-full ${
                a.danger ? 'bg-error' : 'bg-on-surface'
              } ${selected.length === 0 ? 'opacity-40' : ''}`}
            >
              <Icon name={a.icon} size={18} className={a.danger ? 'text-white' : 'text-surface'} />
              <Text className={`font-inter-semibold text-[14px] ${a.danger ? 'text-white' : 'text-surface'}`}>
                {a.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* Batch rename */}
      <Modal visible={renameOpen} transparent animationType="fade" onRequestClose={() => setRenameOpen(false)}>
        <KeyboardAvoid inModal className="flex-1 justify-end bg-black/50">
          <Pressable className="flex-1" onPress={() => setRenameOpen(false)} />
          <View
            className="overflow-hidden rounded-t-[32px] px-5 pt-3"
            style={{ paddingBottom: insets.bottom + 20 }}
          >
              <GlassBackground radius={32} variant="sheet" topOnly />
            <View className="mb-4 h-1 w-10 self-center rounded-full bg-outline-variant" />
            <Text className="font-inter-semibold text-[22px] tracking-[-0.4px] text-on-surface">
              Rename {selected.length} document{selected.length === 1 ? '' : 's'}
            </Text>
            <Text className="mb-4 mt-1 font-inter text-[13px] text-on-surface-variant">
              {selected.length > 1
                ? `They will be named "${renameBase.trim() || 'Name'} 1", "${renameBase.trim() || 'Name'} 2"… in list order.`
                : 'Enter the new name.'}
            </Text>
            <TextInput
              value={renameBase}
              onChangeText={setRenameBase}
              autoFocus
              placeholder="e.g. Electricity bill"
              placeholderTextColor={`${colors['on-surface-variant']}99`}
              onSubmitEditing={() => void doRename()}
              className="h-14 rounded-2xl bg-surface-container px-4 font-inter text-[17px] text-on-surface"
            />
            <Pressable
              onPress={() => void doRename()}
              disabled={!renameBase.trim()}
              className={`mt-4 h-14 items-center justify-center rounded-full bg-on-surface active:opacity-85 ${
                renameBase.trim() ? '' : 'opacity-40'
              }`}
            >
              <Text className="font-inter-semibold text-[17px] text-surface">Rename</Text>
            </Pressable>
          </View>
        </KeyboardAvoid>
      </Modal>

      {/* Add a tag to the selected documents */}
      <Modal visible={tagOpen} transparent animationType="fade" onRequestClose={() => setTagOpen(false)}>
        <KeyboardAvoid inModal className="flex-1 justify-end bg-black/50">
          <Pressable className="flex-1" onPress={() => setTagOpen(false)} />
          <View
            className="overflow-hidden rounded-t-[32px] px-5 pt-3"
            style={{ paddingBottom: insets.bottom + 20 }}
          >
              <GlassBackground radius={32} variant="sheet" topOnly />
            <View className="mb-4 h-1 w-10 self-center rounded-full bg-outline-variant" />
            <Text className="mb-4 font-inter-semibold text-[22px] tracking-[-0.4px] text-on-surface">
              Add a tag to {selected.length} document{selected.length === 1 ? '' : 's'}
            </Text>
            <View className="mb-3 flex-row flex-wrap gap-2">
              {[...new Set([...tags, 'ID', 'Receipt', 'Bill', 'Contract', 'Medical', 'Work'])].map((t) => (
                <Pressable
                  key={t}
                  onPress={() => void addTagToSelected(t)}
                  className="h-9 justify-center rounded-full bg-surface-container px-3.5"
                >
                  <Text className="font-inter-semibold text-[13px] text-on-surface">{t}</Text>
                </Pressable>
              ))}
            </View>
            <View className="flex-row items-center gap-2">
              <TextInput
                value={tagDraft}
                onChangeText={setTagDraft}
                placeholder="New tag"
                placeholderTextColor={`${colors['on-surface-variant']}99`}
                maxLength={24}
                onSubmitEditing={() => void addTagToSelected(tagDraft)}
                className="h-12 flex-1 rounded-2xl bg-surface-container px-4 font-inter text-[16px] text-on-surface"
              />
              <Pressable
                accessibilityLabel="Add tag"
                onPress={() => void addTagToSelected(tagDraft)}
                disabled={!tagDraft.trim()}
                className={`h-12 w-12 items-center justify-center rounded-2xl bg-on-surface ${tagDraft.trim() ? '' : 'opacity-30'}`}
              >
                <Icon name="add" size={22} className="text-surface" />
              </Pressable>
            </View>
          </View>
        </KeyboardAvoid>
      </Modal>

      <CreateFolderSheet
        visible={showCreateFolder}
        loading={creatingFolder}
        onClose={() => setShowCreateFolder(false)}
        onCreate={handleCreateFolder}
      />
    </View>
  );
}
