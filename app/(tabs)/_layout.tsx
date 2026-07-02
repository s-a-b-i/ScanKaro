import { Tabs, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../../components/Icon';

type TabName = 'index' | 'folders' | 'favorites' | 'settings';

function TabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const tabs: { name: TabName; label: string; icon: React.ComponentProps<typeof Icon>['name'] }[] = [
    { name: 'index', label: 'Home', icon: 'home' },
    { name: 'folders', label: 'Folders', icon: 'folder' },
    { name: 'favorites', label: 'Favorites', icon: 'favorite' },
    { name: 'settings', label: 'Settings', icon: 'settings' },
  ];

  return (
    <View
      className="absolute bottom-0 left-0 right-0 flex-row items-end justify-around rounded-t-xl border-t border-outline-variant/30 bg-surface/95 px-4"
      style={{ paddingBottom: insets.bottom + 8, height: 80 + insets.bottom }}
    >
      {tabs.slice(0, 2).map((tab) => {
        const routeIndex = state.routes.findIndex((r: { name: string }) => r.name === tab.name);
        const isFocused = state.index === routeIndex;
        return (
          <Pressable
            key={tab.name}
            onPress={() => navigation.navigate(tab.name)}
            className={`items-center justify-center rounded-2xl px-4 py-1 ${isFocused ? 'bg-primary-container' : ''}`}
          >
            <Icon
              name={tab.icon}
              size={24}
              className={isFocused ? 'text-on-primary-container' : 'text-secondary'}
              filled={isFocused}
            />
            <Text
              className={`font-inter text-label-md ${isFocused ? 'text-on-primary-container' : 'text-secondary'}`}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}

      <View className="relative -top-6">
        <Pressable
          onPress={() => router.push('/scan')}
          className="h-16 w-16 items-center justify-center rounded-full border-4 border-background bg-primary shadow-2xl active:scale-95"
          style={{ shadowColor: '#00685f', shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 }}
        >
          <Icon name="camera-alt" size={32} className="text-on-primary" />
        </Pressable>
      </View>

      {tabs.slice(2).map((tab) => {
        const routeIndex = state.routes.findIndex((r: { name: string }) => r.name === tab.name);
        const isFocused = state.index === routeIndex;
        return (
          <Pressable
            key={tab.name}
            onPress={() => navigation.navigate(tab.name)}
            className={`items-center justify-center rounded-full px-4 py-1 ${isFocused ? 'bg-primary-container rounded-2xl' : ''}`}
          >
            <Icon
              name={tab.icon}
              size={24}
              className={isFocused ? 'text-on-primary-container' : 'text-secondary'}
              filled={isFocused}
            />
            <Text
              className={`font-inter text-label-md ${isFocused ? 'text-on-primary-container' : 'text-secondary'}`}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="folders" />
      <Tabs.Screen name="favorites" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
