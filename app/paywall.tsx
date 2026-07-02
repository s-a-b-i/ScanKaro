import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../components/Icon';
import { PAYWALL_HERO } from '../constants/data';
import { goBackOr } from '../utils/navigation';

const BENEFITS = [
  { icon: 'font-download' as const, label: 'Unlimited OCR' },
  { icon: 'block' as const, label: 'No Ads Ever' },
  { icon: 'cloud-done' as const, label: 'Cloud Sync' },
];

export default function PaywallScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [plan, setPlan] = useState<'yearly' | 'monthly'>('yearly');

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="h-14 flex-row items-center justify-between border-b border-outline-variant bg-surface px-margin-mobile">
        <Pressable onPress={() => goBackOr(router, '/(tabs)/settings')} className="rounded-full p-2">
          <Icon name="close" size={24} className="text-primary" />
        </Pressable>
        <Text className="font-inter-semibold text-headline-lg-mobile text-primary">ScanKaro</Text>
        <Pressable className="rounded-full p-2">
          <Icon name="help-outline" size={24} className="text-primary" />
        </Pressable>
      </View>

      <ScrollView contentContainerClassName="pb-stack-lg" showsVerticalScrollIndicator={false}>
        <View className="items-center px-margin-mobile pb-12 pt-10">
          <View className="mb-4 flex-row items-center gap-2 rounded-full bg-primary-fixed px-3 py-1">
            <Icon name="verified" size={14} className="text-on-primary-fixed" filled />
            <Text className="font-inter text-label-caps uppercase text-on-primary-fixed">Unlimited Access</Text>
          </View>
          <Text className="mb-stack-sm text-center font-inter-bold text-display-lg text-on-surface">Scan Without Limits</Text>
          <Text className="mb-8 max-w-[280px] text-center font-inter text-body-lg text-on-surface-variant">
            Elevate your productivity with high-speed OCR and seamless cloud sync.
          </Text>

          <View className="mb-8 h-48 w-full overflow-hidden rounded-2xl border border-outline-variant shadow-sm">
            <Image source={{ uri: PAYWALL_HERO }} className="h-full w-full" resizeMode="cover" />
          </View>

          <View className="mb-10 w-full flex-row gap-3">
            {BENEFITS.map((item) => (
              <View
                key={item.label}
                className="flex-1 items-center rounded-xl border border-outline-variant bg-surface-container-low p-4"
              >
                <Icon name={item.icon} size={24} className="mb-2 text-primary" />
                <Text className="text-center font-inter text-label-md text-on-surface">{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className="gap-4 px-margin-mobile">
          <Pressable
            onPress={() => setPlan('yearly')}
            className={`rounded-2xl border-2 p-5 ${plan === 'yearly' ? 'border-primary bg-surface' : 'border-outline-variant bg-surface'}`}
          >
            <View className="absolute -top-3 right-6 rounded-full bg-primary px-3 py-1">
              <Text className="font-inter text-label-caps uppercase text-on-primary">Best Value</Text>
            </View>
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="font-inter-semibold text-title-md text-on-surface">Yearly Access</Text>
                <Text className="font-inter text-body-sm text-on-surface-variant">Save 45% compared to monthly</Text>
              </View>
              <View className="items-end">
                <Text className="font-inter-semibold text-headline-lg-mobile text-primary">$29.99</Text>
                <Text className="font-inter text-label-md text-on-surface-variant">/year</Text>
              </View>
            </View>
          </Pressable>

          <Pressable
            onPress={() => setPlan('monthly')}
            className={`rounded-2xl border p-5 ${plan === 'monthly' ? 'border-2 border-primary' : 'border-outline-variant bg-surface'}`}
          >
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="font-inter-semibold text-title-md text-on-surface">Monthly Access</Text>
                <Text className="font-inter text-body-sm text-on-surface-variant">Flexible commitment</Text>
              </View>
              <View className="items-end">
                <Text className="font-inter-semibold text-headline-lg-mobile text-on-surface">$4.99</Text>
                <Text className="font-inter text-label-md text-on-surface-variant">/month</Text>
              </View>
            </View>
          </Pressable>
        </View>

        <View className="mt-10 px-margin-mobile">
          <Pressable className="mb-6 h-14 flex-row items-center justify-center gap-2 rounded-full bg-primary shadow-lg active:scale-95">
            <Text className="font-inter-semibold text-title-md text-on-primary">Subscribe Now</Text>
            <Icon name="chevron-right" size={22} className="text-on-primary" />
          </Pressable>
          <Pressable className="mb-4 items-center">
            <Text className="font-inter text-label-md text-primary">Restore Purchase</Text>
          </Pressable>
          <Text className="text-center font-inter text-[11px] leading-tight text-on-surface-variant">
            Subscription automatically renews unless turned off in Account Settings at least 24h before end of period.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
