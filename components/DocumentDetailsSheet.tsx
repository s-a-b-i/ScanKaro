/**
 * Tags and expiry date for one document. Setting an expiry date schedules reminders
 * (30 days, 7 days and on the day) as local notifications.
 */
import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../constants/theme';
import { localDocumentService } from '../services/local/library';
import type { DocumentItem } from '../types';
import { ensureReminderPermission, expiryLabel } from '../utils/reminders';
import { Icon } from './Icon';
import { GlassBackground } from './Glass';
import { KeyboardAvoid } from './KeyboardAvoid';

const SUGGESTED = ['ID', 'Receipt', 'Bill', 'Contract', 'Medical', 'Certificate', 'Work', 'Personal'];

const PRESETS: { label: string; months: number }[] = [
  { label: '1 month', months: 1 },
  { label: '6 months', months: 6 },
  { label: '1 year', months: 12 },
  { label: '5 years', months: 60 },
  { label: '10 years', months: 120 },
];

const addMonths = (months: number) => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setMonth(d.getMonth() + months);
  return d.getTime();
};

function Stepper({ label, value, onStep }: { label: string; value: string; onStep: (delta: number) => void }) {
  return (
    <View className="flex-1 items-center rounded-2xl bg-surface-container py-2">
      <Text className="font-inter text-[11px] text-on-surface-variant">{label}</Text>
      <View className="mt-1 flex-row items-center gap-1">
        <Pressable accessibilityLabel="Decrease" onPress={() => onStep(-1)} hitSlop={6} className="h-8 w-8 items-center justify-center rounded-full active:bg-surface-container-high">
          <Icon name="remove" size={18} className="text-on-surface" />
        </Pressable>
        <Text className="min-w-[40px] text-center font-inter-semibold text-[16px] text-on-surface">{value}</Text>
        <Pressable accessibilityLabel="Add" onPress={() => onStep(1)} hitSlop={6} className="h-8 w-8 items-center justify-center rounded-full active:bg-surface-container-high">
          <Icon name="add" size={18} className="text-on-surface" />
        </Pressable>
      </View>
    </View>
  );
}

type Props = {
  document: DocumentItem | null;
  visible: boolean;
  onClose: () => void;
  /** Called after saving, to reload the document. */
  onSaved: () => void;
};

export function DocumentDetailsSheet({ document, visible, onClose, onSaved }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [tags, setTags] = useState<string[]>([]);
  const [known, setKnown] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible || !document) return;
    setTags(document.tags ?? []);
    setExpiresAt(document.expiresAt ?? null);
    setDraft('');
    void localDocumentService.allTags().then(setKnown);
  }, [visible, document]);

  const has = (t: string) => tags.some((x) => x.toLowerCase() === t.toLowerCase());
  const toggle = (t: string) => setTags((cur) => (has(t) ? cur.filter((x) => x.toLowerCase() !== t.toLowerCase()) : [...cur, t]));
  const addDraft = () => {
    const t = draft.trim();
    if (t && !has(t)) setTags((cur) => [...cur, t]);
    setDraft('');
  };

  const step = (part: 'day' | 'month' | 'year', delta: number) =>
    setExpiresAt((cur) => {
      const d = new Date(cur ?? addMonths(12));
      if (part === 'day') d.setDate(d.getDate() + delta);
      if (part === 'month') d.setMonth(d.getMonth() + delta);
      if (part === 'year') d.setFullYear(d.getFullYear() + delta);
      return d.getTime();
    });

  const save = async () => {
    if (!document) return;
    setSaving(true);
    try {
      const pending = draft.trim() && !has(draft.trim()) ? [...tags, draft.trim()] : tags;
      await localDocumentService.setTags(document.id, pending);
      await localDocumentService.setExpiry(document.id, expiresAt);
      if (expiresAt && !(await ensureReminderPermission())) {
        Alert.alert(
          'Reminders are off',
          'The expiry date is saved, but notifications are turned off for ScanKaro, so no reminder will appear.',
        );
      }
      onSaved();
      onClose();
    } catch (error) {
      Alert.alert('Could not save', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const chips = [...new Set([...tags, ...known, ...SUGGESTED].map((t) => t))].filter(
    (t, i, all) => all.findIndex((x) => x.toLowerCase() === t.toLowerCase()) === i,
  );
  const date = expiresAt ? new Date(expiresAt) : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoid inModal className="flex-1 justify-end bg-black/50">
        <Pressable className="flex-1" onPress={onClose} />
        <View className="max-h-[88%] overflow-hidden rounded-t-[32px] pt-3" style={{ paddingBottom: insets.bottom + 16 }}>
          <GlassBackground radius={32} variant="sheet" topOnly />
          <View className="mb-3 h-1 w-10 self-center rounded-full bg-outline-variant" />
          <ScrollView contentContainerClassName="px-5 pb-2" keyboardShouldPersistTaps="handled">
            <Text className="font-inter-semibold text-[22px] tracking-[-0.4px] text-on-surface">Tags</Text>
            <Text className="mb-3 mt-1 font-inter text-[13px] text-on-surface-variant">
              Group documents and filter them in Folders.
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {chips.map((t) => {
                const on = has(t);
                return (
                  <Pressable
                    key={t}
                    onPress={() => toggle(t)}
                    className={`h-9 flex-row items-center gap-1 rounded-full px-3.5 ${on ? 'bg-on-surface' : 'bg-surface-container'}`}
                  >
                    {on ? <Icon name="check" size={15} className="text-surface" /> : null}
                    <Text className={`font-inter-semibold text-[13px] ${on ? 'text-surface' : 'text-on-surface'}`}>{t}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View className="mt-3 flex-row items-center gap-2">
              <TextInput
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={addDraft}
                placeholder="New tag"
                placeholderTextColor={`${colors['on-surface-variant']}99`}
                maxLength={24}
                returnKeyType="done"
                className="h-12 flex-1 rounded-2xl bg-surface-container px-4 font-inter text-[16px] text-on-surface"
              />
              <Pressable accessibilityLabel="Add tag"
                onPress={addDraft}
                disabled={!draft.trim()}
                className={`h-12 w-12 items-center justify-center rounded-2xl bg-on-surface ${draft.trim() ? '' : 'opacity-30'}`}
              >
                <Icon name="add" size={22} className="text-surface" />
              </Pressable>
            </View>

            <Text className="mt-7 font-inter-semibold text-[22px] tracking-[-0.4px] text-on-surface">Expiry date</Text>
            <Text className="mb-3 mt-1 font-inter text-[13px] text-on-surface-variant">
              For passports, IDs, insurance and contracts. You get a reminder 30 days and 7 days before, and on the day.
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2" style={{ flexGrow: 0 }}>
              {PRESETS.map((p) => (
                <Pressable
                  key={p.label}
                  onPress={() => setExpiresAt(addMonths(p.months))}
                  className="h-9 justify-center rounded-full bg-surface-container px-3.5"
                >
                  <Text className="font-inter-semibold text-[13px] text-on-surface">{p.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
            {date ? (
              <>
                <View className="mt-3 flex-row gap-2">
                  <Stepper label="Day" value={String(date.getDate())} onStep={(d) => step('day', d)} />
                  <Stepper
                    label="Month"
                    value={date.toLocaleDateString(undefined, { month: 'short' })}
                    onStep={(d) => step('month', d)}
                  />
                  <Stepper label="Year" value={String(date.getFullYear())} onStep={(d) => step('year', d)} />
                </View>
                <View className="mt-2 flex-row items-center justify-between">
                  <Text className="font-inter text-[14px] text-on-surface-variant">{expiryLabel(date.getTime())}</Text>
                  <Pressable onPress={() => setExpiresAt(null)} hitSlop={8}>
                    <Text className="font-inter-semibold text-[14px] text-error">Remove date</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <Text className="mt-3 font-inter text-[14px] text-on-surface-variant">No expiry date.</Text>
            )}
          </ScrollView>
          <View className="px-5 pt-3">
            <Pressable
              onPress={() => void save()}
              disabled={saving}
              className={`h-14 items-center justify-center rounded-full bg-on-surface active:opacity-85 ${saving ? 'opacity-50' : ''}`}
            >
              <Text className="font-inter-semibold text-[17px] text-surface">Save</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoid>
    </Modal>
  );
}
