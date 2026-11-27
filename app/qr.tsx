/**
 * QR and barcode scanner: live camera or a photo from the gallery. Recognises links,
 * Wi-Fi, phone, email, SMS and contact cards and offers the matching action.
 */
import * as Clipboard from 'expo-clipboard';
import { BarcodeScanningResult, BarcodeType, CameraView, scanFromURLAsync, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../components/Icon';
import { GlassBackground } from '../components/Glass';
import { useToast } from '../components/Toast';
import { goBackOr } from '../utils/navigation';
import { addQrHistory, formatName } from '../utils/qr';
import { parseCode, Parsed } from '../utils/qrParse';

const BARCODE_TYPES: BarcodeType[] = [
  'qr',
  'ean13',
  'ean8',
  'upc_a',
  'upc_e',
  'code128',
  'code39',
  'pdf417',
  'datamatrix',
  'aztec',
];

export default function QrScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [result, setResult] = useState<Parsed | null>(null);
  // Continuous: keep scanning and collect codes into history without stopping.
  const [continuous, setContinuous] = useState(false);
  const [batch, setBatch] = useState<{ count: number; last: string } | null>(null);
  // Ignore the burst of repeated callbacks for the same code.
  const locked = useRef(false);
  const seen = useRef(new Set<string>());

  const onScanned = useCallback(
    (scan: BarcodeScanningResult) => {
      if (locked.current) return;
      // Android puts a friendly summary in `data` (e.g. Wi-Fi name + password); `raw` has the real content.
      const content = scan.raw || scan.data;
      if (continuous) {
        if (seen.current.has(content)) return;
        seen.current.add(content);
        addQrHistory(content, scan.type);
        setBatch({ count: seen.current.size, last: parseCode(content, formatName(scan.type)).fields[0]?.value ?? content });
        return;
      }
      locked.current = true;
      addQrHistory(content, scan.type);
      setResult(parseCode(content, formatName(scan.type)));
    },
    [continuous],
  );

  const toggleContinuous = () => {
    seen.current = new Set();
    setBatch(null);
    setContinuous((c) => !c);
  };

  const close = () => {
    setResult(null);
    // Small delay so the camera does not re-read the same code instantly.
    setTimeout(() => (locked.current = false), 600);
  };

  const scanPhoto = async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (picked.canceled || !picked.assets[0]) return;
    try {
      const [found] = await scanFromURLAsync(picked.assets[0].uri, BARCODE_TYPES);
      if (!found) {
        Alert.alert('No code found', 'Try a sharper photo with the whole code visible.');
        return;
      }
      locked.current = true;
      addQrHistory(found.raw || found.data, found.type);
      setResult(parseCode(found.raw || found.data, formatName(found.type)));
    } catch {
      Alert.alert('No code found', 'Try a sharper photo with the whole code visible.');
    }
  };

  const copy = async () => {
    if (!result) return;
    await Clipboard.setStringAsync(result.copy);
    toast.show(result.kind === 'wifi' ? 'Password copied' : 'Copied');
  };

  if (!permission) return <View className="flex-1 bg-black" />;

  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-8" style={{ paddingTop: insets.top }}>
        <Icon name="qr-code-scanner" size={56} className="text-on-surface" />
        <Text className="mt-5 text-center font-inter-semibold text-[22px] text-on-surface">Camera access needed</Text>
        <Text className="mt-2 text-center font-inter text-[15px] leading-[21px] text-on-surface-variant">
          Allow the camera to read QR codes and barcodes. You can also pick a photo instead.
        </Text>
        <Pressable
          onPress={() => void requestPermission()}
          className="mt-7 h-14 w-full items-center justify-center rounded-full bg-on-surface active:opacity-85"
        >
          <Text className="font-inter-semibold text-[17px] text-surface">Allow camera</Text>
        </Pressable>
        <Pressable
          onPress={() => void scanPhoto()}
          className="mt-3 h-14 w-full items-center justify-center rounded-full border border-outline-variant"
        >
          <Text className="font-inter-semibold text-[17px] text-on-surface">Scan from photo</Text>
        </Pressable>
        <Pressable onPress={() => goBackOr(router, '/(tabs)')} className="mt-4 p-3">
          <Text className="font-inter text-[15px] text-on-surface-variant">Not now</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
        onBarcodeScanned={result ? undefined : onScanned}
      />

      {/* Viewfinder */}
      <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
        <View className="h-64 w-64 rounded-[36px] border-[3px] border-white/90" />
        <Text className="mt-6 font-inter-semibold text-[15px] text-white">Point at a QR code or barcode</Text>
      </View>

      {/* Top bar */}
      <View className="absolute left-0 right-0 flex-row justify-between px-5" style={{ top: insets.top + 12 }}>
        <Pressable
          onPress={() => goBackOr(router, '/(tabs)')}
          accessibilityLabel="Close"
          className="h-12 w-12 items-center justify-center overflow-hidden rounded-full active:opacity-70"
        >
            <GlassBackground radius={24} variant="media" />
          <Icon name="close" size={22} className="text-white" />
        </Pressable>
        <View className="flex-row gap-3">
          <Pressable
            onPress={toggleContinuous}
            accessibilityLabel={continuous ? 'Turn off continuous scanning' : 'Turn on continuous scanning'}
            className={`h-12 flex-row items-center gap-1.5 overflow-hidden rounded-full px-4 ${continuous ? 'bg-white' : ''} active:opacity-70`}
          >
            {continuous ? null : <GlassBackground radius={24} variant="media" />}
            <Icon name="repeat" size={20} className={continuous ? 'text-black' : 'text-white'} />
            <Text className={`font-inter-semibold text-[14px] ${continuous ? 'text-black' : 'text-white'}`}>
              Continuous
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setTorch((t) => !t)}
            accessibilityLabel={torch ? 'Turn torch off' : 'Turn torch on'}
            className={`h-12 w-12 items-center justify-center overflow-hidden rounded-full ${torch ? 'bg-white' : ''} active:opacity-70`}
          >
            {torch ? null : <GlassBackground radius={24} variant="media" />}
            <Icon
              name={torch ? 'flashlight-on' : 'flashlight-off'}
              size={22}
              className={torch ? 'text-black' : 'text-white'}
            />
          </Pressable>
        </View>
      </View>

      {continuous && batch ? (
        <View className="absolute left-5 right-5 items-center" style={{ top: insets.top + 80 }}>
          <View className="max-w-full flex-row items-center gap-2 rounded-full bg-white px-4 py-2.5">
            <Icon name="check-circle" size={18} className="text-[#111111]" />
            <Text className="font-inter-semibold text-[14px] text-black" numberOfLines={1}>
              {batch.count} saved · {batch.last}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Bottom: scan from photo */}
      <View
        className="absolute left-0 right-0 flex-row justify-center gap-3 px-5"
        style={{ bottom: insets.bottom + 32 }}
      >
        {[
          { icon: 'history' as const, label: 'History', onPress: () => router.push('/qr-history') },
          { icon: 'photo-library' as const, label: 'Photo', onPress: () => void scanPhoto() },
          { icon: 'qr-code-2' as const, label: 'Create', onPress: () => router.push('/qr-create') },
        ].map((b) => (
          <Pressable
            key={b.label}
            onPress={b.onPress}
            className="h-12 flex-row items-center gap-2 overflow-hidden rounded-full px-4 active:opacity-70"
          >
              <GlassBackground radius={24} variant="media" />
            <Icon name={b.icon} size={20} className="text-white" />
            <Text className="font-inter-semibold text-[15px] text-white">{b.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Result */}
      <Modal visible={!!result} transparent animationType="slide" onRequestClose={close}>
        <View className="flex-1 justify-end bg-black/40">
          <Pressable className="flex-1" onPress={close} />
          <View
            className="max-h-[70%] overflow-hidden rounded-t-[32px] px-5 pt-3"
            style={{ paddingBottom: insets.bottom + 20 }}
          >
              <GlassBackground radius={32} variant="sheet" topOnly />
            <View className="mb-4 h-1 w-10 self-center rounded-full bg-outline-variant" />
            <View className="mb-4 flex-row items-center gap-3">
              <View className="h-11 w-11 items-center justify-center rounded-full bg-surface-container">
                <Icon name={result?.icon ?? 'notes'} size={22} className="text-on-surface" />
              </View>
              <Text className="font-inter-semibold text-[22px] tracking-[-0.4px] text-on-surface">{result?.title}</Text>
            </View>

            <ScrollView className="mb-4" showsVerticalScrollIndicator={false}>
              {result?.fields.map((f) => (
                <View key={f.label} className="mb-2 rounded-2xl bg-surface-container px-4 py-3">
                  <Text className="font-inter text-[12px] text-on-surface-variant">{f.label}</Text>
                  <Text selectable className="mt-0.5 font-inter text-[16px] leading-[22px] text-on-surface">
                    {f.value}
                  </Text>
                </View>
              ))}
            </ScrollView>

            {result?.action ? (
              <Pressable
                onPress={result.action.run}
                className="mb-3 h-14 flex-row items-center justify-center gap-2 rounded-full bg-on-surface active:opacity-85"
              >
                <Icon name={result.action.icon} size={20} className="text-surface" />
                <Text className="font-inter-semibold text-[17px] text-surface">{result.action.label}</Text>
              </Pressable>
            ) : null}
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => void copy()}
                className="h-14 flex-1 flex-row items-center justify-center gap-2 rounded-full border border-outline-variant active:bg-surface-container"
              >
                <Icon name="content-copy" size={18} className="text-on-surface" />
                <Text className="font-inter-semibold text-[16px] text-on-surface">
                  {result?.kind === 'wifi' ? 'Copy password' : 'Copy'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => result && void Share.share({ message: result.copy })}
                className="h-14 flex-1 flex-row items-center justify-center gap-2 rounded-full border border-outline-variant active:bg-surface-container"
              >
                <Icon name="share" size={18} className="text-on-surface" />
                <Text className="font-inter-semibold text-[16px] text-on-surface">Share</Text>
              </Pressable>
            </View>
            <Pressable onPress={close} className="mt-3 h-12 items-center justify-center">
              <Text className="font-inter-semibold text-[15px] text-on-surface-variant">Scan another</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
