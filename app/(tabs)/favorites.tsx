import { useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DocumentListItem } from '../../components/DocumentListItem';
import { Icon } from '../../components/Icon';
import { useApp } from '../../context/AppProvider';

export default function FavoritesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { favorites, toggleFavorite } = useApp();

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="border-b border-outline-variant px-margin-mobile py-4">
        <Text className="font-inter-semibold text-headline-lg-mobile text-on-surface">Favorites</Text>
        <Text className="font-inter text-body-sm text-on-surface-variant">Quick access to starred documents</Text>
      </View>

      {favorites.length === 0 ? (
        <View className="flex-1 items-center justify-center px-margin-mobile pb-28">
          <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-surface-container-low">
            <Icon name="favorite-border" size={40} className="text-outline" />
          </View>
          <Text className="text-center font-inter-semibold text-title-md text-on-surface">No favorites yet</Text>
          <Text className="mt-2 text-center font-inter text-body-sm text-on-surface-variant">
            Star documents from your library to see them here.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerClassName="pb-28">
          {favorites.map((doc) => (
            <DocumentListItem
              key={doc.id}
              document={doc}
              onPress={() => router.push(`/document/${doc.id}`)}
              onToggleFavorite={() => toggleFavorite(doc.id)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}
