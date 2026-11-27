/** Pick one saved document for a tool (Extract text, To Excel, Sign, Print…). */
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../context/AppProvider';
import { useStartScan } from '../hooks/useStartScan';
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
  const { documents, loading } = useApp();
  const startScan = useStartScan();

  return (
    <Modal visible={title !== null} transparent animationType="slide" onRequestClose={onCancel}>
      <View className="flex-1 justify-end bg-black/50">
        <Pressable className="flex-1" onPress={onCancel} accessibilityLabel="Close" />
        <View className="max-h-[80%] overflow-hidden rounded-t-[32px] pt-3" style={{ paddingBottom: insets.bottom + 16 }}>
          <GlassBackground radius={32} variant="sheet" topOnly />
          <View className="mb-3 h-1 w-10 self-center rounded-full bg-outline-variant" />
          <View className="mb-3 flex-row items-center gap-2 pl-5 pr-3">
            <Text className="flex-1 font-inter-semibold text-[22px] tracking-[-0.4px] text-on-surface" numberOfLines={1}>
              {title}
            </Text>
            <Pressable
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={6}
              className="h-11 w-11 items-center justify-center rounded-full active:bg-surface-container"
            >
              <Icon name="close" size={22} className="text-on-surface-variant" />
            </Pressable>
          </View>
          {loading ? (
            <View className="items-center py-12">
              <ActivityIndicator color="#8e8e93" />
            </View>
          ) : documents.length === 0 ? (
            <View className="items-center px-5 py-8">
              <Icon name="description" size={40} className="text-on-surface-variant" />
              <Text className="mt-3 font-inter-semibold text-[17px] text-on-surface">No documents yet</Text>
              <Text className="mt-1 text-center font-inter text-[14px] text-on-surface-variant">
                Scan a page or import photos, then come back to this tool.
              </Text>
              <Pressable
                onPress={() => {
                  onCancel();
                  startScan();
                }}
                accessibilityRole="button"
                className="mt-5 h-12 flex-row items-center gap-2 rounded-full bg-on-surface px-6 active:opacity-85"
              >
                <Icon name="document-scanner" size={20} className="text-surface" />
                <Text className="font-inter-semibold text-[16px] text-surface">Scan or import</Text>
              </Pressable>
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
