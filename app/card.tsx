/**
 * Business card: reads the scanned card on the device and fills in contact fields the
 * user can correct, then saves them to Contacts (.vcf) or keeps the card as a scan.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../components/Icon';
import { GlassBackground } from '../components/Glass';
import { KeyboardAvoid } from '../components/KeyboardAvoid';
import { useTheme } from '../constants/theme';
import { useScan } from '../context/ScanProvider';
import { CardContact, openNewContactForm, parseCardText, shareVCard } from '../utils/businessCard';
import { goBackOr } from '../utils/navigation';
import { OCR_LANGUAGES, recognizePages } from '../utils/ocr';

const EMPTY: CardContact = { name: '', jobTitle: '', company: '', phones: [], email: '', website: '', address: '' };

type FieldKey = 'name' | 'jobTitle' | 'company' | 'phone1' | 'phone2' | 'email' | 'website' | 'address';

const FIELDS: { key: FieldKey; label: string; keyboard?: 'phone-pad' | 'email-address' | 'url'; multiline?: boolean }[] = [
  { key: 'name', label: 'Name' },
  { key: 'jobTitle', label: 'Job title' },
  { key: 'company', label: 'Company' },
  { key: 'phone1', label: 'Phone', keyboard: 'phone-pad' },
  { key: 'phone2', label: 'Other phone', keyboard: 'phone-pad' },
  { key: 'email', label: 'Email', keyboard: 'email-address' },
  { key: 'website', label: 'Website', keyboard: 'url' },
  { key: 'address', label: 'Address', multiline: true },
];

export default function BusinessCardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { uri } = useLocalSearchParams<{ uri: string }>();
  const { addPage, reset } = useScan();

  const [reading, setReading] = useState(true);
  const [contact, setContact] = useState<CardContact>(EMPTY);

  useEffect(() => {
    if (!uri) return;
    let cancelled = false;
    recognizePages([uri], OCR_LANGUAGES[0])
      .then((text) => !cancelled && setContact(parseCardText(text)))
      .catch(() => {
        if (!cancelled) Alert.alert('Could not read the card', 'Fill in the details yourself, or scan it again.');
      })
      .finally(() => !cancelled && setReading(false));
    return () => {
      cancelled = true;
    };
  }, [uri]);

  const value = (key: FieldKey) =>
    key === 'phone1' ? contact.phones[0] ?? '' : key === 'phone2' ? contact.phones[1] ?? '' : contact[key];

  const setValue = (key: FieldKey, text: string) =>
    setContact((c) => {
      if (key === 'phone1' || key === 'phone2') {
        const phones = [c.phones[0] ?? '', c.phones[1] ?? ''];
        phones[key === 'phone1' ? 0 : 1] = text;
        return { ...c, phones };
      }
      return { ...c, [key]: text };
    });

  const hasDetails = !!(contact.name.trim() || contact.company.trim() || contact.phones.some((p) => p.trim()) || contact.email.trim());

  const saveContact = async () => {
    if (!hasDetails) {
      Alert.alert('Add details', 'Enter at least a name, company, phone or email.');
      return;
    }
    try {
      // Android: the Contacts app's own form, filled in. Elsewhere: share a .vcf.
      if (!(await openNewContactForm(contact))) await shareVCard(contact);
    } catch (error) {
      Alert.alert('Could not save', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  /** Keeps the card image as a normal scanned document as well. */
  const keepScan = () => {
    if (!uri) return;
    reset();
    addPage(uri);
    router.replace({ pathname: '/enhance', params: { filter: 'noShadow' } });
  };

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
        <Text className="font-inter-semibold text-[17px] text-on-surface">Business card</Text>
        <View className="w-12" />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {uri ? (
          <View className="mb-5 h-48 overflow-hidden rounded-3xl bg-surface-container">
            <Image source={{ uri }} className="h-full w-full" resizeMode="contain" />
          </View>
        ) : null}

        {reading ? (
          <View className="items-center py-10">
            <ActivityIndicator color={colors['on-surface']} />
            <Text className="mt-3 font-inter text-[14px] text-on-surface-variant">Reading the card…</Text>
          </View>
        ) : (
          <>
            <Text className="mb-3 font-inter text-[13px] text-on-surface-variant">
              Check the details. Tap any field to correct it.
            </Text>
            {FIELDS.map((f) => (
              <View key={f.key} className="mb-2.5 rounded-2xl bg-surface-container px-4 pb-2 pt-2.5">
                <Text className="font-inter text-[12px] text-on-surface-variant">{f.label}</Text>
                <TextInput
                  value={value(f.key)}
                  onChangeText={(t) => setValue(f.key, t)}
                  keyboardType={f.keyboard}
                  autoCapitalize={f.keyboard ? 'none' : 'words'}
                  multiline={f.multiline}
                  placeholder="—"
                  placeholderTextColor={`${colors['on-surface-variant']}66`}
                  className="min-h-[32px] py-0.5 font-inter text-[16px] text-on-surface"
                />
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <View className="gap-3 overflow-hidden rounded-t-[28px] px-5 pt-4" style={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}>

        <GlassBackground radius={28} topOnly />
        <Pressable
          onPress={() => void saveContact()}
          disabled={reading}
          className={`h-14 flex-row items-center justify-center gap-2 rounded-full bg-on-surface active:opacity-85 ${
            reading ? 'opacity-40' : ''
          }`}
        >
          <Icon name="person-add" size={20} className="text-surface" />
          <Text className="font-inter-semibold text-[17px] text-surface">Save to contacts</Text>
        </Pressable>
        <Pressable
          onPress={keepScan}
          className="h-14 flex-row items-center justify-center gap-2 rounded-full border border-outline-variant active:bg-surface-container"
        >
          <Icon name="description" size={20} className="text-on-surface" />
          <Text className="font-inter-semibold text-[16px] text-on-surface">Keep card as a scan</Text>
        </Pressable>
      </View>
    </KeyboardAvoid>
  );
}
