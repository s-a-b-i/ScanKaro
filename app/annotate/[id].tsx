import { useLocalSearchParams, useRouter } from 'expo-router';
import { ComponentProps, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  LayoutChangeEvent,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DraggableMark } from '../../components/annotate/DraggableMark';
import { InkCanvas, InkTool, ViewTransform } from '../../components/annotate/InkCanvas';
import { SignaturePad } from '../../components/annotate/SignaturePad';
import { Icon } from '../../components/Icon';
import { GlassBackground } from '../../components/Glass';
import { KeyboardAvoid } from '../../components/KeyboardAvoid';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import { useTheme } from '../../constants/theme';
import { useApp } from '../../context/AppProvider';
import { localDocumentService } from '../../services/local/library';
import { deleteSignature, listSignatures, SavedSignature } from '../../services/signatures';
import { getImageSizeFromUri } from '../../utils/documentScan';
import { renderAnnotatedPage, ShapeKind, SignatureMark, Stroke, TextMark } from '../../utils/ink';
import { goBackOr } from '../../utils/navigation';
import type { RgbaImage } from '../../utils/opencvDocumentScan';
import { readSmallPixels } from '../../utils/skiaImage';

type IconName = ComponentProps<typeof Icon>['name'];
type Mode = 'pen' | 'highlight' | 'shape' | 'select';
type Marks = { strokes: Stroke[]; texts: TextMark[]; signatures: SignatureMark[] };

const PEN_COLORS = ['#10182b', '#1d4ed8', '#c81e1e'];
const EMPTY: Marks = { strokes: [], texts: [], signatures: [] };
const newId = () => Math.random().toString(36).slice(2, 9);

const SHAPES: { key: ShapeKind; label: string; icon: IconName }[] = [
  { key: 'arrow', label: 'Arrow', icon: 'north-east' },
  { key: 'rect', label: 'Box', icon: 'crop-square' },
  { key: 'line', label: 'Line', icon: 'horizontal-rule' },
  { key: 'redact', label: 'Redact', icon: 'rectangle' },
  { key: 'erase', label: 'Erase', icon: 'auto-fix-normal' },
];

function ToolButton({
  icon,
  label,
  active,
  onPress,
  disabled,
}: {
  icon: IconName;
  label: string;
  active?: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      accessibilityState={{ selected: !!active }}
      className={`min-w-[52px] items-center gap-1 rounded-2xl px-1.5 py-1.5 ${active ? 'bg-white' : ''} ${
        disabled ? 'opacity-30' : ''
      }`}
    >
      <Icon name={icon} size={22} className={active ? 'text-[#111111]' : 'text-white'} />
      <Text className={`text-[11px] ${active ? 'font-inter-semibold text-[#111111]' : 'font-inter text-white/80'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Draw, highlight, add text and place signatures on one page of a saved document. */
export default function AnnotateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { refreshDocuments } = useApp();
  // `tool`: open straight into a tool from the Tools tab ("erase" or "sign").
  const { id, page, tool: startTool } = useLocalSearchParams<{ id: string; page?: string; tool?: string }>();
  const pageIndex = Number(page ?? 0) || 0;

  const [pageUri, setPageUri] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [area, setArea] = useState({ width: 0, height: 0 });

  // Undo/redo keep whole snapshots: marks are small, so this stays simple and cheap.
  const [history, setHistory] = useState<Marks[]>([EMPTY]);
  const [step, setStep] = useState(0);
  const marks = history[step];

  const [mode, setMode] = useState<Mode>(startTool === 'erase' ? 'shape' : 'pen');
  const [penColor, setPenColor] = useState(PEN_COLORS[0]);
  const [shapeKind, setShapeKind] = useState<ShapeKind>(startTool === 'erase' ? 'erase' : 'arrow');
  const [selected, setSelected] = useState<string | null>(null);
  const [textOpen, setTextOpen] = useState(false);
  const [textDraft, setTextDraft] = useState('');
  const [sigSheet, setSigSheet] = useState(false);
  const [padOpen, setPadOpen] = useState(false);
  const [signatures, setSignatures] = useState<SavedSignature[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      const doc = await localDocumentService.getById(id);
      const uri = doc?.pageUrls?.[pageIndex];
      if (!uri) {
        Alert.alert('Page not found');
        goBackOr(router, `/document/${id}`);
        return;
      }
      setPageUri(uri);
      setImageSize(await getImageSizeFromUri(uri));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, pageIndex]);

  const transform: ViewTransform | null = useMemo(() => {
    if (!imageSize || area.width <= 0 || area.height <= 0) return null;
    const scale = Math.min(area.width / imageSize.width, area.height / imageSize.height);
    return {
      scale,
      offsetX: (area.width - imageSize.width * scale) / 2,
      offsetY: (area.height - imageSize.height * scale) / 2,
    };
  }, [imageSize, area]);

  // Small copy of the page, for smart erase: boxes fill with the colour around them.
  const pixelsRef = useRef<RgbaImage | null>(null);
  useEffect(() => {
    if (!pageUri) return;
    readSmallPixels(pageUri, 400)
      .then((px) => (pixelsRef.current = px))
      .catch(() => undefined);
  }, [pageUri]);

  /** Median colour of a thin ring just outside the box (the paper around what is erased). */
  const surroundColor = (points: number[]) => {
    const px = pixelsRef.current;
    if (!px || !imageSize || points.length < 4) return '#ffffff';
    const k = px.width / imageSize.width;
    const x0 = Math.min(points[0], points[points.length - 2]) * k;
    const x1 = Math.max(points[0], points[points.length - 2]) * k;
    const y0 = Math.min(points[1], points[points.length - 1]) * k;
    const y1 = Math.max(points[1], points[points.length - 1]) * k;
    const ring = 4;
    const r: number[] = [];
    const g: number[] = [];
    const b: number[] = [];
    const sample = (x: number, y: number) => {
      const xi = Math.round(x);
      const yi = Math.round(y);
      if (xi < 0 || yi < 0 || xi >= px.width || yi >= px.height) return;
      const i = (yi * px.width + xi) * 4;
      r.push(px.data[i]);
      g.push(px.data[i + 1]);
      b.push(px.data[i + 2]);
    };
    for (let d = 1; d <= ring; d++) {
      for (let x = x0 - d; x <= x1 + d; x++) {
        sample(x, y0 - d);
        sample(x, y1 + d);
      }
      for (let y = y0 - d; y <= y1 + d; y++) {
        sample(x0 - d, y);
        sample(x1 + d, y);
      }
    }
    if (r.length === 0) return '#ffffff';
    const median = (a: number[]) => a.sort((m, n) => m - n)[Math.floor(a.length / 2)];
    const hex = (v: number) => v.toString(16).padStart(2, '0');
    return `#${hex(median(r))}${hex(median(g))}${hex(median(b))}`;
  };

  const commit = (next: Marks) => {
    setHistory((h) => [...h.slice(0, step + 1), next]);
    setStep((s) => s + 1);
  };

  const dirty = step > 0;

  // Sizes relative to the page, so pens feel the same on any image resolution.
  const unit = imageSize ? Math.max(imageSize.width, imageSize.height) / 1000 : 1;
  const tool: InkTool | null =
    mode === 'pen'
      ? { color: penColor, width: 3 * unit, opacity: 1 }
      : mode === 'highlight'
        ? { color: '#ffd60a', width: 18 * unit, opacity: 0.38 }
        : mode === 'shape'
          ? {
              color: shapeKind === 'redact' ? '#000000' : shapeKind === 'erase' ? '#ffffff' : penColor,
              width: 4 * unit,
              opacity: 1,
              shape: shapeKind,
            }
          : null;

  const addText = () => {
    const text = textDraft.trim();
    setTextOpen(false);
    setTextDraft('');
    if (!text || !imageSize) return;
    const size = 26 * unit;
    const mark: TextMark = {
      id: newId(),
      text,
      x: imageSize.width * 0.1,
      y: imageSize.height * 0.45,
      size,
      color: penColor,
    };
    commit({ ...marks, texts: [...marks.texts, mark] });
    setMode('select');
    setSelected(mark.id);
  };

  const placeSignature = async (sig: SavedSignature) => {
    setSigSheet(false);
    if (!imageSize) return;
    const dims = await getImageSizeFromUri(sig.uri);
    const width = imageSize.width * 0.36;
    const height = (width * dims.height) / dims.width;
    const mark: SignatureMark = {
      id: newId(),
      uri: sig.uri,
      x: imageSize.width * 0.55,
      y: imageSize.height * 0.78,
      width,
      height,
    };
    commit({ ...marks, signatures: [...marks.signatures, mark] });
    setMode('select');
    setSelected(mark.id);
  };

  const moveMark = (markId: string, x: number, y: number) => {
    commit({
      ...marks,
      texts: marks.texts.map((t) => (t.id === markId ? { ...t, x, y } : t)),
      signatures: marks.signatures.map((s) => (s.id === markId ? { ...s, x, y } : s)),
    });
  };

  const resizeSelected = (factor: number) => {
    if (!selected) return;
    commit({
      ...marks,
      texts: marks.texts.map((t) => (t.id === selected ? { ...t, size: t.size * factor } : t)),
      signatures: marks.signatures.map((s) =>
        s.id === selected ? { ...s, width: s.width * factor, height: s.height * factor } : s,
      ),
    });
  };

  const deleteSelected = () => {
    if (!selected) return;
    commit({
      ...marks,
      texts: marks.texts.filter((t) => t.id !== selected),
      signatures: marks.signatures.filter((s) => s.id !== selected),
    });
    setSelected(null);
  };

  const openSignatures = () => {
    const list = listSignatures();
    setSignatures(list);
    if (list.length === 0) setPadOpen(true);
    else setSigSheet(true);
  };

  // Opened from the Tools tab's Sign: show the signatures once the page is ready.
  const signOpened = useRef(false);
  useEffect(() => {
    if (startTool !== 'sign' || !imageSize || signOpened.current) return;
    signOpened.current = true;
    openSignatures();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageSize, startTool]);

  const save = async () => {
    if (!id || !pageUri || !dirty) return;
    setSaving(true);
    try {
      const out = await renderAnnotatedPage(pageUri, marks);
      await localDocumentService.replacePage(id, pageIndex, out);
      // Redacted words must not survive in the saved text used for search.
      if (marks.strokes.some((st) => st.shape === 'redact' || st.shape === 'erase')) {
        await localDocumentService.saveOcrText(id, '');
      }
      await refreshDocuments();
      goBackOr(router, `/document/${id}`);
    } catch (error) {
      Alert.alert('Could not save', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const leave = () => {
    if (!dirty) {
      goBackOr(router, `/document/${id}`);
      return;
    }
    Alert.alert('Discard changes?', 'Your marks on this page will be lost.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => goBackOr(router, `/document/${id}`) },
    ]);
  };

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setArea({ width, height });
  };

  return (
    <View className="flex-1 bg-[#0e0f12]" style={{ paddingTop: insets.top }}>
      <LoadingOverlay visible={saving} message="Saving page…" />

      {/* Header */}
      <View className="h-14 flex-row items-center justify-between px-2">
        <Pressable accessibilityLabel="Close" onPress={leave} hitSlop={8} className="h-11 w-11 items-center justify-center rounded-full active:bg-white/10">
          <Icon name="close" size={24} className="text-white" />
        </Pressable>
        <View className="flex-row items-center gap-1">
          <Pressable
            onPress={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            accessibilityLabel="Undo"
            className={`h-11 w-11 items-center justify-center rounded-full active:bg-white/10 ${step === 0 ? 'opacity-30' : ''}`}
          >
            <Icon name="undo" size={22} className="text-white" />
          </Pressable>
          <Pressable
            onPress={() => setStep((s) => Math.min(history.length - 1, s + 1))}
            disabled={step >= history.length - 1}
            accessibilityLabel="Redo"
            className={`h-11 w-11 items-center justify-center rounded-full active:bg-white/10 ${
              step >= history.length - 1 ? 'opacity-30' : ''
            }`}
          >
            <Icon name="redo" size={22} className="text-white" />
          </Pressable>
        </View>
        <Pressable
          onPress={() => void save()}
          disabled={!dirty || saving}
          className={`h-10 items-center justify-center rounded-full bg-[#ffffff] px-5 active:opacity-80 ${dirty ? '' : 'opacity-40'}`}
        >
          <Text className="font-inter-semibold text-[15px] text-[#111111]">Save</Text>
        </Pressable>
      </View>

      {/* Page + marks */}
      <View className="flex-1 px-3 py-2">
        <View className="flex-1" onLayout={onLayout}>
          {pageUri && transform && imageSize ? (
            <>
              <Image
                source={{ uri: pageUri }}
                style={{
                  position: 'absolute',
                  left: transform.offsetX,
                  top: transform.offsetY,
                  width: imageSize.width * transform.scale,
                  height: imageSize.height * transform.scale,
                }}
              />
              <InkCanvas
                width={area.width}
                height={area.height}
                transform={transform}
                strokes={marks.strokes}
                tool={tool}
                onStrokeEnd={(stroke) =>
                  commit({
                    ...marks,
                    strokes: [...marks.strokes, stroke.shape === 'erase' ? { ...stroke, color: surroundColor(stroke.points) } : stroke],
                  })
                }
              />
              {mode === 'select' || marks.texts.length + marks.signatures.length > 0 ? (
                <View pointerEvents={mode === 'select' ? 'box-none' : 'none'} style={{ position: 'absolute', inset: 0 }}>
                  {marks.signatures.map((s) => (
                    <DraggableMark
                      key={s.id}
                      x={s.x}
                      y={s.y}
                      transform={transform}
                      selected={selected === s.id}
                      onSelect={() => setSelected(s.id)}
                      onMove={(x, y) => moveMark(s.id, x, y)}
                    >
                      <Image
                        source={{ uri: s.uri }}
                        style={{ width: s.width * transform.scale, height: s.height * transform.scale }}
                        resizeMode="contain"
                      />
                    </DraggableMark>
                  ))}
                  {marks.texts.map((t) => (
                    <DraggableMark
                      key={t.id}
                      x={t.x}
                      y={t.y}
                      transform={transform}
                      selected={selected === t.id}
                      onSelect={() => setSelected(t.id)}
                      onMove={(x, y) => moveMark(t.id, x, y)}
                    >
                      <Text
                        style={{
                          color: t.color,
                          fontSize: t.size * transform.scale,
                          lineHeight: t.size * 1.25 * transform.scale,
                          fontFamily: 'sans-serif-medium',
                        }}
                      >
                        {t.text}
                      </Text>
                    </DraggableMark>
                  ))}
                </View>
              ) : null}
            </>
          ) : null}
        </View>
      </View>

      {/* Context row: pen colours, or controls for the selected item */}
      <View className="h-14 flex-row items-center justify-center gap-4">
        {mode === 'select' && selected ? (
          <>
            <ToolButton icon="remove" label="Smaller" onPress={() => resizeSelected(1 / 1.15)} />
            <ToolButton icon="add" label="Bigger" onPress={() => resizeSelected(1.15)} />
            <ToolButton icon="delete-outline" label="Delete" onPress={deleteSelected} />
          </>
        ) : mode === 'shape' ? (
          <View className="flex-row items-center gap-1.5">
            {SHAPES.map((sh) => (
              <Pressable
                key={sh.key}
                onPress={() => setShapeKind(sh.key)}
                accessibilityLabel={sh.label}
                className={`h-10 flex-row items-center gap-1 rounded-full px-3 ${shapeKind === sh.key ? 'bg-white' : 'bg-white/10'}`}
              >
                <Icon name={sh.icon} size={16} className={shapeKind === sh.key ? 'text-black' : 'text-white'} />
                <Text className={`font-inter-semibold text-[13px] ${shapeKind === sh.key ? 'text-black' : 'text-white'}`}>
                  {sh.label}
                </Text>
              </Pressable>
            ))}
            {shapeKind !== 'redact' && shapeKind !== 'erase' ? (
              <Pressable
                onPress={() => setPenColor(PEN_COLORS[(PEN_COLORS.indexOf(penColor) + 1) % PEN_COLORS.length])}
                accessibilityLabel="Change colour"
                className="ml-1 h-11 w-11 items-center justify-center rounded-full border-2 border-white"
              >
                <View className="h-6 w-6 rounded-full" style={{ backgroundColor: penColor }} />
              </Pressable>
            ) : null}
          </View>
        ) : mode === 'pen' ? (
          PEN_COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setPenColor(c)}
              accessibilityLabel={`Pen colour ${c}`}
              className={`h-11 w-11 items-center justify-center rounded-full ${penColor === c ? 'border-2 border-white' : ''}`}
            >
              <View className="h-6 w-6 rounded-full" style={{ backgroundColor: c, borderWidth: 1, borderColor: '#ffffff44' }} />
            </Pressable>
          ))
        ) : (
          <Text className="font-inter text-[13px] text-white/60">
            {mode === 'highlight' ? 'Drag over text to highlight it' : 'Tap an item to select it, drag to move'}
          </Text>
        )}
      </View>

      {/* Tools */}
      <View
        className="flex-row items-center justify-between overflow-hidden rounded-t-[28px] px-3 pt-2"
        style={{ paddingBottom: Math.max(insets.bottom, 10) + 4 }}
      >
        <GlassBackground radius={28} variant="media" topOnly />
        <ToolButton icon="edit" label="Pen" active={mode === 'pen'} onPress={() => { setMode('pen'); setSelected(null); }} />
        <ToolButton icon="border-color" label="Highlight" active={mode === 'highlight'} onPress={() => { setMode('highlight'); setSelected(null); }} />
        <ToolButton icon="category" label="Shapes" active={mode === 'shape'} onPress={() => { setMode('shape'); setSelected(null); }} />
        <ToolButton icon="title" label="Text" onPress={() => setTextOpen(true)} />
        <ToolButton icon="gesture" label="Sign" onPress={openSignatures} />
        <ToolButton icon="pan-tool-alt" label="Move" active={mode === 'select'} onPress={() => setMode('select')} />
      </View>

      {/* Add text */}
      <Modal visible={textOpen} transparent animationType="fade" onRequestClose={() => setTextOpen(false)}>
        <KeyboardAvoid inModal className="flex-1 justify-end bg-black/50">
          <Pressable className="flex-1" onPress={() => setTextOpen(false)} />
          <View className="overflow-hidden rounded-t-[32px] px-5 pt-3" style={{ paddingBottom: insets.bottom + 20 }}>
            <GlassBackground radius={32} variant="sheet" topOnly />
            <View className="mb-4 h-1 w-10 self-center rounded-full bg-outline-variant" />
            <Text className="mb-4 font-inter-semibold text-[22px] text-on-surface">Add text</Text>
            <TextInput
              value={textDraft}
              onChangeText={setTextDraft}
              autoFocus
              multiline
              placeholder="e.g. Approved, or today's date"
              placeholderTextColor={`${colors['on-surface-variant']}99`}
              className="min-h-14 rounded-2xl bg-surface-container px-4 py-3 font-inter text-[17px] text-on-surface"
            />
            <Pressable
              onPress={() => setTextDraft((d) => `${d}${d ? ' ' : ''}${new Date().toLocaleDateString()}`)}
              className="mt-3 self-start rounded-full bg-surface-container px-4 py-2"
            >
              <Text className="font-inter-semibold text-[13px] text-on-surface">Insert today&apos;s date</Text>
            </Pressable>
            <Pressable onPress={addText} className="mt-4 h-14 items-center justify-center rounded-full bg-on-surface active:opacity-85">
              <Text className="font-inter-semibold text-[17px] text-surface">Place on page</Text>
            </Pressable>
          </View>
        </KeyboardAvoid>
      </Modal>

      {/* Saved signatures */}
      <Modal visible={sigSheet} transparent animationType="slide" onRequestClose={() => setSigSheet(false)}>
        <View className="flex-1 justify-end bg-black/50">
          <Pressable className="flex-1" onPress={() => setSigSheet(false)} />
          <View className="max-h-[70%] overflow-hidden rounded-t-[32px] px-5 pt-3" style={{ paddingBottom: insets.bottom + 20 }}>
            <GlassBackground radius={32} variant="sheet" topOnly />
            <View className="mb-4 h-1 w-10 self-center rounded-full bg-outline-variant" />
            <Text className="mb-1 font-inter-semibold text-[22px] text-on-surface">Your signatures</Text>
            <Text className="mb-4 font-inter text-[13px] text-on-surface-variant">Tap one to place it. Long-press to delete.</Text>
            <FlatList
              data={signatures}
              keyExtractor={(s) => s.id}
              numColumns={2}
              columnWrapperStyle={{ gap: 12 }}
              contentContainerStyle={{ gap: 12 }}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => void placeSignature(item)}
                  onLongPress={() =>
                    Alert.alert('Delete signature?', undefined, [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => {
                          deleteSignature(item.id);
                          setSignatures(listSignatures());
                        },
                      },
                    ])
                  }
                  className="h-24 flex-1 items-center justify-center rounded-2xl bg-white p-3"
                >
                  <Image source={{ uri: item.uri }} className="h-full w-full" resizeMode="contain" />
                </Pressable>
              )}
            />
            <Pressable
              onPress={() => {
                setSigSheet(false);
                setPadOpen(true);
              }}
              className="mt-4 h-14 flex-row items-center justify-center gap-2 rounded-full border border-outline-variant active:bg-surface-container"
            >
              <Icon name="add" size={20} className="text-on-surface" />
              <Text className="font-inter-semibold text-[16px] text-on-surface">New signature</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <SignaturePad
        visible={padOpen}
        onCancel={() => setPadOpen(false)}
        onSaved={(sig) => {
          setPadOpen(false);
          void placeSignature(sig);
        }}
      />
    </View>
  );
}
