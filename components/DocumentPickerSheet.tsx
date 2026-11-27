/** Pick one saved document for a tool (Extract text, To Excel, Sign, Print…). */
import { Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../context/AppProvider';
import type { DocumentItem } from '../types';
import { GlassBackground } from './Glass';
import { Icon } from './Icon';

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

type Props = {
  /** Sheet title, e.g. "Extract text from…". Hidden when null. */
  title: string | null;
  onCancel: () => void;
  onPick: (doc: DocumentItem) => void;
};

export function DocumentPickerSheet({ title, onCancel, onPick }: Props) {
  const insets = useSafeAreaInsets();
  const { documents } = useApp();

  return (
    <Modal visible={title !== null} transparent animationType="slide" onRequestClose={onCancel}>
      <View className="flex-1 justify-end bg-black/50">
        <Pressable className="flex-1" onPress={onCancel} accessibilityLabel="Close" />
        <View className="max-h-[80%] overflow-hidden rounded-t-[32px] pt-3" style={{ paddingBottom: insets.bottom + 16 }}>
          <GlassBackground radius={32} variant="sheet" topOnly />
          <View className="mb-3 h-1 w-10 self-center rounded-full bg-outline-variant" />
          <Text className="mb-3 px-5 font-inter-semibold text-[22px] tracking-[-0.4px] text-on-surface">{title}</Text>
          {documents.length === 0 ? (
            <View className="items-center px-5 py-10">
              <Icon name="description" size={40} className="text-on-surface-variant" />
              <Text className="mt-3 text-center font-inter text-[15px] text-on-surface-variant">
                No documents yet. Scan or import something first.
              </Text>
            </View>
          ) : (
            <ScrollView contentContainerClassName="px-5 pb-2">
              {documents.map((doc) => (
                <Pressable
                  key={doc.id}
                  onPress={() => onPick(doc)}
                  accessibilityRole="button"
                  accessibilityLabel={`${doc.title}, ${doc.pages} pages`}
                  className="mb-2 flex-row items-center gap-3 rounded-2xl bg-surface-container p-2.5 active:opacity-70"
                >
                  {doc.image ? (
                    <Image source={{ uri: doc.image }} className="h-14 w-11 rounded-lg bg-surface-container-high" />
                  ) : (
                    <View className="h-14 w-11 items-center justify-center rounded-lg bg-surface-container-high">
                      <Icon name="description" size={20} className="text-on-surface-variant" />
                    </View>
                  )}
                  <View className="min-w-0 flex-1">
                    <Text className="font-inter-semibold text-[15px] text-on-surface" numberOfLines={1}>
                      {doc.title}
                    </Text>
                    <Text className="font-inter text-[12px] text-on-surface-variant">
                      {doc.pages} page{doc.pages === 1 ? '' : 's'} · {formatDate(doc.date)}
                    </Text>
                  </View>
                  <Icon name="chevron-right" size={22} className="text-on-surface-variant" />
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}
