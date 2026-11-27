import { useEffect, useRef, useState, useMemo } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeColors, useTheme } from '../constants/theme';

import { Icon } from './Icon';
import { KeyboardAvoid } from './KeyboardAvoid';
import { FolderItem } from '../types';

type CreateFolderSheetProps = {
  visible: boolean;
  loading?: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
};

export function CreateFolderSheet({ visible, loading, onClose, onCreate }: CreateFolderSheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const [name, setName] = useState('');

  useEffect(() => {
    if (visible) {
      setName('');
      const timer = setTimeout(() => inputRef.current?.focus(), 300);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [visible]);

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed || loading) return;
    onCreate(trimmed);
    setName('');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoid inModal style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />

        <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>New Folder</Text>
          <Text style={styles.subtitle}>Enter a name for your folder</Text>

          <TextInput
            ref={inputRef}
            value={name}
            onChangeText={setName}
            placeholder="Folder name"
            placeholderTextColor="#6d7a77"
            returnKeyType="done"
            onSubmitEditing={handleCreate}
            autoCapitalize="words"
            autoCorrect={false}
            style={styles.input}
          />

          <Pressable
            disabled={!name.trim() || loading}
            onPress={handleCreate}
            style={[styles.button, (!name.trim() || loading) && styles.buttonDisabled]}
          >
            <Text style={styles.buttonText}>{loading ? 'Creating…' : 'Create Folder'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoid>
    </Modal>
  );
}

type MoveFolderSheetProps = {
  visible: boolean;
  folders: FolderItem[];
  selectedId?: string | null;
  onClose: () => void;
  onSelect: (folderId: string | null) => void;
};

export function MoveFolderSheet({ visible, folders, selectedId, onClose, onSelect }: MoveFolderSheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, styles.moveSheet, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>Move to Folder</Text>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Pressable
              onPress={() => onSelect(null)}
              style={[styles.moveRow, selectedId == null && styles.moveRowActive]}
            >
              <Icon name="home" size={22} className="text-primary" />
              <Text style={styles.moveRowText}>Root (no folder)</Text>
            </Pressable>
            {folders.map((folder) => (
              <Pressable
                key={folder.id}
                onPress={() => onSelect(folder.id)}
                style={[styles.moveRow, selectedId === folder.id && styles.moveRowActive]}
              >
                <Icon name={folder.folderIcon ?? 'folder'} size={22} className="text-primary" filled />
                <Text style={styles.moveRowText}>{folder.title}</Text>
                <Text style={styles.moveRowCount}>{folder.count}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  sheet: {
    backgroundColor: c['surface-container-lowest'],
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 20,
    paddingTop: 12,
    zIndex: 1,
  },
  moveSheet: {
    maxHeight: '70%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: c['outline-variant'],
    marginBottom: 16,
  },
  title: {
    fontFamily: 'InterTight_600SemiBold',
    fontSize: 20,
    color: c['on-surface'],
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: 'InterTight_400Regular',
    fontSize: 14,
    color: c['on-surface-variant'],
    marginBottom: 16,
  },
  input: {
    height: 48,
    borderRadius: 16,
    backgroundColor: c['surface-container-low'],
    paddingHorizontal: 16,
    fontFamily: 'InterTight_400Regular',
    fontSize: 16,
    color: c['on-surface'],
    marginBottom: 16,
  },
  button: {
    height: 52,
    borderRadius: 26,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: 'rgba(109, 122, 119, 0.35)',
  },
  buttonText: {
    fontFamily: 'InterTight_600SemiBold',
    fontSize: 16,
    color: c['on-primary'],
  },
  moveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: c['surface-container-low'],
    marginBottom: 8,
  },
  moveRowActive: {
    backgroundColor: 'rgba(0, 104, 95, 0.1)',
  },
  moveRowText: {
    flex: 1,
    fontFamily: 'InterTight_400Regular',
    fontSize: 16,
    color: c['on-surface'],
  },
  moveRowCount: {
    fontFamily: 'InterTight_500Medium',
    fontSize: 12,
    color: c['on-surface-variant'],
  },
});
