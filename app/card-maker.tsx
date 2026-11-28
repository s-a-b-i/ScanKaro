/**
 * Business card maker, step 1: choose a design. Every design is shown as a complete card
 * (your details, or sample ones) that flips in 3D to show its back. "Use this design" opens
 * step 2, where you type your details and customise it.
 */
import type { SkImage } from '@shopify/react-native-skia';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FlipCard } from '../components/FlipCard';
import { GlassBackground } from '../components/Glass';
import { Icon } from '../components/Icon';
import {
  CARD_H,
  CARD_TEMPLATES,
  CARD_W,
  CardTemplate,
  isCardEmpty,
  loadCard,
  loadCardFonts,
  renderCardBase64,
  SAMPLE_CARD,
} from '../utils/cardMaker';
import { goBackOr } from '../utils/navigation';
import { loadImage } from '../utils/skiaImage';

const uri = (b64: string) => `data:image/png;base64,${b64}`;

export default function CardDesignsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const saved = useMemo(loadCard, []);
  const data = isCardEmpty(saved.data) ? { ...SAMPLE_CARD, qr: saved.data.qr } : saved.data;
  const [logo, setLogo] = useState<SkImage | null>(null);
  const [cards, setCards] = useState<Partial<Record<CardTemplate, { front: string; back: string }>>>({});
  // Real typefaces (Inter Tight, Playfair Display, Barlow Condensed); draw once loaded.
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    loadCardFonts()
      .catch(() => undefined)
      .finally(() => setFontsReady(true));
  }, []);

  useEffect(() => {
    if (saved.style.logo) loadImage(saved.style.logo).then(setLogo).catch(() => setLogo(null));
  }, [saved.style.logo]);

  // Draw one design per tick so the list appears quickly and stays smooth.
  useEffect(() => {
    if (!fontsReady) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const o = { style: { ...saved.style, accent: undefined }, logo };
    const step = (i: number) => {
      if (cancelled || i >= CARD_TEMPLATES.length) return;
      const tp = CARD_TEMPLATES[i];
      try {
        const sides = { front: uri(renderCardBase64(data, tp.key, 'front', 640, o)), back: uri(renderCardBase64(data, tp.key, 'back', 640, o)) };
        if (!cancelled) setCards((c) => ({ ...c, [tp.key]: sides }));
      } catch {
        // Skip this design.
      }
      timer = setTimeout(() => step(i + 1), 30);
    };
    timer = setTimeout(() => step(0), 60);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [logo, fontsReady]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="h-16 flex-row items-center justify-between px-5">
        <Pressable
          onPress={() => goBackOr(router, '/(tabs)/tools')}
          accessibilityLabel="Back"
          className="h-12 w-12 items-center justify-center overflow-hidden rounded-full active:opacity-70"
        >
          <GlassBackground radius={24} />
          <Icon name="arrow-back" size={22} className="text-on-surface" />
        </Pressable>
        <Text className="font-inter-semibold text-[17px] text-on-surface">Business card</Text>
        <View className="w-12" />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 32 }} showsVerticalScrollIndicator={false}>
        <Text className="mt-2 font-inter-semibold text-[30px] leading-[36px] tracking-[-0.8px] text-on-surface">Choose a design</Text>
        <Text className="mb-6 mt-2 font-inter text-[15px] leading-[21px] text-on-surface-variant">
          Tap a card to flip it and see the back. You can change colours, font and logo next.
        </Text>

        {CARD_TEMPLATES.map((tp, i) => (
          <View key={tp.key} className="mb-10">
            <View className="mb-4 flex-row items-baseline justify-between">
              <Text className="font-inter-bold text-[20px] text-on-surface">{tp.label}</Text>
              <Text className="font-inter text-[13px] text-on-surface-variant">
                {i + 1} of {CARD_TEMPLATES.length}
              </Text>
            </View>
            <FlipCard front={cards[tp.key]?.front} back={cards[tp.key]?.back} ratio={CARD_W / CARD_H} />
            <Pressable
              onPress={() => router.push({ pathname: '/card-details', params: { template: tp.key } })}
              accessibilityRole="button"
              accessibilityLabel={`Use the ${tp.label} design`}
              className="mt-4 h-[52px] flex-row items-center justify-center gap-2 rounded-full bg-on-surface active:opacity-85"
            >
              <Text className="font-inter-semibold text-[16px] text-surface">Use this design</Text>
              <Icon name="arrow-forward" size={20} className="text-surface" />
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
