import { useLocalSearchParams, useRouter } from 'expo-router';
import { ComponentProps, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../components/Icon';
import { GlassBackground } from '../components/Glass';
import { LightSlider } from '../components/scan/LightSlider';
import { ScanningOverlay } from '../components/scan/ScanningOverlay';
import { useScan } from '../context/ScanProvider';
import { DEFAULT_ENHANCE_FILTER, ENHANCE_FILTERS, EnhanceFilter } from '../utils/enhance';
import { addPageWithPrompt } from '../utils/galleryImport';
import { rotateJpeg } from '../utils/imageFiles';
import { applyFilterToFile, createFilterPreview, LightAdjust, NO_ADJUST } from '../utils/skiaImage';
import { goBackOr } from '../utils/navigation';

/** Size of the on-screen preview. */
const PREVIEW_MAX_SIDE = 1200;
const THUMB_MAX_SIDE = 160;
/** Size of the saved page: sharp for reading and OCR. */
const FINAL_MAX_SIDE = 2000;

/** Lets spinners/overlays paint before heavy JS work blocks the thread. */
const nextFrame = () => new Promise((resolve) => setTimeout(resolve, 60));

type PagePreview = {
  originalUri: string;
  render: (filter: EnhanceFilter, adjust?: LightAdjust) => string;
  thumbs: Record<EnhanceFilter, string>;
};

/** Builds the preview and thumbnails for one page (native rendering, cached per filter). */
async function buildPreview(pageUri: string): Promise<PagePreview> {
  const preview = await createFilterPreview(pageUri, PREVIEW_MAX_SIDE, 88);
  const thumb = await createFilterPreview(pageUri, THUMB_MAX_SIDE, 80);
  const thumbs = {} as Record<EnhanceFilter, string>;
  for (const { key } of ENHANCE_FILTERS) thumbs[key] = thumb.render(key);
  return {
    originalUri: preview.render('original'),
    render: preview.render,
    thumbs,
  };
}

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
      className={`min-w-[56px] items-center gap-1 py-1 active:opacity-60 ${disabled ? 'opacity-35' : ''}`}
    >
      <Icon name={icon} size={23} className="text-white" />
      <Text className="font-inter-medium text-[11px] text-white/80">{label}</Text>
    </Pressable>
  );
}

export default function EnhanceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { pages, activeIndex, pageCount, setActiveIndex, updatePage, addPage } = useScan();
  const pageUri = pages[activeIndex] ?? null;

  const params = useLocalSearchParams<{ filter?: string }>();
  const initialFilter = ENHANCE_FILTERS.some((f) => f.key === params.filter)
    ? (params.filter as EnhanceFilter)
    : DEFAULT_ENHANCE_FILTER;
  const [filter, setFilter] = useState<EnhanceFilter>(initialFilter);
  const [preview, setPreview] = useState<PagePreview | null>(null);
  const [shownUri, setShownUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [comparing, setComparing] = useState(false);
  const [busy, setBusy] = useState<null | 'save' | 'rotate' | 'add'>(null);
  const [adjust, setAdjust] = useState<LightAdjust>(NO_ADJUST);
  const [panel, setPanel] = useState<'filters' | 'adjust'>('filters');
  const filterRef = useRef(filter);
  filterRef.current = filter;
  const adjustRef = useRef(adjust);
  adjustRef.current = adjust;
  // Enhanced page -> the image it was made from, so going back and re-applying (or
  // rotating) always starts from the source instead of enhancing twice.
  const sourceOf = useRef(new Map<string, string>());
  const sourceFor = (uri: string) => sourceOf.current.get(uri) ?? uri;

  // Build the preview whenever the shown page changes (new page, rotation, …).
  useEffect(() => {
    if (!pageUri) return;
    let cancelled = false;
    setLoading(true);
    setPreview(null);
    void (async () => {
      try {
        await nextFrame();
        const built = await buildPreview(sourceFor(pageUri));
        if (cancelled) return;
        setPreview(built);
        setShownUri(built.render(filterRef.current, adjustRef.current));
      } catch (error) {
        if (!cancelled) {
          setShownUri(pageUri);
          Alert.alert('Preview failed', error instanceof Error ? error.message : 'Could not prepare this page.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pageUri]);

  /** Re-renders the preview for a filter + lighting combination. */
  const showPreview = async (nextFilter: EnhanceFilter, nextAdjust: LightAdjust) => {
    if (!preview) return;
    setLoading(true);
    await nextFrame();
    try {
      setShownUri(preview.render(nextFilter, nextAdjust));
    } finally {
      setLoading(false);
    }
  };

  const chooseFilter = (next: EnhanceFilter) => {
    setFilter(next);
    void showPreview(next, adjust);
  };

  const changeLight = (key: keyof LightAdjust, value: number) => {
    const next = { ...adjust, [key]: value };
    setAdjust(next);
    void showPreview(filter, next);
  };

  const resetLight = () => {
    setAdjust(NO_ADJUST);
    void showPreview(filter, NO_ADJUST);
  };

  const lightChanged = adjust.brightness !== 0 || adjust.contrast !== 0;

  const rotate = async (degrees: 90 | -90) => {
    if (!pageUri || busy) return;
    setBusy('rotate');
    try {
      const rotated = await rotateJpeg(sourceFor(pageUri), degrees);
      updatePage(activeIndex, rotated.uri);
    } catch (error) {
      Alert.alert('Rotate failed', error instanceof Error ? error.message : 'Could not rotate this page.');
    } finally {
      setBusy(null);
    }
  };

  const handleAddPage = async () => {
    if (busy) return;
    setBusy('add');
    try {
      const page = await addPageWithPrompt();
      if (!page) return;
      addPage(page.uri, page.corners);
      // Gallery photos still need their page cropped; scanner pages are ready.
      if (page.corners) router.push('/crop');
    } finally {
      setBusy(null);
    }
  };

  const handleDone = async () => {
    if (busy || pages.length === 0) return;
    setBusy('save');
    try {
      await nextFrame();
      if (filter !== 'original' || lightChanged) {
        // Apply the chosen filter and lighting to every page at full size.
        for (let i = 0; i < pages.length; i++) {
          const sourceUri = sourceFor(pages[i]);
          const enhancedUri = (await applyFilterToFile(sourceUri, filter, FINAL_MAX_SIDE, 90, adjust)).uri;
          sourceOf.current.set(enhancedUri, sourceUri);
          updatePage(i, enhancedUri);
          await nextFrame();
        }
      } else {
        // "Original" with no lighting change: put back any page enhanced on an earlier pass.
        pages.forEach((uri, i) => {
          if (sourceOf.current.has(uri)) updatePage(i, sourceFor(uri));
        });
      }
      router.push('/export');
    } catch (error) {
      Alert.alert('Enhance failed', error instanceof Error ? error.message : 'Could not process the pages.');
    } finally {
      setBusy(null);
    }
  };

  if (!pageUri) {
    return (
      <View className="flex-1 items-center justify-center bg-[#0e0f12] px-8">
        <Text className="mb-4 text-center font-inter text-body-lg text-white/70">No pages yet.</Text>
        <Pressable onPress={() => router.replace('/scan')} className="rounded-full bg-primary px-6 py-3">
          <Text className="font-inter-semibold text-body-lg text-on-primary">Go to Scanner</Text>
        </Pressable>
      </View>
    );
  }

  const displayUri = comparing && preview ? preview.originalUri : (shownUri ?? pageUri);

  return (
    <View className="flex-1 bg-[#0e0f12]" style={{ paddingTop: insets.top }}>
      <ScanningOverlay
        visible={busy === 'save'}
        imageUri={shownUri}
        message={pageCount > 1 ? `Enhancing ${pageCount} pages…` : 'Enhancing page…'}
      />

      {/* Header */}
      <View className="h-14 flex-row items-center justify-between px-2">
        <Pressable accessibilityLabel="Back"
          onPress={() => goBackOr(router, '/scan')}
          hitSlop={8}
          className="h-11 w-11 items-center justify-center rounded-full active:bg-white/10"
        >
          <Icon name="arrow-back" size={24} className="text-white" />
        </Pressable>
        <Text className="font-inter-semibold text-body-lg text-white">Enhance</Text>
        <Pressable
          onPressIn={() => setComparing(true)}
          onPressOut={() => setComparing(false)}
          disabled={!preview}
          className={`h-9 flex-row items-center gap-1 rounded-full px-3 ${comparing ? 'bg-white/25' : 'bg-white/10'}`}
        >
          <Icon name="compare" size={16} className="text-white" />
          <Text className="font-inter-semibold text-label-md text-white">Compare</Text>
        </Pressable>
      </View>

      {/* Preview */}
      <View className="flex-1 px-5 py-3">
        <Image source={{ uri: displayUri }} className="h-full w-full" resizeMode="contain" />
        {loading ? (
          <View className="absolute inset-0 items-center justify-center">
            <View className="rounded-full bg-black/60 p-3">
              <ActivityIndicator color="#ffffff" />
            </View>
          </View>
        ) : null}
        {comparing ? (
          <View className="absolute left-8 top-6 rounded-full bg-black/60 px-3 py-1">
            <Text className="font-inter-semibold text-[11px] text-white">Original</Text>
          </View>
        ) : null}
      </View>

      {/* Page switcher */}
      {pageCount > 1 ? (
        <View className="flex-row items-center justify-center gap-4 pb-2">
          <Pressable accessibilityLabel="Previous"
            onPress={() => setActiveIndex(Math.max(0, activeIndex - 1))}
            disabled={activeIndex === 0}
            hitSlop={8}
            className={activeIndex === 0 ? 'opacity-30' : ''}
          >
            <Icon name="chevron-left" size={26} className="text-white" />
          </Pressable>
          <Text className="font-inter-medium text-label-md text-white/70">
            Page {activeIndex + 1} of {pageCount}
          </Text>
          <Pressable accessibilityLabel="Next"
            onPress={() => setActiveIndex(Math.min(pageCount - 1, activeIndex + 1))}
            disabled={activeIndex === pageCount - 1}
            hitSlop={8}
            className={activeIndex === pageCount - 1 ? 'opacity-30' : ''}
          >
            <Icon name="chevron-right" size={26} className="text-white" />
          </Pressable>
        </View>
      ) : null}

      {/* Filters / Adjust tabs */}
      <View className="flex-row items-center justify-center gap-2 pt-1">
        {(
          [
            ['filters', 'Filters', 'auto-awesome'],
            ['adjust', 'Adjust', 'tune'],
          ] as const
        ).map(([key, label, icon]) => {
          const active = panel === key;
          return (
            <Pressable
              key={key}
              onPress={() => setPanel(key)}
              className={`h-8 flex-row items-center gap-1.5 rounded-full px-4 ${active ? 'bg-white/15' : ''}`}
            >
              <Icon name={icon} size={15} className={active ? 'text-[#ffffff]' : 'text-white/60'} />
              <Text className={`text-[12px] ${active ? 'font-inter-semibold text-white' : 'font-inter text-white/60'}`}>
                {label}
              </Text>
              {key === 'adjust' && lightChanged ? <View className="h-1.5 w-1.5 rounded-full bg-[#ffffff]" /> : null}
            </Pressable>
          );
        })}
      </View>

      {panel === 'adjust' ? (
        <View className="py-2">
          <LightSlider
            icon="brightness-6"
            label="Brightness"
            value={adjust.brightness}
            onChangeEnd={(v) => changeLight('brightness', v)}
          />
          <LightSlider
            icon="contrast"
            label="Contrast"
            value={adjust.contrast}
            onChangeEnd={(v) => changeLight('contrast', v)}
          />
          <Pressable
            onPress={resetLight}
            disabled={!lightChanged}
            className={`self-center px-4 py-1 ${lightChanged ? '' : 'opacity-30'}`}
          >
            <Text className="font-inter-semibold text-[12px] text-[#ffffff]">Reset lighting</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          horizontal
          style={{ flexGrow: 0 }}
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-3 px-4 py-3"
        >
          {ENHANCE_FILTERS.map(({ key, label }) => {
            const selected = filter === key;
            const thumb = preview?.thumbs[key];
            return (
              <Pressable key={key} onPress={() => chooseFilter(key)} className="items-center gap-1.5">
                <View
                  className={`h-[76px] w-[60px] overflow-hidden rounded-xl border-2 bg-white/10 ${
                    selected ? 'border-[#ffffff]' : 'border-transparent'
                  }`}
                >
                  {thumb ? <Image source={{ uri: thumb }} className="h-full w-full" resizeMode="cover" /> : null}
                </View>
                <Text
                  className={`text-[11px] ${selected ? 'font-inter-semibold text-[#ffffff]' : 'font-inter text-white/70'}`}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* Tools */}
      <View
        className="flex-row items-center justify-between overflow-hidden rounded-t-[28px] px-3 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 12) + 4 }}
      >
        <GlassBackground radius={28} variant="media" topOnly />
        <ToolButton icon="rotate-left" label="Left" onPress={() => void rotate(-90)} disabled={!!busy} />
        <ToolButton icon="rotate-right" label="Right" onPress={() => void rotate(90)} disabled={!!busy} />
        <ToolButton icon="crop" label="Crop" onPress={() => router.push('/crop')} disabled={!!busy} />
        <ToolButton
          icon="add-photo-alternate"
          label="Add page"
          onPress={() => void handleAddPage()}
          disabled={!!busy}
        />
        <Pressable accessibilityLabel="Done"
          onPress={() => void handleDone()}
          disabled={!!busy || loading}
          className={`h-12 w-16 items-center justify-center rounded-full bg-[#ffffff] active:opacity-80 ${
            busy || loading ? 'opacity-60' : ''
          }`}
        >
          <Icon name="check" size={26} className="text-[#111111]" />
        </Pressable>
      </View>
    </View>
  );
}
