import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Tabs, useRouter } from 'expo-router';
import { ComponentProps } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassReflections } from '../../components/Glass';
import { Icon } from '../../components/Icon';
import { TAB_BAR_GAP, TAB_BAR_HEIGHT, shadows } from '../../components/ui';
import { useTheme } from '../../constants/theme';

type IconName = ComponentProps<typeof Icon>['name'];

const TABS: { name: string; label: string; icon: IconName; activeIcon: IconName }[] = [
  { name: 'index', label: 'Home', icon: 'home', activeIcon: 'home' },
  { name: 'folders', label: 'Files', icon: 'folder-open', activeIcon: 'folder' },
  { name: 'tools', label: 'Tools', icon: 'handyman', activeIcon: 'handyman' },
  { name: 'settings', label: 'Settings', icon: 'settings', activeIcon: 'settings' },
];

const SCAN_SIZE = TAB_BAR_HEIGHT;

/** Floating frosted-glass pill with a separate round scan button on the right. */
function GlassTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const bottom = Math.max(insets.bottom, TAB_BAR_GAP);
  const { isDark } = useTheme();
  const radius = TAB_BAR_HEIGHT / 2;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom }]}>
      {/* Lower elevation on Android: its shadow shows through translucent views. */}
      <View
        style={[
          styles.pill,
          shadows.lifted,
          { elevation: 4, borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.85)' },
        ]}
      >
        <BlurView
          intensity={Platform.OS === 'ios' ? 50 : 32}
          tint={isDark ? 'dark' : 'light'}
          experimentalBlurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFill}
        />
        {/* Tint keeps labels readable, and is the fallback where blur is unavailable. */}
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: isDark ? 'rgba(30,32,38,0.62)' : 'rgba(248,248,250,0.55)' },
          ]}
        />
        <GlassReflections isDark={isDark} radius={radius} />

        <View className="flex-1 flex-row items-center justify-between px-1.5">
          {TABS.map((tab) => {
            const routeIndex = state.routes.findIndex((r: { name: string }) => r.name === tab.name);
            const focused = state.index === routeIndex;
            return (
              <Pressable
                key={tab.name}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={tab.label}
                onPress={() => {
                  const event = navigation.emit({
                    type: 'tabPress',
                    target: state.routes[routeIndex]?.key,
                    canPreventDefault: true,
                  });
                  if (!focused && !event.defaultPrevented) navigation.navigate(tab.name);
                }}
                className="h-[52px] flex-1 items-center justify-center rounded-full"
                style={
                  focused
                    ? {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.85)',
                        borderWidth: StyleSheet.hairlineWidth,
                        borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.06)',
                      }
                    : undefined
                }
              >
                <Icon
                  name={focused ? tab.activeIcon : tab.icon}
                  size={23}
                  className={focused ? 'text-on-surface' : 'text-on-surface-variant'}
                />
                <Text
                  className={`mt-0.5 text-[11px] ${
                    focused ? 'font-inter-semibold text-on-surface' : 'font-inter-medium text-on-surface-variant'
                  }`}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Scan document"
        onPress={() => router.push('/scan')}
        className="items-center justify-center overflow-hidden rounded-full bg-on-surface active:opacity-85"
        style={[{ width: SCAN_SIZE, height: SCAN_SIZE }, shadows.lifted]}
      >
        {/* Glossy highlight on the solid button. */}
        <LinearGradient
          colors={[isDark ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.28)', 'rgba(255,255,255,0)']}
          locations={[0, 0.6]}
          style={StyleSheet.absoluteFill}
        />
        <Icon name="document-scanner" size={27} className="text-surface" />
      </Pressable>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <GlassTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="folders" />
      <Tabs.Screen name="tools" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pill: {
    flex: 1,
    height: TAB_BAR_HEIGHT,
    borderRadius: TAB_BAR_HEIGHT / 2,
    overflow: 'hidden',
    borderWidth: 1,
  },
});
