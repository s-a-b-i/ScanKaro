import { ComponentProps } from 'react';
import { Image, Pressable, Text, View } from 'react-native';

import { DocumentItem } from '../types';
import { daysUntil, expiryLabel } from '../utils/reminders';
import { Icon } from './Icon';
import { shadows } from './ui';

type DocumentListItemProps = {
  document: DocumentItem;
  onPress: () => void;
  onToggleFavorite: () => void;
  onDelete?: () => void;
  /** Long press, e.g. to start selecting. */
  onLongPress?: () => void;
  /** Select mode: shows a checkbox and hides the row buttons. */
  selecting?: boolean;
  selected?: boolean;
};

function TagChip({ label, variant = 'secondary' }: { label: string; variant?: 'secondary' | 'tertiary' | 'primary' }) {
  const styles = {
    secondary: 'bg-secondary-container',
    tertiary: 'bg-tertiary/10',
    primary: 'bg-primary/10',
  };
  const textStyles = {
    secondary: 'text-on-secondary-container',
    tertiary: 'text-tertiary',
    primary: 'text-primary',
  };
  return (
    <View className={`rounded-full px-2 py-0.5 ${styles[variant]}`}>
      <Text className={`font-inter-semibold text-[11px] ${textStyles[variant]}`}>{label}</Text>
    </View>
  );
}

/** A document shown as a rounded white card row. Place inside a container with horizontal padding. */
export function DocumentListItem({
  document,
  onPress,
  onToggleFavorite,
  onDelete,
  onLongPress,
  selecting,
  selected,
}: DocumentListItemProps) {
  const expiringSoon = document.expiresAt ? daysUntil(document.expiresAt) <= 30 : false;
  const tagVariant = (tag: string): ComponentProps<typeof TagChip>['variant'] => {
    if (tag === 'ENCRYPTED') return 'primary';
    if (tag === 'HEALTH' || tag === 'SIGNED') return 'tertiary';
    return 'secondary';
  };

  const handleDeletePress = () => {
    if (!onDelete) return;

    // Undoable (Recently deleted + Undo banner), so no confirmation alert.
    onDelete();
  };

  return (
    <View
      className={`mb-3 flex-row items-center rounded-3xl bg-surface-container-lowest ${selected ? 'border-2 border-primary' : ''}`}
      style={shadows.soft}
    >
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        accessibilityState={selecting ? { checked: !!selected } : undefined}
        className="min-w-0 flex-1 flex-row items-center py-3 pl-3 pr-1 active:opacity-70"
      >
        {selecting ? (
          <View
            className={`mr-3 h-6 w-6 items-center justify-center rounded-full border-2 ${
              selected ? 'border-primary bg-primary' : 'border-outline-variant'
            }`}
          >
            {selected ? <Icon name="check" size={15} className="text-on-primary" /> : null}
          </View>
        ) : null}
        <View className="mr-3 h-16 w-12 overflow-hidden rounded-xl bg-surface-container">
          {document.image ? (
            <Image source={{ uri: document.image }} className="h-full w-full" resizeMode="cover" />
          ) : (
            <View className="h-full w-full items-center justify-center">
              <Icon name="description" size={22} className="text-on-surface-variant" />
            </View>
          )}
        </View>
        <View className="min-w-0 flex-1">
          <Text className="font-inter-semibold text-body-lg text-on-surface" numberOfLines={1}>
            {document.title}
          </Text>
          <Text className="mt-0.5 font-inter text-label-md text-on-surface-variant" numberOfLines={1}>
            {[document.meta, document.size].filter(Boolean).join('  ·  ')}
          </Text>
          {document.tags.length > 0 || document.expiresAt ? (
            <View className="mt-1.5 flex-row flex-wrap gap-1.5">
              {document.expiresAt ? (
                <View className={`rounded-full px-2 py-0.5 ${expiringSoon ? 'bg-error-container' : 'bg-surface-container'}`}>
                  <Text
                    className={`font-inter-semibold text-[11px] ${expiringSoon ? 'text-on-error-container' : 'text-on-surface-variant'}`}
                  >
                    {expiryLabel(document.expiresAt)}
                  </Text>
                </View>
              ) : null}
              {document.tags.map((tag) => (
                <TagChip key={tag} label={tag} variant={tagVariant(tag)} />
              ))}
            </View>
          ) : null}
        </View>
      </Pressable>

      <View className={`flex-row items-center pr-2 ${selecting ? 'hidden' : ''}`}>
        <Pressable
          onPress={onToggleFavorite}
          hitSlop={6}
          accessibilityLabel={document.favorite ? 'Remove from favorites' : 'Add to favorites'}
          className="h-11 w-11 items-center justify-center rounded-full active:bg-surface-container"
        >
          <Icon
            name={document.favorite ? 'star' : 'star-border'}
            size={22}
            className={document.favorite ? 'text-[#f5a524]' : 'text-on-surface-variant'}
          />
        </Pressable>

        {onDelete ? (
          <Pressable
            onPress={handleDeletePress}
            hitSlop={6}
            accessibilityLabel="Delete document"
            className="h-11 w-11 items-center justify-center rounded-full active:bg-error-container"
          >
            <Icon name="delete-outline" size={21} className="text-error/80" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
