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

  /** Keeps `keepId` and moves the rest of its group to Recently deleted. */
  const keepOnly = (group: string[], keepId: string) => {
    const others = group.filter((id) => id !== keepId);
    setGroups((cur) => cur?.filter((g) => g !== group) ?? null);
    void deleteWithUndo(others);
  };

  // Ignore groups whose documents were deleted meanwhile.
  const visible = (groups ?? []).map((g) => g.filter((id) => byId(id))).filter((g) => g.length > 1);

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
          visible.map((group) => (
            <View key={group.join()} className="mb-4 rounded-3xl bg-surface-container-lowest p-3">
              <Text className="mb-2 px-1 font-inter-semibold text-[13px] text-on-surface-variant">
                {group.length} look the same · tap the one to keep
              </Text>
              {group.map((id) => {
                const doc = byId(id)!;
                return (
                  <Pressable
                    key={id}
                    onPress={() => keepOnly(group, id)}
                    className="mb-1 flex-row items-center gap-3 rounded-2xl p-2 active:bg-surface-container"
                  >
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
                        {doc.meta}
                      </Text>
                    </View>
                    <Text className="font-inter-semibold text-[13px] text-primary">Keep</Text>
                  </Pressable>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
