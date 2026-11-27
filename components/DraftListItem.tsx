import { Image, Pressable, Text, View } from 'react-native';

import type { ScanDraft } from '../utils/scanDraft';
import { Icon } from './Icon';
import { shadows } from './ui';

/** "Just now", "5 min ago", "3 h ago", "Yesterday", or the date. */
export function editedLabel(savedAt: number, now = Date.now()) {
  const minutes = Math.floor((now - savedAt) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  if (hours < 48) return 'Yesterday';
  return new Date(savedAt).toLocaleDateString();
}

export function draftTitle(draft: Pick<ScanDraft, 'title'>) {
  return draft.title.trim() || 'Untitled scan';
}

type DraftListItemProps = {
  draft: ScanDraft;
  onContinue: () => void;
  onDiscard: () => void;
};

/** An unsaved scan, styled like a document row. Tap to continue it. */
export function DraftListItem({ draft, onContinue, onDiscard }: DraftListItemProps) {
  const n = draft.pages.length;
  return (
    <View className="mb-3 flex-row items-center rounded-3xl bg-surface-container-lowest" style={shadows.soft}>
      <Pressable
        onPress={onContinue}
        accessibilityRole="button"
        accessibilityLabel={`Continue draft ${draftTitle(draft)}, ${n} page${n === 1 ? '' : 's'}`}
        className="min-w-0 flex-1 flex-row items-center py-3 pl-3 pr-1 active:opacity-70"
      >
        <View className="mr-3 h-16 w-12 overflow-hidden rounded-xl bg-surface-container">
          <Image source={{ uri: draft.pages[0] }} className="h-full w-full" resizeMode="cover" />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="font-inter-semibold text-body-lg text-on-surface" numberOfLines={1}>
            {draftTitle(draft)}
          </Text>
          <Text className="mt-0.5 font-inter text-label-md text-on-surface-variant" numberOfLines={1}>
            {`${n} page${n === 1 ? '' : 's'}  ·  ${editedLabel(draft.savedAt)}`}
          </Text>
          <View className="mt-1.5 flex-row">
            <View className="flex-row items-center gap-1 rounded-full bg-tertiary/10 px-2 py-0.5">
              <Icon name="edit-note" size={13} className="text-tertiary" />
              <Text className="font-inter-semibold text-[11px] text-tertiary">Draft, not saved</Text>
            </View>
          </View>
        </View>
      </Pressable>

      <View className="flex-row items-center pr-2">
        <Pressable
          onPress={onDiscard}
          hitSlop={6}
          accessibilityLabel={`Discard draft ${draftTitle(draft)}`}
          className="h-11 w-11 items-center justify-center rounded-full active:bg-error-container"
        >
          <Icon name="delete-outline" size={21} className="text-error/80" />
        </Pressable>
      </View>
    </View>
  );
}
