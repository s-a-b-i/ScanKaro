import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from './Icon';
import { FolderItem } from '../types';

type CreateFolderSheetProps = {
  visible: boolean;
  loading?: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
};

export function CreateFolderSheet({ visible, loading, onClose, onCreate }: CreateFolderSheetProps) {
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
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
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
      </KeyboardAvoidingView>
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

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  sheet: {
    backgroundColor: '#f7f9fb',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
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
    backgroundColor: '#bcc9c6',
    marginBottom: 16,
  },
  title: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    color: '#191c1e',
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#3d4947',
    marginBottom: 16,
  },
  input: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#f2f4f6',
    paddingHorizontal: 16,
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: '#191c1e',
    marginBottom: 16,
  },
  button: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#00685f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: 'rgba(109, 122, 119, 0.35)',
  },
  buttonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: '#ffffff',
  },
  moveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#f2f4f6',
    marginBottom: 8,
  },
  moveRowActive: {
    backgroundColor: '#dae2fd',
  },
  moveRowText: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: '#191c1e',
  },
  moveRowCount: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: '#3d4947',
  },
});
