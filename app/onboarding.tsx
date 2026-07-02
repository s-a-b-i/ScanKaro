import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Pressable,
  Text,
  View,
  type ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../components/Icon';
import { ONBOARDING_SLIDES } from '../constants/data';

const { width } = Dimensions.get('window');

function SlideIllustration({ index }: { index: number }) {
  if (index === 0) {
    return (
      <View className="mb-12 h-72 w-full max-w-sm items-center justify-center overflow-hidden rounded-[32px] border border-outline-variant bg-surface-container-low">
        <View className="absolute inset-0 bg-primary/5" />
        <View className="relative z-10 h-4/5 w-4/5 -rotate-3 rounded-lg border border-slate-200 bg-white p-4 shadow-lg">
          <View className="gap-3 opacity-30">
            <View className="h-4 w-3/4 rounded bg-slate-200" />
            <View className="h-4 w-1/2 rounded bg-slate-200" />
            <View className="h-32 w-full rounded bg-slate-100" />
          </View>
          <View className="absolute inset-0 rounded-lg border-2 border-primary/40" />
        </View>
      </View>
    );
  }

  if (index === 1) {
    return (
      <View className="mb-12 h-72 w-full max-w-sm items-center justify-center overflow-hidden rounded-[32px] border border-outline-variant bg-surface-container-low">
        <View className="absolute inset-0 bg-secondary/5" />
        <View className="relative z-10 h-4/5 w-4/5 gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-lg">
          <View className="flex-row items-center gap-3 border-b border-slate-100 pb-3">
            <Icon name="search" size={20} className="text-primary" />
            <View className="h-4 w-32 rounded bg-slate-100" />
          </View>
          <View className="flex-row flex-wrap gap-2">
            <View className="rounded bg-primary/20 px-2 py-1">
              <Text className="text-[10px] font-bold text-primary">INVOICE_ID</Text>
            </View>
            <View className="rounded bg-primary/10 px-2 py-1">
              <Text className="text-[10px] text-primary/70">TOTAL_AMT</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  const features = [
    { icon: 'lock' as const, label: 'Secure' },
    { icon: 'edit' as const, label: 'Sign' },
    { icon: 'cloud-upload' as const, label: 'Sync' },
    { icon: 'share' as const, label: 'Share' },
  ];

  return (
    <View className="mb-12 h-72 w-full max-w-sm items-center justify-center overflow-hidden rounded-[32px] border border-outline-variant bg-surface-container-low">
      <View className="z-10 flex-row flex-wrap justify-center gap-4 p-8">
        {features.map((item) => (
          <View
            key={item.label}
            className="w-[42%] items-center justify-center rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
          >
            <Icon name={item.icon} size={24} className="mb-2 text-primary" />
            <Text className="font-inter text-label-md text-on-surface">{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [showSplash, setShowSplash] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const splashOpacity = useRef(new Animated.Value(1)).current;
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(splashOpacity, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }).start(() => setShowSplash(false));
    }, 2000);
    return () => clearTimeout(timer);
  }, [splashOpacity]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]?.index != null) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const finish = () => router.replace('/login');
  const next = () => {
    if (currentIndex < ONBOARDING_SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    } else {
      finish();
    }
  };

  return (
    <View className="flex-1 bg-background">
      {showSplash ? (
        <Animated.View
          style={{ opacity: splashOpacity }}
          className="absolute inset-0 z-50 items-center justify-center bg-primary"
        >
          <View className="mb-6 h-24 w-24 items-center justify-center rounded-3xl bg-on-primary shadow-2xl">
            <Icon name="scanner" size={48} className="text-primary" filled />
          </View>
          <Text className="font-inter text-display-lg text-on-primary">ScanKaro</Text>
          <Text className="mt-2 font-inter text-label-md uppercase tracking-widest text-on-primary/90">
            Scan, Organize, Share
          </Text>
        </Animated.View>
      ) : null}

      <View className="flex-1" style={{ paddingTop: insets.top }}>
        <View className="flex-row items-center justify-between px-margin-mobile py-stack-lg">
          <View className="flex-row items-center gap-2">
            <Icon name="scanner" size={22} className="text-primary" filled />
            <Text className="font-inter text-title-md text-primary">ScanKaro</Text>
          </View>
          <Pressable onPress={finish}>
            <Text className="font-inter text-label-md text-secondary">Skip</Text>
          </Pressable>
        </View>

        <FlatList
          ref={listRef}
          data={ONBOARDING_SLIDES}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
          renderItem={({ item, index }) => (
            <View style={{ width }} className="items-center px-margin-mobile pt-8">
              <SlideIllustration index={index} />
              <Text className="mb-stack-md text-center font-inter text-headline-lg-mobile text-on-surface">
                {item.title}
              </Text>
              <Text className="max-w-xs text-center font-inter text-body-lg text-on-surface-variant">
                {item.description}
              </Text>
            </View>
          )}
        />

        <View className="items-center gap-8 px-margin-mobile pb-12" style={{ paddingBottom: insets.bottom + 48 }}>
          <View className="flex-row gap-2">
            {ONBOARDING_SLIDES.map((slide, index) => (
              <View
                key={slide.id}
                className={`h-2 rounded-full ${index === currentIndex ? 'w-6 bg-primary' : 'w-2 bg-outline-variant'}`}
              />
            ))}
          </View>

          <Pressable
            onPress={next}
            className="w-full max-w-sm items-center rounded-xl bg-primary py-4 shadow-lg active:opacity-90"
          >
            <Text className="font-inter text-title-md text-on-primary">
              {currentIndex === ONBOARDING_SLIDES.length - 1 ? 'Get Started' : 'Next'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
