import { ComponentProps } from 'react';
import { Alert, Image, Pressable, Text, View } from 'react-native';

import { DocumentItem } from '../types';
import { Icon } from './Icon';

type DocumentListItemProps = {
  document: DocumentItem;
  onPress: () => void;
  onToggleFavorite: () => void;
  onDelete?: () => void;
};

function TagChip({ label, variant = 'secondary' }: { label: string; variant?: 'secondary' | 'tertiary' | 'primary' }) {
  const styles = {
    secondary: 'bg-secondary-container',
    tertiary: 'bg-tertiary-container',
    primary: 'bg-primary-container',
  };
  const textStyles = {
    secondary: 'text-on-secondary-container',
    tertiary: 'text-on-tertiary-container',
    primary: 'text-on-primary-container',
  };
  return (
    <View className={`rounded-full px-2 py-0.5 ${styles[variant]}`}>
      <Text className={`font-inter text-[10px] font-medium ${textStyles[variant]}`}>{label}</Text>
    </View>
  );
}

export function DocumentListItem({ document, onPress, onToggleFavorite, onDelete }: DocumentListItemProps) {
  const tagVariant = (tag: string): ComponentProps<typeof TagChip>['variant'] => {
    if (tag === 'ENCRYPTED') return 'primary';
    if (tag === 'HEALTH' || tag === 'SIGNED') return 'tertiary';
    return 'secondary';
  };

  const handleDeletePress = () => {
    if (!onDelete) return;

    Alert.alert('Delete document?', `"${document.title}" will be permanently removed.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);
  };

  return (
    <View className="flex-row items-center border-b border-outline-variant bg-surface">
      <Pressable onPress={onPress} className="min-w-0 flex-1 flex-row items-center p-4 active:bg-surface-container-low">
        <View className="mr-4 h-16 w-12 overflow-hidden rounded-sm border border-outline-variant bg-surface-container">
          <Image source={{ uri: document.image }} className="h-full w-full" resizeMode="cover" />
        </View>
        <View className="min-w-0 flex-1">
          <View className="flex-row items-start justify-between gap-2">
            <Text className="flex-1 font-inter-semibold text-title-md text-on-surface" numberOfLines={1}>
              {document.title}
            </Text>
            <Text className="font-inter text-label-md text-on-surface-variant">{document.size}</Text>
          </View>
          <Text className="font-inter text-label-md text-on-surface-variant">{document.meta}</Text>
          {document.tags.length > 0 ? (
            <View className="mt-2 flex-row flex-wrap gap-2">
              {document.tags.map((tag) => (
                <TagChip key={tag} label={tag} variant={tagVariant(tag)} />
              ))}
            </View>
          ) : null}
        </View>
      </Pressable>

      <View className="flex-row items-center gap-1 pr-3">
        <Pressable
          onPress={onToggleFavorite}
          hitSlop={8}
          className="h-10 w-10 items-center justify-center rounded-full active:bg-surface-container"
        >
          <Icon
            name={document.favorite ? 'star' : 'star-border'}
            size={22}
            className={document.favorite ? 'text-primary' : 'text-on-surface-variant'}
            filled={document.favorite}
          />
        </Pressable>

        {onDelete ? (
          <Pressable
            onPress={handleDeletePress}
            hitSlop={8}
            className="h-10 w-10 items-center justify-center rounded-full active:bg-error-container"
          >
            <Icon name="delete-outline" size={22} className="text-error" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
