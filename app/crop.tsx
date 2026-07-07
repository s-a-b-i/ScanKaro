import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, LayoutChangeEvent, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../components/Icon';
import { CropFrameEditor, CropFrameEditorRef } from '../components/scan/CropFrameEditor';
import { FilteredScanImage } from '../components/scan/FilteredScanImage';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { useScan } from '../context/ScanProvider';
import { cropDocumentFromUri } from '../utils/documentScan';
import { pickScanImageWithPrompt } from '../utils/scanPicker';
import { SCAN_FILTERS } from '../utils/scanFilters';
import { goBackOr } from '../utils/navigation';

export default function CropScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    currentPageUri,
    pageCount,
    activeIndex,
    activeFilter,
    brightness,
    addPage,
    updatePage,
    setActiveIndex,
    setActiveFilter,
    setBrightness,
  } = useScan();

  const cropRef = useRef<CropFrameEditorRef>(null);
  const [cropping, setCropping] = useState(false);

  if (!currentPageUri) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-8">
        <Text className="mb-4 text-center font-inter text-body-lg text-on-surface-variant">
          No page selected. Capture a scan first.
        </Text>
        <Pressable onPress={() => router.replace('/scan')} className="rounded-xl bg-primary px-6 py-3">
          <Text className="font-inter-semibold text-title-md text-on-primary">Go to Scanner</Text>
        </Pressable>
      </View>
    );
  }

  const handleAddPage = async () => {
    const uri = await pickScanImageWithPrompt();
    if (uri) {
      addPage(uri);
      setActiveIndex(pageCount);
    }
  };

  const trackWidthRef = useRef(280);

  const setBrightnessFromX = (locationX: number) => {
    const pct = Math.min(100, Math.max(0, Math.round((locationX / trackWidthRef.current) * 100)));
    setBrightness(pct);
  };

  const onTrackLayout = (event: LayoutChangeEvent) => {
    trackWidthRef.current = event.nativeEvent.layout.width;
  };

  const handleDone = async () => {
    if (!currentPageUri) return;

    setCropping(true);
    try {
      const corners = cropRef.current?.getImageCorners();
      if (corners) {
        const croppedUri = await cropDocumentFromUri(currentPageUri, corners);
        updatePage(activeIndex, croppedUri);
      }
      router.push('/export');
    } catch (error) {
      Alert.alert(
        'Crop failed',
        error instanceof Error ? error.message : 'Could not apply perspective correction.',
      );
    } finally {
      setCropping(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      {cropping ? <LoadingOverlay visible message="Applying scan..." /> : null}
      <View
        className="flex-row items-center justify-between border-b border-outline-variant bg-surface px-4"
        style={{ paddingTop: insets.top, height: insets.top + 56 }}
      >
        <Pressable onPress={() => goBackOr(router, '/(tabs)')} className="min-w-[72px] flex-row items-center py-2 active:opacity-70">
          <Icon name="close" size={20} className="text-on-surface-variant" />
          <Text className="ml-1 font-inter text-label-md text-on-surface-variant">Cancel</Text>
        </Pressable>

        <Text className="font-inter-semibold text-headline-lg-mobile text-primary">
          Page {activeIndex + 1} of {pageCount}
        </Text>

        <Pressable
          onPress={handleDone}
          disabled={cropping}
          className="min-w-[72px] flex-row items-center justify-end rounded-full bg-primary-container px-3 py-1.5 active:opacity-70"
        >
          <Icon name="check" size={18} className="text-on-primary-container" />
          <Text className="ml-1 font-inter-semibold text-label-md text-on-primary-container">Done</Text>
        </Pressable>
      </View>

      <View className="relative flex-1 bg-slate-300">
        <CropFrameEditor
          ref={cropRef}
          imageUri={currentPageUri}
          filter={activeFilter}
          brightness={brightness}
          bottomSafeInset={96}
        />

        <View className="absolute bottom-5 left-0 right-0 items-center px-4">
          <View className="flex-row items-center gap-1 rounded-full border border-white/80 bg-white/95 px-3 py-2.5 shadow-lg">
            <Pressable className="items-center px-3 opacity-50">
              <Icon name="rotate-right" size={22} className="text-secondary" />
              <Text className="mt-0.5 font-inter text-[10px] text-secondary">Rotate</Text>
            </Pressable>
            <View className="mx-1 h-7 w-px bg-slate-200" />
            <Pressable
              onPress={() => setActiveFilter('Document')}
              className="items-center px-3 active:opacity-80"
            >
              <Icon name="auto-fix-high" size={22} className="text-primary" />
              <Text className="mt-0.5 font-inter text-[10px] text-primary">Enhance</Text>
            </Pressable>
            <View className="mx-1 h-7 w-px bg-slate-200" />
            <Pressable
              onPress={handleAddPage}
              className="flex-row items-center gap-1.5 rounded-full bg-primary px-4 py-2 active:opacity-90"
            >
              <Icon name="add-circle" size={18} className="text-on-primary" />
              <Text className="font-inter-semibold text-label-md text-on-primary">Add Page</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <View className="border-t border-outline-variant bg-surface" style={{ paddingBottom: insets.bottom }}>
        <View className="flex-row items-center gap-4 bg-surface-container-low/60 px-6 py-3">
          <Icon name="light-mode" size={20} className="text-secondary" />
          <Pressable
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200"
            onLayout={onTrackLayout}
            onPress={(e) => setBrightnessFromX(e.nativeEvent.locationX)}
          >
            <View className="h-full rounded-full bg-primary" style={{ width: `${brightness}%` }} />
          </Pressable>
          <Icon name="brightness-high" size={20} className="text-secondary" />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-4 px-4 py-5">
          {SCAN_FILTERS.map((filter) => (
            <Pressable key={filter} onPress={() => setActiveFilter(filter)} className="items-center gap-1.5">
              <View
                className={`h-[72px] w-[56px] overflow-hidden rounded-lg border-2 bg-white ${
                  activeFilter === filter ? 'border-primary' : 'border-slate-200'
                }`}
              >
                <FilteredScanImage
                  uri={currentPageUri}
                  filter={filter}
                  brightness={brightness}
                  resizeMode="cover"
                />
              </View>
              <Text
                className={`font-inter text-label-md ${
                  activeFilter === filter ? 'font-inter-semibold text-primary' : 'text-secondary'
                }`}
              >
                {filter}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}
