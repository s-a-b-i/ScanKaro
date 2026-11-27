/** Choose which documents to restore from a checked backup. */
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { OpenedBackup } from '../utils/backup';
import { Icon } from './Icon';
import { GlassBackground } from './Glass';

type Props = {
  backup: OpenedBackup | null;
  onCancel: () => void;
  onRestore: (ids: string[]) => void;
};

export function RestoreSheet({ backup, onCancel, onRestore }: Props) {
  const insets = useSafeAreaInsets();
  const [chosen, setChosen] = useState<string[]>([]);

  const restorable = backup?.documents.filter((d) => !d.exists && !d.problem) ?? [];

  // Everything that can be restored starts selected.
  useEffect(() => {
    setChosen(backup ? backup.documents.filter((d) => !d.exists && !d.problem).map((d) => d.id) : []);
  }, [backup]);

  const toggle = (id: string) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const allOn = restorable.length > 0 && chosen.length === restorable.length;
  const damaged = backup?.documents.filter((d) => d.problem).length ?? 0;
  const made = backup?.createdAt
    ? new Date(backup.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    <Modal visible={!!backup} transparent animationType="slide" onRequestClose={onCancel}>
      <View className="flex-1 justify-end bg-black/50">
        <Pressable className="flex-1" onPress={onCancel} />
        <View className="max-h-[85%] overflow-hidden rounded-t-[32px] pt-3" style={{ paddingBottom: insets.bottom + 16 }}>
          <GlassBackground radius={32} variant="sheet" topOnly />
          <View className="mb-3 h-1 w-10 self-center rounded-full bg-outline-variant" />
          <View className="px-5">
            <Text className="font-inter-semibold text-[22px] tracking-[-0.4px] text-on-surface">Restore from backup</Text>
            <Text className="mb-3 mt-1 font-inter text-[13px] text-on-surface-variant">
              {backup?.documents.length ?? 0} document{backup?.documents.length === 1 ? '' : 's'}
              {made ? ` · made ${made}` : ''}
              {damaged ? ` · ${damaged} damaged` : ' · all files checked OK'}
            </Text>
            {restorable.length > 1 ? (
              <Pressable
                onPress={() => setChosen(allOn ? [] : restorable.map((d) => d.id))}
                className="mb-2 self-start rounded-full bg-surface-container px-3.5 py-1.5"
              >
                <Text className="font-inter-semibold text-[13px] text-on-surface">{allOn ? 'Select none' : 'Select all'}</Text>
              </Pressable>
            ) : null}
          </View>
          <ScrollView contentContainerClassName="px-5 pb-2">
            {backup?.documents.map((d) => {
              const disabled = d.exists || !!d.problem;
              const on = chosen.includes(d.id);
              return (
                <Pressable
                  key={d.id}
                  onPress={() => !disabled && toggle(d.id)}
                  disabled={disabled}
                  className={`mb-2 flex-row items-center gap-3 rounded-2xl bg-surface-container p-3 ${disabled ? 'opacity-60' : ''}`}
                >
                  <View
                    className={`h-6 w-6 items-center justify-center rounded-full border-2 ${
                      on ? 'border-primary bg-primary' : 'border-outline-variant'
                    }`}
                  >
                    {on ? <Icon name="check" size={15} className="text-on-primary" /> : null}
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text className="font-inter-semibold text-[15px] text-on-surface" numberOfLines={1}>
                      {d.title}
                    </Text>
                    <Text
                      className={`font-inter text-[12px] ${d.problem ? 'text-error' : 'text-on-surface-variant'}`}
                      numberOfLines={1}
                    >
                      {d.problem ?? (d.exists ? 'Already in your library' : `${d.pages} page${d.pages === 1 ? '' : 's'}`)}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
          <View className="px-5 pt-3">
            <Pressable
              onPress={() => onRestore(chosen)}
              disabled={chosen.length === 0}
              className={`h-14 items-center justify-center rounded-full bg-on-surface active:opacity-85 ${
                chosen.length ? '' : 'opacity-40'
              }`}
            >
              <Text className="font-inter-semibold text-[17px] text-surface">
                {chosen.length ? `Restore ${chosen.length} document${chosen.length === 1 ? '' : 's'}` : 'Nothing to restore'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
