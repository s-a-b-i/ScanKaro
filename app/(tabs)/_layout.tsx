import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Tabs } from 'expo-router';
import { ComponentProps, useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassReflections } from '../../components/Glass';
import { Icon } from '../../components/Icon';
import { TAB_BAR_GAP, TAB_BAR_HEIGHT } from '../../components/ui';
import { useTheme } from '../../constants/theme';
import { useStartScan } from '../../hooks/useStartScan';

type IconName = ComponentProps<typeof Icon>['name'];

const TABS: { name: string; label: string; icon: IconName; activeIcon: IconName }[] = [
  { name: 'index', label: 'Home', icon: 'home', activeIcon: 'home' },
  { name: 'folders', label: 'Files', icon: 'folder-open', activeIcon: 'folder' },
  { name: 'tools', label: 'Tools', icon: 'handyman', activeIcon: 'handyman' },
  { name: 'settings', label: 'Settings', icon: 'settings', activeIcon: 'settings' },
];

const HEIGHT = TAB_BAR_HEIGHT;
const PAD = 5;

/**
 * Liquid-glass tab bar: one floating pill (blur, translucent fill, specular rim) with a
 * brighter glass "lens" that slides to the selected tab, plus a round scan button. A fade
 * behind the bar lets content dissolve into it (scroll edge effect).
 */
function GlassTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const startScan = useStartScan();
  const { isDark, colors } = useTheme();
  const bottom = Math.max(insets.bottom, TAB_BAR_GAP);
  const [barWidth, setBarWidth] = useState(0);
  const tabWidth = barWidth > 0 ? (barWidth - PAD * 2) / TABS.length : 0;

  const activeTab = TABS.findIndex((t) => state.routes[state.index]?.name === t.name);
  const lens = useRef(new Animated.Value(Math.max(activeTab, 0))).current;
  useEffect(() => {
    if (activeTab < 0) return;
    Animated.spring(lens, { toValue: activeTab, friction: 9, tension: 90, useNativeDriver: true }).start();
  }, [activeTab, lens]);

  const rim = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.9)';

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {/* Scroll edge effect: content fades out behind the bar. */}
      <LinearGradient
        pointerEvents="none"
        colors={[`${colors.background}00`, `${colors.background}D9`]}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: HEIGHT + bottom + 40 }}
      />

      <View pointerEvents="box-none" style={[styles.wrap, { bottom }]}>
        {/* The pill */}
        <View
          onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
          style={[styles.pill, { borderColor: rim, shadowColor: isDark ? '#000' : '#1b2440' }]}
        >
          <View style={[StyleSheet.absoluteFill, { borderRadius: HEIGHT / 2, overflow: 'hidden' }]}>
            <BlurView
              intensity={Platform.OS === 'ios' ? 60 : 50}
              tint={isDark ? 'dark' : 'light'}
              experimentalBlurMethod="dimezisBlurView"
              style={StyleSheet.absoluteFill}
            />
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: isDark ? 'rgba(28,30,36,0.55)' : 'rgba(250,250,252,0.42)' },
              ]}
            />
            <GlassReflections isDark={isDark} radius={HEIGHT / 2} />
          </View>

          {/* Sliding lens under the selected tab */}
          {tabWidth > 0 && activeTab >= 0 ? (
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: PAD,
                bottom: PAD,
                left: PAD,
                width: tabWidth,
                borderRadius: (HEIGHT - PAD * 2) / 2,
                overflow: 'hidden',
                backgroundColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.78)',
                borderWidth: StyleSheet.hairlineWidth * 2,
                borderColor: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,1)',
                transform: [{ translateX: Animated.multiply(lens, tabWidth) }],
              }}
            >
              <GlassReflections isDark={isDark} radius={(HEIGHT - PAD * 2) / 2} />
            </Animated.View>
          ) : null}

          <View style={{ flex: 1, flexDirection: 'row', paddingHorizontal: PAD }}>
            {TABS.map((tab, i) => {
              const routeIndex = state.routes.findIndex((r: { name: string }) => r.name === tab.name);
              const focused = i === activeTab;
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
                  style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
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

        {/* Scan: the primary action, so its glass carries colour (ink). */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Scan document"
          onPress={() => startScan()}
          className="active:opacity-85"
          style={[styles.scan, { borderColor: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.35)' }]}
        >
          <View style={[StyleSheet.absoluteFill, { borderRadius: HEIGHT / 2, overflow: 'hidden', backgroundColor: '#17181D' }]}>
            <GlassReflections isDark radius={HEIGHT / 2} />
          </View>
          <Icon name="document-scanner" size={26} className="text-[#ffffff]" />
        </Pressable>
      </View>
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
    height: HEIGHT,
    borderRadius: HEIGHT / 2,
    borderWidth: 1,
    shadowOpacity: 0.16,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    // Low elevation on Android: a strong shadow shows through translucent views.
    elevation: 3,
  },
  scan: {
    width: HEIGHT,
    height: HEIGHT,
    borderRadius: HEIGHT / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
});
