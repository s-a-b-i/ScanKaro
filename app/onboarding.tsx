/**
 * First launch. Starts exactly like the system splash (logo badge on the light background),
 * the badge grows into the dark top half, then four intro pages (dark top with a white
 * illustration, white panel with text, yellow arrow in a dark notch). No account needed.
 */
import { useRouter } from 'expo-router';
import { ComponentProps, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  FlatList,
  Pressable,
  Text,
  useWindowDimensions,
  View,
  type ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandMark } from '../components/BrandMark';
import { Icon } from '../components/Icon';
import { markOnboardingSeen } from '../utils/onboarding';

type IconName = ComponentProps<typeof Icon>['name'];

const INK = '#16171C';
const ACCENT = '#FFC21A';
const LIGHT_BG = '#F2F3F7'; // system splash background
const BADGE = 178; // system splash badge size
const CURVE = 88; // radius of the S-curve between the dark and white halves

type Page = { key: string; title: string; text: string };

const PAGES: Page[] = [
  {
    key: 'welcome',
    title: 'Welcome to ScanKaro',
    text: 'Your all-in-one scanner for documents, IDs and QR codes. Fast, private and free.',
  },
  {
    key: 'scan',
    title: 'Scan in seconds',
    text: 'Point your camera at any page. Edges are found and straightened automatically.',
  },
  {
    key: 'convert',
    title: 'Convert anything',
    text: 'Turn scans into PDF, Word, Excel or PowerPoint, and read the text in one tap.',
  },
  {
    key: 'private',
    title: 'Private by design',
    text: 'Everything stays on your phone. Lock files away in the Locker. No account needed.',
  },
];

// ---------------------------------------------------------------------------
// Illustrations (white on the dark half, yellow accents)
// ---------------------------------------------------------------------------

function Corners({ size, color = '#ffffff', stroke = 6 }: { size: number; color?: string; stroke?: number }) {
  const arm = size * 0.26;
  return (
    <>
      {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
        <View
          key={c}
          style={{
            position: 'absolute',
            width: arm,
            height: arm,
            borderColor: color,
            [c[0] === 't' ? 'top' : 'bottom']: 0,
            [c[1] === 'l' ? 'left' : 'right']: 0,
            [c[0] === 't' ? 'borderTopWidth' : 'borderBottomWidth']: stroke,
            [c[1] === 'l' ? 'borderLeftWidth' : 'borderRightWidth']: stroke,
            [`border${c[0] === 't' ? 'Top' : 'Bottom'}${c[1] === 'l' ? 'Left' : 'Right'}Radius`]: arm * 0.45,
          }}
        />
      ))}
    </>
  );
}

function WelcomeArt({ width }: { width: number }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <BrandMark size={width * 0.46} shape="mark" />
      <Text className="mt-1 font-inter-bold text-[30px] tracking-[-0.8px] text-[#ffffff]">ScanKaro</Text>
      <Text className="mt-1 font-inter text-[14px] text-[#9A9DA6]">Scan · Convert · Protect</Text>
    </View>
  );
}

function ScanArt({ width }: { width: number }) {
  const size = width * 0.52;
  const sweep = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(sweep, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [sweep]);
  return (
    <View style={{ width: size, height: size }}>
      <Corners size={size} />
      {/* Page */}
      <View
        style={{
          position: 'absolute',
          left: size * 0.22,
          right: size * 0.22,
          top: size * 0.16,
          bottom: size * 0.16,
          borderRadius: 12,
          backgroundColor: '#ffffff',
          padding: size * 0.07,
        }}
      >
        {[0.8, 0.6, 0.9, 0.7, 0.85, 0.5].map((w, i) => (
          <View
            key={i}
            style={{ width: `${w * 100}%`, height: 7, borderRadius: 4, backgroundColor: '#D3D6DE', marginBottom: size * 0.05 }}
          />
        ))}
      </View>
      {/* Moving scan line */}
      <Animated.View
        style={{
          position: 'absolute',
          left: -size * 0.04,
          right: -size * 0.04,
          top: size * 0.14,
          height: 4,
          borderRadius: 2,
          backgroundColor: ACCENT,
          shadowColor: ACCENT,
          shadowOpacity: 0.9,
          shadowRadius: 8,
          elevation: 6,
          transform: [{ translateY: sweep.interpolate({ inputRange: [0, 1], outputRange: [0, size * 0.7] }) }],
        }}
      />
    </View>
  );
}

function FileTile({ label, icon, raised }: { label: string; icon: IconName; raised?: boolean }) {
  return (
    <View
      style={{
        width: 82,
        height: 104,
        borderRadius: 18,
        backgroundColor: raised ? '#ffffff' : '#24262D',
        borderWidth: raised ? 0 : 1,
        borderColor: 'rgba(255,255,255,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ translateY: raised ? -14 : 0 }],
      }}
    >
      <Icon name={icon} size={34} className={raised ? 'text-[#16171C]' : 'text-[#ffffff]'} />
      <Text className={`mt-2 font-inter-bold text-[13px] ${raised ? 'text-[#16171C]' : 'text-[#ffffff]'}`}>{label}</Text>
    </View>
  );
}

function ConvertArt() {
  return (
    <View style={{ alignItems: 'center' }}>
      <View className="flex-row items-end gap-3">
        <FileTile label="Word" icon="description" />
        <FileTile label="PDF" icon="picture-as-pdf" raised />
        <FileTile label="Excel" icon="table-chart" />
      </View>
      <View className="mt-6 flex-row items-center gap-2 rounded-full px-4 py-2" style={{ backgroundColor: 'rgba(255,194,26,0.14)' }}>
        <Icon name="text-snippet" size={18} className="text-[#FFC21A]" />
        <Text className="font-inter-semibold text-[14px] text-[#FFC21A]">Text recognised</Text>
      </View>
    </View>
  );
}

function PrivateArt({ width }: { width: number }) {
  const ring = width * 0.5;
  return (
    <View style={{ alignItems: 'center' }}>
      <View
        style={{
          width: ring,
          height: ring,
          borderRadius: ring / 2,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.12)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: ring * 0.68,
            height: ring * 0.68,
            borderRadius: ring,
            backgroundColor: '#ffffff',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="lock" size={ring * 0.32} className="text-[#16171C]" />
        </View>
        <View
          className="absolute flex-row items-center gap-1.5 rounded-full px-3 py-1.5"
          style={{ backgroundColor: ACCENT, bottom: ring * 0.02 }}
        >
          <Icon name="verified-user" size={16} className="text-[#16171C]" />
          <Text className="font-inter-bold text-[13px] text-[#16171C]">No account</Text>
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const listRef = useRef<FlatList<Page>>(null);
  const [index, setIndex] = useState(0);
  const last = index === PAGES.length - 1;

  const topHeight = Math.round(height * 0.58);
  // (Window height can exclude the navigation bar, so overshoot.)
  const coverScale = (Math.hypot(width, height) / BADGE) * 1.4;

  const grow = useRef(new Animated.Value(0)).current; // badge -> full screen
  const reveal = useRef(new Animated.Value(0)).current; // pages appear
  const pulse = useRef(new Animated.Value(0)).current; // button ring

  useEffect(() => {
    Animated.sequence([
      Animated.delay(350),
      Animated.timing(grow, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      Animated.spring(reveal, { toValue: 1, friction: 8, tension: 55, useNativeDriver: true }),
    ]).start(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ).start();
    });
  }, [grow, pulse, reveal]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]?.index != null) setIndex(viewableItems[0].index);
  }).current;

  const finish = () => {
    void markOnboardingSeen();
    router.replace('/(tabs)');
  };
  const next = () => (last ? finish() : listRef.current?.scrollToIndex({ index: index + 1, animated: true }));

  const renderPage = ({ item }: { item: Page }) => (
    <View style={{ width, flex: 1 }}>
      {/* White behind the dark half's rounded bottom-left. */}
      <View style={{ position: 'absolute', left: 0, top: topHeight - CURVE, width: width / 2, height: CURVE + 2, backgroundColor: '#ffffff' }} />
      {/* Dark top half */}
      <View
        style={{
          height: topHeight,
          paddingTop: insets.top + 24,
          backgroundColor: INK,
          borderBottomLeftRadius: CURVE,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            position: 'absolute',
            width: width * 1.1,
            height: width * 1.1,
            borderRadius: width,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.06)',
            top: -width * 0.45,
            right: -width * 0.45,
          }}
        />
        <View
          style={{
            position: 'absolute',
            width: width * 0.75,
            height: width * 0.75,
            borderRadius: width,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.06)',
            top: -width * 0.28,
            right: -width * 0.28,
          }}
        />
        {item.key === 'welcome' ? <WelcomeArt width={width} /> : null}
        {item.key === 'scan' ? <ScanArt width={width} /> : null}
        {item.key === 'convert' ? <ConvertArt /> : null}
        {item.key === 'private' ? <PrivateArt width={width} /> : null}
      </View>
      {/* Dark corner behind the white panel's rounded top-right. */}
      <View style={{ position: 'absolute', right: 0, top: topHeight, width: width / 2, height: CURVE, backgroundColor: INK }} />
      {/* White panel */}
      <View
        style={{
          flex: 1,
          backgroundColor: '#ffffff',
          borderTopRightRadius: CURVE,
          alignItems: 'center',
          paddingHorizontal: 32,
        }}
      >
        <Text
          className="mt-8 text-center font-inter-semibold text-[30px] leading-[36px] tracking-[-0.8px] text-[#111111]"
          style={{ alignSelf: 'stretch' }}
        >
          {item.title}
        </Text>
        <Text className="mt-3 text-center font-inter text-[15px] leading-[22px] text-[#55595F]">{item.text}</Text>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: LIGHT_BG }}>
      {/* Splash: the system-splash badge's circle grows into the dark background. */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: BADGE,
          height: BADGE,
          borderRadius: BADGE / 2,
          backgroundColor: INK,
          left: (width - BADGE) / 2,
          top: (height - BADGE) / 2,
          transform: [{ scale: grow.interpolate({ inputRange: [0, 1], outputRange: [1, coverScale] }) }],
        }}
      />
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: (width - BADGE) / 2,
          top: (height - BADGE) / 2,
          opacity: grow.interpolate({ inputRange: [0, 0.35], outputRange: [1, 0], extrapolate: 'clamp' }),
        }}
      >
        <BrandMark size={BADGE} shape="circle" />
      </Animated.View>

      {/* Pages */}
      <Animated.View
        style={{
          flex: 1,
          opacity: grow.interpolate({ inputRange: [0.95, 1], outputRange: [0, 1], extrapolate: 'clamp' }),
        }}
      >
        <Animated.View
          style={{
            flex: 1,
            transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
          }}
        >
          <FlatList
            ref={listRef}
            data={PAGES}
            horizontal
            pagingEnabled
            bounces={false}
            showsHorizontalScrollIndicator={false}
            keyExtractor={(p) => p.key}
            renderItem={renderPage}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
            style={{ flex: 1, backgroundColor: INK }}
          />
        </Animated.View>

        {/* Skip */}
        {!last ? (
          <Pressable
            onPress={finish}
            hitSlop={8}
            accessibilityRole="button"
            className="absolute right-5 h-11 justify-center rounded-full px-4"
            style={{ top: insets.top + 8, backgroundColor: 'rgba(255,255,255,0.1)' }}
          >
            <Text className="font-inter-semibold text-[14px] text-[#ffffff]">Skip</Text>
          </Pressable>
        ) : null}

        {/* Dots */}
        <View className="absolute left-0 right-0 flex-row justify-center gap-2" style={{ bottom: 104 + insets.bottom }}>
          {PAGES.map((p, i) => (
            <View
              key={p.key}
              style={{
                height: 8,
                width: i === index ? 24 : 8,
                borderRadius: 4,
                backgroundColor: i === index ? INK : '#D5D7DC',
              }}
            />
          ))}
        </View>

        {/* Dark notch with the round arrow button */}
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            alignSelf: 'center',
            alignItems: 'center',
            width: 132,
            height: 82 + insets.bottom,
            backgroundColor: INK,
            borderTopLeftRadius: 66,
            borderTopRightRadius: 66,
            paddingTop: 12,
          }}
        >
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 12,
              width: 58,
              height: 58,
              borderRadius: 29,
              borderWidth: 2,
              borderColor: ACCENT,
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] }) }],
            }}
          />
          <Pressable
            onPress={next}
            accessibilityRole="button"
            accessibilityLabel={last ? 'Get started' : 'Next'}
            className="h-[58px] w-[58px] items-center justify-center rounded-full active:opacity-85"
            style={{ backgroundColor: ACCENT }}
          >
            <Icon name={last ? 'check' : 'arrow-forward'} size={26} className="text-[#111111]" />
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}
