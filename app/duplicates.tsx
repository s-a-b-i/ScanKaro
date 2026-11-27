/**
 * Duplicate finder: groups documents whose pages look the same (same scan saved twice,
 * or re-saved with another filter). Keep one, move the others to Recently deleted.
 */
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../components/Icon';
import { GlassBackground } from '../components/Glass';
import { useTheme } from '../constants/theme';
import { useApp } from '../context/AppProvider';
import { useDeleteWithUndo } from '../hooks/useDeleteWithUndo';
import { localDocumentService } from '../services/local/library';
import { pageFingerprint } from '../utils/fingerprint';
import { goBackOr } from '../utils/navigation';

export default function DuplicatesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { documents } = useApp();
  const [groups, setGroups] = useState<string[][] | null>(null);
  const deleteWithUndo = useDeleteWithUndo();
  const [progress, setProgress] = useState('');

  const scan = async () => {
    setGroups(null);
    setProgress('Comparing pages…');
    try {
      const found = await localDocumentService.findDuplicates(pageFingerprint, (done, total) =>
        setProgress(`Comparing ${done} of ${total}…`),
      );
      setGroups(found);
    } catch (error) {
      Alert.alert('Could not check', error instanceof Error ? error.message : 'Please try again.');
      setGroups([]);
    }
  };

  useEffect(() => {
    void scan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byId = (id: string) => documents.find((d) => d.id === id);

  // Per group (keyed by its first id): the copy chosen to keep. Groups dismissed as
  // "not duplicates" are hidden for this visit.
  const [keepChoice, setKeepChoice] = useState<Record<string, string>>({});
  const [dismissed, setDismissed] = useState<string[]>([]);
  const groupKey = (group: string[]) => group.join('|');

  /** Keeps `keepId` and, after a confirm, moves the rest of its group to Recently deleted. */
  const keepOnly = (group: string[], keepId: string) => {
    const others = group.filter((id) => id !== keepId);
    const keepTitle = byId(keepId)?.title ?? 'this document';
    Alert.alert(
      `Delete ${others.length} other cop${others.length === 1 ? 'y' : 'ies'}?`,
      `"${keepTitle}" stays. The other ${others.length === 1 ? 'one moves' : `${others.length} move`} to Recently deleted, where you can restore ${others.length === 1 ? 'it' : 'them'}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete others',
          style: 'destructive',
          onPress: () => {
            setDismissed((d) => [...d, groupKey(group)]);
            void deleteWithUndo(others);
          },
        },
      ],
    );
  };

  // Ignore groups whose documents were deleted meanwhile, and dismissed ones.
  const visible = (groups ?? [])
    .map((g) => g.filter((id) => byId(id)))
    .filter((g) => g.length > 1 && !dismissed.includes(groupKey(g)));

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="h-16 flex-row items-center px-5">
        <Pressable
          onPress={() => goBackOr(router, '/(tabs)/settings')}
          accessibilityLabel="Back"
          className="h-12 w-12 items-center justify-center overflow-hidden rounded-full active:opacity-70"
        >
            <GlassBackground radius={24} />
          <Icon name="arrow-back" size={22} className="text-on-surface" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 24, flexGrow: 1 }}>
        <Text className="mt-4 font-inter-semibold text-[34px] leading-[38px] tracking-[-1.2px] text-on-surface">
          Duplicates
        </Text>
        <Text className="mb-6 mt-2 font-inter text-[15px] leading-[21px] text-on-surface-variant">
          Documents whose pages look the same, even if saved with a different filter. Tap the one to keep.
        </Text>

        {groups === null ? (
          <View className="flex-1 items-center justify-center pb-24">
            <ActivityIndicator color={colors['on-surface']} />
            <Text className="mt-3 font-inter text-[14px] text-on-surface-variant">{progress}</Text>
          </View>
        ) : visible.length === 0 ? (
          <View className="flex-1 items-center justify-center pb-24">
            <View className="h-16 w-16 items-center justify-center rounded-full bg-surface-container">
              <Icon name="check" size={30} className="text-on-surface-variant" />
            </View>
            <Text className="mt-4 font-inter-semibold text-[18px] text-on-surface">No duplicates</Text>
            <Text className="mt-1 font-inter text-[14px] text-on-surface-variant">Every document is unique.</Text>
          </View>
        ) : (
          visible.map((group) => {
            const key = groupKey(group);
            const keepId = keepChoice[key] ?? null;
            return (
              <View key={key} className="mb-4 rounded-3xl bg-surface-container-lowest p-3">
                <Text className="mb-2 px-1 font-inter-semibold text-[13px] text-on-surface-variant">
                  {group.length} look the same. Choose the one to keep.
                </Text>
                {group.map((id) => {
                  const doc = byId(id)!;
                  const chosen = keepId === id;
                  return (
                    <View
                      key={id}
                      className={`mb-1 flex-row items-center rounded-2xl ${chosen ? 'bg-surface-container' : ''}`}
                    >
                      <Pressable
                        onPress={() => setKeepChoice((c) => ({ ...c, [key]: id }))}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: chosen }}
                        accessibilityLabel={`Keep ${doc.title}`}
                        className="min-w-0 flex-1 flex-row items-center gap-3 p-2 active:opacity-70"
                      >
                        <View
                          className={`h-6 w-6 items-center justify-center rounded-full border-2 ${
                            chosen ? 'border-primary bg-primary' : 'border-outline-variant'
                          }`}
                        >
                          {chosen ? <Icon name="check" size={15} className="text-on-primary" /> : null}
                        </View>
                        <Image
                          source={{ uri: doc.image }}
                          className="h-14 w-11 rounded-lg bg-surface-container"
                          resizeMode="cover"
                        />
                        <View className="min-w-0 flex-1">
                          <Text className="font-inter-semibold text-[15px] text-on-surface" numberOfLines={1}>
                            {doc.title}
                          </Text>
                          <Text className="font-inter text-[12px] text-on-surface-variant" numberOfLines={1}>
                            {[doc.meta, `${doc.pages} page${doc.pages === 1 ? '' : 's'}`].filter(Boolean).join('  ·  ')}
                          </Text>
                        </View>
                      </Pressable>
                      <Pressable
                        onPress={() => router.push(`/document/${id}`)}
                        accessibilityLabel={`View ${doc.title}`}
                        className="mr-1 h-11 w-11 items-center justify-center rounded-full active:bg-surface-container-high"
                      >
                        <Icon name="visibility" size={20} className="text-on-surface-variant" />
                      </Pressable>
                    </View>
                  );
                })}
                <View className="mt-2 flex-row gap-2">
                  <Pressable
                    onPress={() => setDismissed((d) => [...d, key])}
                    className="h-11 flex-1 items-center justify-center rounded-full border border-outline-variant active:bg-surface-container"
                  >
                    <Text className="font-inter-semibold text-[14px] text-on-surface">Not duplicates</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => keepId && keepOnly(group, keepId)}
                    disabled={!keepId}
                    className={`h-11 flex-[1.4] flex-row items-center justify-center gap-1.5 rounded-full bg-on-surface px-3 active:opacity-85 ${
                      keepId ? '' : 'opacity-40'
                    }`}
                  >
                    <Icon name="delete-outline" size={18} className="text-surface" />
                    <Text className="font-inter-semibold text-[14px] text-surface" numberOfLines={1}>
                      {keepId ? `Delete ${group.length - 1} other${group.length - 1 === 1 ? '' : 's'}` : 'Choose one first'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
