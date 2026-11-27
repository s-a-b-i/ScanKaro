/**
 * Create a QR code: text, link, Wi-Fi, contact, phone, email or SMS, with a live preview,
 * shared as a PNG. Works offline.
 */
import { useRouter } from 'expo-router';
import { ComponentProps, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { Icon } from '../components/Icon';
import { GlassBackground } from '../components/Glass';
import { KeyboardAvoid } from '../components/KeyboardAvoid';
import { useTheme } from '../constants/theme';
import { goBackOr } from '../utils/navigation';
import { QrFields, QrKind, qrMatrix, qrPayload, qrSvgPath, saveQrPng, shareQrPng } from '../utils/qr';

type IconName = ComponentProps<typeof Icon>['name'];

const KINDS: { key: QrKind; label: string; icon: IconName }[] = [
  { key: 'link', label: 'Link', icon: 'link' },
  { key: 'text', label: 'Text', icon: 'notes' },
  { key: 'wifi', label: 'Wi-Fi', icon: 'wifi' },
  { key: 'contact', label: 'Contact', icon: 'contact-page' },
  { key: 'phone', label: 'Phone', icon: 'call' },
  { key: 'email', label: 'Email', icon: 'mail' },
  { key: 'sms', label: 'SMS', icon: 'sms' },
];

type Field = {
  key: keyof QrFields;
  label: string;
  keyboard?: 'url' | 'email-address' | 'phone-pad';
  multiline?: boolean;
  secure?: boolean;
};

const FIELDS: Record<QrKind, Field[]> = {
  link: [{ key: 'url', label: 'Web address', keyboard: 'url' }],
  text: [{ key: 'text', label: 'Text', multiline: true }],
  wifi: [
    { key: 'ssid', label: 'Network name' },
    { key: 'password', label: 'Password', secure: true },
  ],
  contact: [
    { key: 'name', label: 'Name' },
    { key: 'phone', label: 'Phone', keyboard: 'phone-pad' },
    { key: 'email', label: 'Email', keyboard: 'email-address' },
    { key: 'company', label: 'Company' },
  ],
  phone: [{ key: 'phone', label: 'Phone number', keyboard: 'phone-pad' }],
  email: [{ key: 'email', label: 'Email address', keyboard: 'email-address' }],
  sms: [
    { key: 'phone', label: 'Phone number', keyboard: 'phone-pad' },
    { key: 'message', label: 'Message', multiline: true },
  ],
};

export default function QrCreateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [kind, setKind] = useState<QrKind>('link');
  const [fields, setFields] = useState<QrFields>({ security: 'WPA' });

  const payload = qrPayload(kind, fields);
  const { matrix, error } = useMemo(() => {
    if (!payload) return { matrix: null, error: null };
    try {
      return { matrix: qrMatrix(payload), error: null };
    } catch (e) {
      return { matrix: null, error: e instanceof Error ? e.message : 'Could not make this QR code.' };
    }
  }, [payload]);

  const share = async () => {
    if (!matrix) return;
    try {
      const label = fields.ssid || fields.name || fields.url || 'QR code';
      await shareQrPng(saveQrPng(matrix, `QR ${label}`.slice(0, 60)));
    } catch (e) {
      Alert.alert('Could not share', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  const set = (key: keyof QrFields, value: string) => setFields((f) => ({ ...f, [key]: value }));

  return (
    <KeyboardAvoid className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="h-16 flex-row items-center justify-between px-5">
        <Pressable
          onPress={() => goBackOr(router, '/(tabs)')}
          accessibilityLabel="Back"
          className="h-12 w-12 items-center justify-center overflow-hidden rounded-full active:opacity-70"
        >
            <GlassBackground radius={24} />
          <Icon name="arrow-back" size={22} className="text-on-surface" />
        </Pressable>
        <Text className="font-inter-semibold text-[17px] text-on-surface">Create QR code</Text>
        <View className="w-12" />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Preview: always black on white so every scanner can read it. */}
        <View className="mx-5 mb-5 mt-2 items-center rounded-[32px] bg-surface-container p-5">
          <View className="h-56 w-56 items-center justify-center rounded-3xl bg-white p-4">
            {matrix ? (
              <Svg width="100%" height="100%" viewBox={`0 0 ${matrix.length} ${matrix.length}`}>
                <Path d={qrSvgPath(matrix)} fill="#000000" />
              </Svg>
            ) : (
              <View className="items-center">
                <Icon name="qr-code-2" size={56} className="text-[#c4c7cf]" />
                <Text className="mt-2 text-center font-inter text-[13px] text-[#8a8f99]">
                  {error ?? 'Fill in the details to see your QR code'}
                </Text>
              </View>
            )}
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2 px-5 pb-4"
          style={{ flexGrow: 0 }}
        >
          {KINDS.map((k) => {
            const active = k.key === kind;
            return (
              <Pressable
                key={k.key}
                onPress={() => setKind(k.key)}
                className={`h-10 flex-row items-center gap-1.5 rounded-full px-4 ${
                  active ? 'bg-on-surface' : 'bg-surface-container'
                }`}
              >
                <Icon name={k.icon} size={17} className={active ? 'text-surface' : 'text-on-surface'} />
                <Text
                  className={`font-inter-semibold text-[14px] ${active ? 'text-surface' : 'text-on-surface'}`}
                >
                  {k.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View className="px-5">
          {FIELDS[kind].map((f) => (
            <View key={`${kind}-${f.key}`} className="mb-2.5 rounded-2xl bg-surface-container px-4 pb-2 pt-2.5">
              <Text className="font-inter text-[12px] text-on-surface-variant">{f.label}</Text>
              <TextInput
                value={(fields[f.key] as string | undefined) ?? ''}
                onChangeText={(t) => set(f.key, t)}
                keyboardType={f.keyboard}
                autoCapitalize={f.keyboard || f.secure ? 'none' : 'sentences'}
                autoCorrect={!f.keyboard && !f.secure}
                multiline={f.multiline}
                placeholderTextColor={`${colors['on-surface-variant']}66`}
                className={`py-0.5 font-inter text-[16px] text-on-surface ${f.multiline ? 'min-h-[72px]' : 'min-h-[32px]'}`}
                textAlignVertical={f.multiline ? 'top' : 'center'}
              />
            </View>
          ))}

          {kind === 'wifi' ? (
            <View className="mt-1 flex-row rounded-full bg-surface-container p-1">
              {(
                [
                  ['WPA', 'WPA/WPA2'],
                  ['WEP', 'WEP'],
                  ['nopass', 'No password'],
                ] as const
              ).map(([value, label]) => {
                const active = (fields.security ?? 'WPA') === value;
                return (
                  <Pressable
                    key={value}
                    onPress={() => setFields((f) => ({ ...f, security: value }))}
                    className={`h-9 flex-1 items-center justify-center rounded-full ${
                      active ? 'bg-surface-container-lowest' : ''
                    }`}
                  >
                    <Text
                      className={`text-[13px] ${
                        active ? 'font-inter-semibold text-on-surface' : 'font-inter text-on-surface-variant'
                      }`}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View className="overflow-hidden rounded-t-[28px] px-5 pt-4" style={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}>

        <GlassBackground radius={28} topOnly />
        <Pressable
          onPress={() => void share()}
          disabled={!matrix}
          className={`h-14 flex-row items-center justify-center gap-2 rounded-full bg-on-surface active:opacity-85 ${
            matrix ? '' : 'opacity-40'
          }`}
        >
          <Icon name="ios-share" size={20} className="text-surface" />
          <Text className="font-inter-semibold text-[17px] text-surface">Share QR code</Text>
        </Pressable>
      </View>
    </KeyboardAvoid>
  );
}
