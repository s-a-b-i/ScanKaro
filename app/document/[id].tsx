import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MoveFolderSheet } from '../../components/CreateFolderSheet';
import { DocumentViewerToolbar } from '../../components/document/DocumentViewerToolbar';
import { Icon } from '../../components/Icon';
import { useApp } from '../../context/AppProvider';
import { useScan } from '../../context/ScanProvider';
import { getDocumentById } from '../../services';
import { DocumentItem } from '../../types';
import { goBackOr } from '../../utils/navigation';
import { shareDocument } from '../../utils/shareDocument';

const { width: SCREEN_W } = Dimensions.get('window');

export default function DocumentViewerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { folders, moveDocumentToFolder, toggleFavorite, removeDocument } = useApp();
  const { setDocumentId, setTitle, setFolderId, reset } = useScan();

  const [document, setDocument] = useState<DocumentItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState(0);
  const [moveOpen, setMoveOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const reload = async () => {
    if (!id) return;
    const doc = await getDocumentById(id);
    setDocument(doc);
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const doc = await getDocumentById(id);
      if (!cancelled) {
        setDocument(doc);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#00685f" />
      </View>
    );
  }

  if (!document) {
    return (
      <View style={styles.loading}>
        <Text style={styles.emptyText}>Document not found</Text>
        <Pressable onPress={() => goBackOr(router, '/(tabs)')} style={styles.emptyBtn}>
          <Text style={styles.emptyBtnText}>Go Home</Text>
        </Pressable>
      </View>
    );
  }

  const pages = document.pageUrls?.length
    ? document.pageUrls
    : document.image
      ? [document.image]
      : [];

  const handleOcr = () => {
    router.push({
      pathname: '/ocr',
      params: {
        documentId: document.id,
        publicId: document.firstPagePublicId ?? document.pagePublicIds?.[activePage] ?? '',
      },
    });
  };

  const handleShare = async () => {
    const url = pages[activePage] ?? document.image;
    await shareDocument(document.title, url);
  };

  const handleMove = async (folderId: string | null) => {
    setMoveOpen(false);
    await moveDocumentToFolder(document.id, folderId);
    await reload();
  };

  const handleDelete = () => {
    Alert.alert('Delete document?', `"${document.title}" will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await removeDocument(document.id);
          goBackOr(router, '/(tabs)');
        },
      },
    ]);
  };

  const handleAddPage = () => {
    reset();
    setDocumentId(document.id);
    setTitle(document.title);
    if (document.folderId) setFolderId(document.folderId);
    router.push('/scan');
  };

  const toolbarActions = [
    { icon: 'add-a-photo' as const, label: 'Add', onPress: handleAddPage },
    { icon: 'edit' as const, label: 'Edit', onPress: () => Alert.alert('Edit', 'Crop and filters are available when scanning new pages.') },
    { icon: 'share' as const, label: 'Share', onPress: handleShare, primary: true },
    { icon: 'description' as const, label: 'To Word', onPress: handleOcr },
    { icon: 'draw' as const, label: 'Sign', onPress: () => Alert.alert('Sign', 'Digital signature coming soon.') },
  ];

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <Pressable onPress={() => goBackOr(router, '/(tabs)')} style={styles.headerIconBtn}>
          <Icon name="arrow-back" size={24} className="text-on-surface" />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {document.title}
          </Text>
          <Text style={styles.headerSub}>
            {document.pages} Page{document.pages === 1 ? '' : 's'}
          </Text>
        </View>

        <View style={styles.headerRight}>
          <Pressable
            onPress={() => toggleFavorite(document.id).then(reload)}
            style={styles.tagBtn}
          >
            <Icon
              name={document.favorite ? 'star' : 'label'}
              size={16}
              className={document.favorite ? 'text-primary' : 'text-on-surface-variant'}
            />
            <Text style={styles.tagText}>{document.favorite ? 'Saved' : 'Tag +'}</Text>
          </Pressable>
          <Pressable onPress={() => setMenuOpen(true)} style={styles.headerIconBtn}>
            <Icon name="more-vert" size={22} className="text-on-surface" />
          </Pressable>
        </View>
      </View>

      {/* Page thumbnails */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.thumbRow}
        style={styles.thumbStrip}
      >
        {pages.map((page, index) => (
          <Pressable key={`${page}-${index}`} onPress={() => setActivePage(index)} style={styles.thumbItem}>
            <View style={[styles.thumbFrame, activePage === index && styles.thumbFrameActive]}>
              <Image source={{ uri: page }} style={styles.thumbImage} resizeMode="cover" />
            </View>
            <Text style={[styles.thumbNum, activePage === index && styles.thumbNumActive]}>{index + 1}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Main preview */}
      <ScrollView
        style={styles.previewScroll}
        contentContainerStyle={styles.previewContent}
        maximumZoomScale={3}
        minimumZoomScale={1}
        showsVerticalScrollIndicator={false}
      >
        {pages[activePage] ? (
          <View style={styles.pageCard}>
            <Image
              source={{ uri: pages[activePage] }}
              style={styles.pageImage}
              resizeMode="contain"
            />
          </View>
        ) : (
          <Text style={styles.emptyPreview}>No preview available</Text>
        )}
      </ScrollView>

      <DocumentViewerToolbar actions={toolbarActions} />

      <MoveFolderSheet
        visible={moveOpen}
        folders={folders}
        selectedId={document.folderId}
        onClose={() => setMoveOpen(false)}
        onSelect={handleMove}
      />

      {/* Overflow menu */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)}>
          <View style={[styles.menuSheet, { marginTop: insets.top + 52 }]}>
            <Pressable
              style={styles.menuRow}
              onPress={() => {
                setMenuOpen(false);
                setMoveOpen(true);
              }}
            >
              <Icon name="drive-file-move" size={22} className="text-primary" />
              <Text style={styles.menuText}>Move to Folder</Text>
            </Pressable>
            <Pressable
              style={styles.menuRow}
              onPress={() => {
                setMenuOpen(false);
                handleOcr();
              }}
            >
              <Icon name="description" size={22} className="text-primary" />
              <Text style={styles.menuText}>Extract OCR Text</Text>
            </Pressable>
            <Pressable
              style={[styles.menuRow, styles.menuRowDanger]}
              onPress={() => {
                setMenuOpen(false);
                handleDelete();
              }}
            >
              <Icon name="delete" size={22} className="text-error" />
              <Text style={[styles.menuText, styles.menuTextDanger]}>Delete Document</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f7f9fb',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f7f9fb',
  },
  emptyText: {
    color: '#3d4947',
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    marginBottom: 16,
  },
  emptyBtn: {
    backgroundColor: '#00685f',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyBtnText: {
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e3e5',
  },
  headerIconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    paddingHorizontal: 4,
  },
  headerTitle: {
    color: '#191c1e',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  },
  headerSub: {
    color: '#3d4947',
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tagBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f2f4f6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 2,
  },
  tagText: {
    color: '#3d4947',
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
  },
  thumbStrip: {
    maxHeight: 96,
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e3e5',
  },
  thumbRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  thumbItem: {
    alignItems: 'center',
  },
  thumbFrame: {
    width: 48,
    height: 64,
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: '#eceef0',
  },
  thumbFrameActive: {
    borderColor: '#00685f',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  thumbNum: {
    marginTop: 4,
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: '#3d4947',
  },
  thumbNumActive: {
    color: '#00685f',
    fontFamily: 'Inter_600SemiBold',
  },
  previewScroll: {
    flex: 1,
    backgroundColor: '#f7f9fb',
  },
  previewContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 140,
  },
  pageCard: {
    width: SCREEN_W - 32,
    minHeight: SCREEN_W * 1.25,
    backgroundColor: '#fff',
    borderRadius: 4,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  pageImage: {
    width: '100%',
    height: '100%',
    minHeight: SCREEN_W * 1.25,
  },
  emptyPreview: {
    color: '#3d4947',
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'flex-end',
    paddingRight: 12,
  },
  menuSheet: {
    backgroundColor: '#f7f9fb',
    borderRadius: 12,
    minWidth: 220,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e3e5',
  },
  menuRowDanger: {
    borderBottomWidth: 0,
  },
  menuText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: '#191c1e',
  },
  menuTextDanger: {
    color: '#ba1a1a',
  },
});
