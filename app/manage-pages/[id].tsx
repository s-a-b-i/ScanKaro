import { useLocalSearchParams, useRouter } from 'expo-router';
import { ComponentProps, useCallback, useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../../components/Icon';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useApp } from '../../context/AppProvider';
import { localDocumentService } from '../../services/local/library';
import { DocumentItem } from '../../types';
import { addPageWithPrompt } from '../../utils/galleryImport';
import { rotateJpeg } from '../../utils/imageFiles';
import { goBackOr } from '../../utils/navigation';
import { finishPage } from '../../utils/pagePipeline';

type IconName = ComponentProps<typeof Icon>['name'];

function PageAction({
  icon,
  label,
  onPress,
  disabled,
  danger,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      accessibilityLabel={label}
      className={`h-11 w-11 items-center justify-center rounded-full bg-surface-container active:opacity-60 ${
        disabled ? 'opacity-30' : ''
      }`}
    >
      <Icon name={icon} size={19} className={danger ? 'text-error' : 'text-on-surface'} />
    </Pressable>
  );
}

/** Reorder, rotate, duplicate, replace and delete the pages of a saved document. */
export default function ManagePagesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { refreshDocuments } = useApp();

  const [doc, setDoc] = useState<DocumentItem | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setDoc(await localDocumentService.getById(id));
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Runs one page operation, then refreshes this screen and the library. */
  const run = async (message: string | null, task: () => Promise<void>) => {
    if (message) setBusy(message);
    try {
      await task();
      await load();
      await refreshDocuments();
    } catch (error) {
      Alert.alert('Could not update pages', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  if (!doc) {
    return <View className="flex-1 bg-background" />;
  }

  const pages = doc.pageUrls ?? [];
  const count = pages.length;

  const move = (from: number, to: number) => {
    if (to < 0 || to >= count) return;
    const order = pages.map((_, i) => i);
    const [item] = order.splice(from, 1);
    order.splice(to, 0, item);
    void run(null, () => localDocumentService.reorderPages(doc.id, order));
  };

  const rotate = (index: number) =>
    void run('Rotating…', async () => {
      const rotated = await rotateJpeg(pages[index], 90);
      await localDocumentService.replacePage(doc.id, index, rotated.uri);
    });

  const duplicate = (index: number) => void run(null, () => localDocumentService.duplicatePage(doc.id, index));

  const replace = async (index: number) => {
    // Pick first: Android will not open the camera/gallery while a modal is showing.
    const page = await addPageWithPrompt();
    if (!page) return;
    await run('Processing new page…', async () => {
      const finished = await finishPage(page);
      await localDocumentService.replacePage(doc.id, index, finished);
    });
  };

  const remove = (index: number) => {
    if (count <= 1) {
      Alert.alert('Last page', 'A document needs at least one page. Delete the document from its menu instead.');
      return;
    }
    Alert.alert(`Delete page ${index + 1}?`, 'This page will be permanently removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => void run(null, () => localDocumentService.deletePage(doc.id, index)),
      },
    ]);
  };

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <LoadingOverlay visible={!!busy} message={busy ?? ''} />
      <ScreenHeader
        title="Manage pages"
        subtitle={`${doc.title} · ${count} page${count === 1 ? '' : 's'}`}
        onBack={() => goBackOr(router, `/document/${doc.id}`)}
      />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        <Text className="mb-4 px-1 font-inter text-[13px] text-on-surface-variant">
          Use the arrows to reorder. Changes are saved straight away.
        </Text>

        <View className="flex-row flex-wrap justify-between gap-y-4">
          {pages.map((uri, index) => (
            <View
              key={uri}
              className="w-[48.5%] rounded-[24px] border border-outline-variant/50 bg-surface-container-lowest p-2.5"
            >
              <View className="aspect-[3/4] overflow-hidden rounded-2xl bg-white">
                <Image source={{ uri }} className="h-full w-full" resizeMode="contain" />
                <View className="absolute left-2 top-2 h-7 min-w-7 items-center justify-center rounded-full bg-black/65 px-2">
                  <Text className="font-inter-semibold text-[13px] text-white">{index + 1}</Text>
                </View>
              </View>

              <View className="mt-2.5 flex-row justify-between">
                <PageAction icon="chevron-left" label="Move earlier" onPress={() => move(index, index - 1)} disabled={index === 0} />
                <PageAction icon="rotate-right" label="Rotate" onPress={() => rotate(index)} />
                <PageAction
                  icon="chevron-right"
                  label="Move later"
                  onPress={() => move(index, index + 1)}
                  disabled={index === count - 1}
                />
              </View>
              <View className="mt-2 flex-row justify-between">
                <PageAction icon="content-copy" label="Duplicate" onPress={() => duplicate(index)} />
                <PageAction icon="find-replace" label="Replace" onPress={() => void replace(index)} />
                <PageAction icon="delete-outline" label="Delete" onPress={() => remove(index)} danger />
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
