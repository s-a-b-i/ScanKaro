/**
 * QR and barcode scan history (kept on the device): open, copy or delete scans, and
 * export everything as a CSV file for Excel or Google Sheets.
 */
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../components/Icon';
import { GlassBackground } from '../components/Glass';
import { goBackOr } from '../utils/navigation';
import { formatName, loadQrHistory, QrHistoryItem, removeQrHistory, shareQrHistoryCsv } from '../utils/qr';
import { parseCode } from '../utils/qrParse';

const when = (ms: number) =>
  new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function QrHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<QrHistoryItem[]>([]);

  useFocusEffect(useCallback(() => setItems(loadQrHistory()), []));

  const open = (item: QrHistoryItem) => {
    const parsed = parseCode(item.content, formatName(item.format));
    const buttons: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [];
    if (parsed.action) buttons.push({ text: parsed.action.label, onPress: parsed.action.run });
    buttons.push({
      text: 'Copy',
      onPress: () => void Clipboard.setStringAsync(parsed.copy),
    });
    buttons.push({ text: 'Close', style: 'cancel' });
    Alert.alert(parsed.title, parsed.fields.map((f) => `${f.label}: ${f.value}`).join('\n'), buttons);
  };

  const remove = (item: QrHistoryItem) => setItems(removeQrHistory(item.id));

  const clearAll = () =>
    Alert.alert('Clear history?', 'All saved scans will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => setItems(removeQrHistory()) },
    ]);

  const exportCsv = async () => {
    try {
      await shareQrHistoryCsv(items);
    } catch (e) {
      Alert.alert('Could not export', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="h-16 flex-row items-center justify-between px-5">
        <Pressable
          onPress={() => goBackOr(router, '/qr')}
          accessibilityLabel="Back"
          className="h-12 w-12 items-center justify-center overflow-hidden rounded-full active:opacity-70"
        >
            <GlassBackground radius={24} />
          <Icon name="arrow-back" size={22} className="text-on-surface" />
        </Pressable>
        {items.length > 0 ? (
          <Pressable onPress={clearAll} className="h-10 justify-center rounded-full px-4 active:bg-surface-container">
            <Text className="font-inter-semibold text-[15px] text-error">Clear</Text>
          </Pressable>
        ) : null}
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, flexGrow: 1 }}
        ListHeaderComponent={
          <View className="mb-6 mt-4">
            <Text className="font-inter-semibold text-[34px] leading-[38px] tracking-[-1.2px] text-on-surface">
              QR history
            </Text>
            <Text className="mt-2 font-inter text-[15px] leading-[21px] text-on-surface-variant">
              QR codes and barcodes you scanned, saved on this phone.
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center pb-24">
            <View className="h-16 w-16 items-center justify-center rounded-full bg-surface-container">
              <Icon name="history" size={30} className="text-on-surface-variant" />
            </View>
            <Text className="mt-4 font-inter-semibold text-[18px] text-on-surface">No codes scanned yet</Text>
            <Text className="mt-1 text-center font-inter text-[14px] text-on-surface-variant">
              QR codes and barcodes you scan appear here.
            </Text>
            <Pressable
              onPress={() => router.push('/qr')}
              accessibilityRole="button"
              className="mt-5 h-12 flex-row items-center gap-2 rounded-full bg-on-surface px-6 active:opacity-85"
            >
              <Icon name="qr-code-scanner" size={20} className="text-surface" />
              <Text className="font-inter-semibold text-[16px] text-surface">Scan a code</Text>
            </Pressable>
          </View>
        }
        ItemSeparatorComponent={() => <View className="h-2.5" />}
        renderItem={({ item }) => {
          const parsed = parseCode(item.content, formatName(item.format));
          return (
            <Pressable
              onPress={() => open(item)}
              className="flex-row items-center gap-3 rounded-3xl bg-surface-container-lowest p-3 active:opacity-80"
            >
              <View className="h-11 w-11 items-center justify-center rounded-full bg-surface-container">
                <Icon name={parsed.icon} size={20} className="text-on-surface" />
              </View>
              <View className="min-w-0 flex-1">
                <Text className="font-inter-semibold text-[15px] text-on-surface" numberOfLines={1}>
                  {parsed.fields[0]?.value || item.content}
                </Text>
                <Text className="mt-0.5 font-inter text-[12px] text-on-surface-variant">
                  {parsed.title} · {when(item.scannedAt)}
                </Text>
              </View>
              <Pressable
                onPress={() => remove(item)}
                hitSlop={6}
                accessibilityLabel="Delete"
                className="h-11 w-11 items-center justify-center rounded-full active:bg-surface-container"
              >
                <Icon name="close" size={18} className="text-on-surface-variant" />
              </Pressable>
            </Pressable>
          );
        }}
      />

      {items.length > 0 ? (
        <View className="overflow-hidden rounded-t-[28px] px-5 pt-4" style={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}>
          <GlassBackground radius={28} topOnly />
          <Pressable
            onPress={() => void exportCsv()}
            className="h-14 flex-row items-center justify-center gap-2 rounded-full bg-on-surface active:opacity-85"
          >
            <Icon name="table-view" size={20} className="text-surface" />
            <Text className="font-inter-semibold text-[17px] text-surface">Export as CSV</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
