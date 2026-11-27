/**
 * Recently deleted: documents stay here for 30 days and can be restored or erased.
 */
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Image, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../components/Icon';
import { GlassBackground } from '../components/Glass';
import { useApp } from '../context/AppProvider';
import { deleteFromTrash, listTrash, restoreFromTrash, TrashedDocument } from '../services/local/library';
import { goBackOr } from '../utils/navigation';

export default function TrashScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { refreshDocuments, refreshFolders } = useApp();
  const [items, setItems] = useState<TrashedDocument[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(() => setItems(listTrash()), []);
  useFocusEffect(reload);

  const restore = async (item: TrashedDocument) => {
    setBusyId(item.trashId);
    try {
      await restoreFromTrash(item.trashId);
      await Promise.all([refreshDocuments(), refreshFolders()]);
      reload();
    } catch (error) {
      Alert.alert('Could not restore', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const erase = (item: TrashedDocument) => {
    Alert.alert('Delete forever?', `"${item.title}" will be erased. This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteFromTrash(item.trashId);
          reload();
        },
      },
    ]);
  };

  const eraseAll = () => {
    Alert.alert('Empty Recently deleted?', `${items.length} document${items.length === 1 ? '' : 's'} will be erased. This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete all',
        style: 'destructive',
        onPress: () => {
          deleteFromTrash();
          reload();
        },
      },
    ]);
  };

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="h-16 flex-row items-center justify-between px-5">
        <Pressable
          onPress={() => goBackOr(router, '/(tabs)/settings')}
          accessibilityLabel="Back"
          className="h-12 w-12 items-center justify-center overflow-hidden rounded-full active:opacity-70"
        >
            <GlassBackground radius={24} />
          <Icon name="arrow-back" size={22} className="text-on-surface" />
        </Pressable>
        {items.length > 0 ? (
          <Pressable onPress={eraseAll} className="h-10 justify-center rounded-full px-4 active:bg-surface-container">
            <Text className="font-inter-semibold text-[15px] text-error">Delete all</Text>
          </Pressable>
        ) : null}
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.trashId}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 24, flexGrow: 1 }}
        ListHeaderComponent={
          <View className="mb-6 mt-4">
            <Text className="font-inter-semibold text-[34px] leading-[38px] tracking-[-1.2px] text-on-surface">
              Recently deleted
            </Text>
            <Text className="mt-2 font-inter text-[15px] leading-[21px] text-on-surface-variant">
              Deleted documents stay here for 30 days, then they are erased for good.
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center pb-24">
            <View className="h-16 w-16 items-center justify-center rounded-full bg-surface-container">
              <Icon name="delete-outline" size={30} className="text-on-surface-variant" />
            </View>
            <Text className="mt-4 font-inter-semibold text-[18px] text-on-surface">Nothing here</Text>
            <Text className="mt-1 font-inter text-[14px] text-on-surface-variant">Deleted documents will appear here.</Text>
          </View>
        }
        ItemSeparatorComponent={() => <View className="h-3" />}
        renderItem={({ item }) => (
          <View className="flex-row items-center gap-3 rounded-3xl bg-surface-container-lowest p-3">
            <Image source={{ uri: item.image }} className="h-16 w-12 rounded-lg bg-surface-container" resizeMode="cover" />
            <View className="min-w-0 flex-1">
              <Text className="font-inter-semibold text-[15px] text-on-surface" numberOfLines={1}>
                {item.title}
              </Text>
              <Text className="mt-0.5 font-inter text-[12px] text-on-surface-variant">
                {item.pages} page{item.pages === 1 ? '' : 's'} ·{' '}
                {item.daysLeft <= 1 ? 'erased tomorrow' : `${item.daysLeft} days left`}
              </Text>
            </View>
            <Pressable
              onPress={() => erase(item)}
              accessibilityLabel={`Delete ${item.title} forever`}
              className="h-11 w-11 items-center justify-center rounded-full bg-surface-container active:opacity-70"
            >
              <Icon name="delete-forever" size={20} className="text-error" />
            </Pressable>
            <Pressable
              onPress={() => void restore(item)}
              disabled={busyId === item.trashId}
              className={`h-10 flex-row items-center gap-1 rounded-full bg-on-surface px-3.5 active:opacity-80 ${
                busyId === item.trashId ? 'opacity-50' : ''
              }`}
            >
              <Icon name="restore" size={16} className="text-surface" />
              <Text className="font-inter-semibold text-[13px] text-surface">Restore</Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}
