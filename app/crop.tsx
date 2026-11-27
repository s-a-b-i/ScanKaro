import { useRouter } from 'expo-router';
import { ComponentProps, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../components/Icon';
import { GlassBackground } from '../components/Glass';
import { CropFrameEditor, CropFrameEditorRef } from '../components/scan/CropFrameEditor';
import { ScanningOverlay } from '../components/scan/ScanningOverlay';
import { useScan } from '../context/ScanProvider';
import { cropDocumentFromUri } from '../utils/documentScan';
import { rotateCorners, rotateJpeg } from '../utils/imageFiles';
import { goBackOr } from '../utils/navigation';

/** Lets the "Processing" overlay paint before heavy JS work blocks the thread. */
const nextFrame = () => new Promise((resolve) => setTimeout(resolve, 60));

function ToolButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: ComponentProps<typeof Icon>['name'];
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`min-w-[64px] items-center gap-1 py-1 active:opacity-60 ${disabled ? 'opacity-35' : ''}`}
    >
      <Icon name={icon} size={24} className="text-white" />
      <Text className="font-inter-medium text-[11px] text-white/80">{label}</Text>
    </Pressable>
  );
}

export default function CropScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentPageUri, currentPageCorners, pageCount, activeIndex, updatePage } = useScan();

  const cropRef = useRef<CropFrameEditorRef>(null);
  const [busy, setBusy] = useState<null | 'crop' | 'rotate'>(null);
  // "auto" = frame on the detected page, "all" = frame on the whole image.
  const [mode, setMode] = useState<'auto' | 'all'>(currentPageCorners ? 'auto' : 'all');

  useEffect(() => {
    setMode(currentPageCorners ? 'auto' : 'all');
  }, [currentPageUri, currentPageCorners]);

  if (!currentPageUri) {
    return (
      <View className="flex-1 items-center justify-center bg-[#0e0f12] px-8">
        <Text className="mb-4 text-center font-inter text-body-lg text-white/70">
          No page selected. Capture a scan first.
        </Text>
        <Pressable onPress={() => router.replace('/scan')} className="rounded-full bg-primary px-6 py-3">
          <Text className="font-inter-semibold text-body-lg text-on-primary">Go to Scanner</Text>
        </Pressable>
      </View>
    );
  }

  const toggleFrame = () => {
    if (mode === 'auto') {
      cropRef.current?.setFrame(null);
      setMode('all');
    } else if (currentPageCorners) {
      cropRef.current?.setFrame(currentPageCorners);
      setMode('auto');
    }
  };

  const rotate = async (degrees: 90 | -90) => {
    if (busy) return;
    setBusy('rotate');
    try {
      // Keep the user's current frame through the rotation.
      const frame = cropRef.current?.isFullPage() ? null : cropRef.current?.getImageCorners();
      const rotated = await rotateJpeg(currentPageUri, degrees);
      // The source was rotated, so its width is the new height and vice versa.
      const corners = frame ? rotateCorners(frame, rotated.height, rotated.width, degrees) : null;
      updatePage(activeIndex, rotated.uri, corners);
    } catch (error) {
      Alert.alert('Rotate failed', error instanceof Error ? error.message : 'Could not rotate this page.');
    } finally {
      setBusy(null);
    }
  };

  const handleNext = async () => {
    if (busy) return;
    setBusy('crop');
    try {
      await nextFrame();
      // Frame on the whole image: nothing to crop (scanner pages are already straightened).
      const corners = cropRef.current?.isFullPage() ? null : cropRef.current?.getImageCorners();
      if (corners) {
        const croppedUri = await cropDocumentFromUri(currentPageUri, corners);
        updatePage(activeIndex, croppedUri);
      }
      router.push('/enhance');
    } catch (error) {
      Alert.alert('Crop failed', error instanceof Error ? error.message : 'Could not straighten this page.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <View className="flex-1 bg-[#0e0f12]" style={{ paddingTop: insets.top }}>
      <ScanningOverlay visible={busy === 'crop'} imageUri={currentPageUri} message="Straightening page…" />

      <View className="h-14 flex-row items-center justify-between px-2">
        <Pressable accessibilityLabel="Back"
          onPress={() => goBackOr(router, '/scan')}
          hitSlop={8}
          className="h-11 w-11 items-center justify-center rounded-full active:bg-white/10"
        >
          <Icon name="arrow-back" size={24} className="text-white" />
        </Pressable>
        <Text className="font-inter-semibold text-body-lg text-white">Crop</Text>
        <View className="h-11 min-w-11 items-center justify-center px-2">
          {pageCount > 1 ? (
            <Text className="font-inter-medium text-label-md text-white/60">
              {activeIndex + 1}/{pageCount}
            </Text>
          ) : null}
        </View>
      </View>

      <View className="flex-1 px-5 py-4">
        <CropFrameEditor ref={cropRef} imageUri={currentPageUri} initialImageCorners={currentPageCorners} />
      </View>

      <Text className="pb-3 text-center font-inter text-label-md text-white/50">
        Drag the corners or sides to fit the page
      </Text>

      <View
        className="flex-row items-center justify-between overflow-hidden rounded-t-[28px] px-4 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 12) + 4 }}
      >
        <GlassBackground radius={28} variant="media" topOnly />
        <ToolButton icon="rotate-left" label="Left" onPress={() => void rotate(-90)} disabled={!!busy} />
        <ToolButton icon="rotate-right" label="Right" onPress={() => void rotate(90)} disabled={!!busy} />
        <ToolButton
          icon={mode === 'auto' ? 'fullscreen' : 'crop-free'}
          label={mode === 'auto' ? 'All' : 'Auto'}
          onPress={toggleFrame}
          disabled={!!busy || (mode === 'all' && !currentPageCorners)}
        />
        <Pressable
          onPress={() => void handleNext()}
          disabled={!!busy}
          className="h-12 flex-row items-center gap-1.5 rounded-full bg-[#ffffff] pl-5 pr-4 active:opacity-80"
        >
          <Text className="font-inter-semibold text-body-lg text-[#111111]">Next</Text>
          <Icon name="arrow-forward" size={20} className="text-[#111111]" />
        </Pressable>
      </View>
    </View>
  );
}
