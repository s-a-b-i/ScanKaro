import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState, useMemo } from 'react';
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
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeColors, useTheme } from '../../constants/theme';

import { MoveFolderSheet } from '../../components/CreateFolderSheet';
import { DocumentViewerToolbar } from '../../components/document/DocumentViewerToolbar';
import { Icon } from '../../components/Icon';
import { GlassBackground } from '../../components/Glass';
import { KeyboardAvoid } from '../../components/KeyboardAvoid';
import { DocumentDetailsSheet } from '../../components/DocumentDetailsSheet';
import { PasswordSheet } from '../../components/PasswordSheet';
import { printPages } from '../../utils/print';
import { pageSizeFor } from '../../utils/pageShape';
import { daysUntil, expiryLabel } from '../../utils/reminders';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import { useApp } from '../../context/AppProvider';
import { useDeleteWithUndo } from '../../hooks/useDeleteWithUndo';
import { useScan } from '../../context/ScanProvider';
import { getDocumentById } from '../../services';
import { DocumentItem } from '../../types';
import { goBackOr } from '../../utils/navigation';
import { imagesToPdf, PdfFileSize, protectPdf, sharePdf } from '../../utils/pdf';

const { width: SCREEN_W } = Dimensions.get('window');

export default function DocumentViewerScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { folders, moveDocumentToFolder, toggleFavorite, renameDocument, refreshDocuments } =
    useApp();
  const { setDocumentId, setTitle, setFolderId, reset } = useScan();

  const [document, setDocument] = useState<DocumentItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState(0);
  const [moveOpen, setMoveOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameText, setRenameText] = useState('');
  const [sharing, setSharing] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const deleteWithUndo = useDeleteWithUndo();
  const [lockOpen, setLockOpen] = useState(false);

  const reload = async () => {
    if (!id) return;
    const doc = await getDocumentById(id);
    setDocument(doc);
  };

  // Pick up changes made elsewhere (Manage pages, Add page) when returning here.
  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      void getDocumentById(id).then((doc) => {
        setDocument(doc);
        setActivePage((p) => Math.min(p, Math.max(0, (doc?.pages ?? 1) - 1)));
      });
    }, [id]),
  );

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
        <ActivityIndicator size="large" color="#8e8e93" />
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

  const handleShare = () => {
    if (pages.length === 0) return;
    Alert.alert('Share as PDF', 'Choose the file size.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Smaller file', onPress: () => void sharePdfOfSize('smaller') },
      { text: 'Standard quality', onPress: () => void sharePdfOfSize('standard') },
    ]);
  };

  const sharePdfOfSize = async (size: PdfFileSize) => {
    setSharing(true);
    try {
      // Share the whole document as one PDF (save to Files/Drive, send, print).
      const pdf = await imagesToPdf(pages, {
        title: document.title,
        // Receipts get pages cut to their own shape.
        pageSize: await pageSizeFor(pages),
        size,
        searchable: true,
      });
      setSharing(false);
      await sharePdf(pdf);
    } catch (error) {
      setSharing(false);
      Alert.alert('Could not share', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  /** Shares the document as a password-protected PDF. */
  const shareLocked = async (password: string) => {
    setLockOpen(false);
    setSharing(true);
    try {
      const pdf = await imagesToPdf(pages, {
        title: document.title,
        pageSize: await pageSizeFor(pages),
        searchable: true,
      });
      const locked = await protectPdf(pdf.uri, password, document.title);
      setSharing(false);
      await sharePdf(locked);
    } catch (error) {
      setSharing(false);
      Alert.alert('Could not share', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const printAs = async (perSheet: 1 | 2 | 4) => {
    setSharing(true);
    try {
      await printPages(pages, document.title, perSheet);
    } catch (error) {
      Alert.alert('Could not print', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSharing(false);
    }
  };

  const handlePrint = () => {
    if (pages.length <= 1) {
      void printAs(1);
      return;
    }
    // Tap outside to cancel (Android shows at most three buttons).
    Alert.alert(
      'Print',
      'How many pages on each sheet of paper?',
      [
        { text: '1 per sheet', onPress: () => void printAs(1) },
        { text: '2 per sheet', onPress: () => void printAs(2) },
        { text: '4 per sheet', onPress: () => void printAs(4) },
      ],
      { cancelable: true },
    );
  };

  const openRename = () => {
    setRenameText(document.title);
    setRenameOpen(true);
  };

  const handleRename = async () => {
    const title = renameText.trim();
    setRenameOpen(false);
    if (!title || title === document.title) return;
    await renameDocument(document.id, title);
    await reload();
  };

  const handleMove = async (folderId: string | null) => {
    setMoveOpen(false);
    await moveDocumentToFolder(document.id, folderId);
    await reload();
  };

  const handleDelete = () => {
    // Undoable: the banner on the previous screen offers Undo.
    goBackOr(router, '/(tabs)');
    void deleteWithUndo([document.id]);
  };

  const handleAddPage = () => {
    reset();
    setDocumentId(document.id);
    setTitle(document.title);
    if (document.folderId) setFolderId(document.folderId);
    router.push('/scan');
  };

  const toolbarActions = [
    { icon: 'add-a-photo' as const, label: 'Add page', onPress: handleAddPage },
    { icon: 'auto-awesome-motion' as const, label: 'Pages', onPress: () => router.push(`/manage-pages/${document.id}`) },
    { icon: 'picture-as-pdf' as const, label: 'Share PDF', onPress: handleShare, primary: true },
    { icon: 'text-snippet' as const, label: 'Text', onPress: handleOcr },
    {
      icon: 'draw' as const,
      label: 'Sign',
      onPress: () => router.push({ pathname: '/annotate/[id]', params: { id: document.id, page: String(activePage) } }),
    },
  ];

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <GlassBackground radius={28} />
        <Pressable accessibilityLabel="Back" onPress={() => goBackOr(router, '/(tabs)')} style={styles.headerIconBtn}>
          <Icon name="arrow-back" size={24} className="text-on-surface" />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {document.title}
          </Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {document.pages} Page{document.pages === 1 ? '' : 's'}
            {document.expiresAt ? (
              <Text style={daysUntil(document.expiresAt) <= 30 ? styles.expiringSoon : undefined}>
                {'  ·  '}
                {expiryLabel(document.expiresAt)}
              </Text>
            ) : null}
          </Text>
        </View>

        <View style={styles.headerRight}>
          <Pressable
            onPress={() => setDetailsOpen(true)}
            accessibilityLabel="Tags and expiry date"
            style={styles.tagBtn}
          >
            <Icon name="label" size={16} className={document.tags.length ? 'text-primary' : 'text-on-surface-variant'} />
            <Text style={styles.tagText} numberOfLines={1}>
              {document.tags.length ? document.tags.slice(0, 2).join(', ') : 'Tag +'}
            </Text>
          </Pressable>
          <Pressable accessibilityLabel="More options" onPress={() => setMenuOpen(true)} style={styles.headerIconBtn}>
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

      <LoadingOverlay visible={sharing} message="Creating PDF…" />

      {/* Rename */}
      <Modal visible={renameOpen} transparent animationType="fade" onRequestClose={() => setRenameOpen(false)}>
        <KeyboardAvoid inModal className="flex-1 justify-end bg-black/50">
          <Pressable className="flex-1" onPress={() => setRenameOpen(false)} />
          <View
            className="overflow-hidden rounded-t-[32px] px-5 pt-3"
            style={{ paddingBottom: insets.bottom + 20 }}
          >
              <GlassBackground radius={32} variant="sheet" topOnly />
            <View className="mb-4 h-1 w-10 self-center rounded-full bg-outline-variant" />
            <Text className="mb-4 font-inter-semibold text-[22px] tracking-[-0.4px] text-on-surface">Rename</Text>
            <TextInput
              value={renameText}
              onChangeText={setRenameText}
              autoFocus
              selectTextOnFocus
              onSubmitEditing={() => void handleRename()}
              placeholder="Document name"
              placeholderTextColor={`${colors['on-surface-variant']}99`}
              className="h-14 rounded-2xl bg-surface-container px-4 font-inter text-[17px] text-on-surface"
            />
            <Pressable
              onPress={() => void handleRename()}
              className="mt-4 h-14 items-center justify-center rounded-full bg-on-surface active:opacity-85"
            >
              <Text className="font-inter-semibold text-[17px] text-surface">Save</Text>
            </Pressable>
          </View>
        </KeyboardAvoid>
      </Modal>

      <DocumentDetailsSheet
        document={document}
        visible={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        onSaved={() => {
          void reload();
          void refreshDocuments();
        }}
      />

      <PasswordSheet
        visible={lockOpen}
        title="Share with password"
        subtitle={document.title}
        actionLabel="Lock and share"
        onCancel={() => setLockOpen(false)}
        onSubmit={(pw) => void shareLocked(pw)}
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
                openRename();
              }}
            >
              <Icon name="drive-file-rename-outline" size={22} className="text-primary" />
              <Text style={styles.menuText}>Rename</Text>
            </Pressable>
            <Pressable
              style={styles.menuRow}
              onPress={() => {
                setMenuOpen(false);
                handleOcr();
              }}
            >
              <Icon name="description" size={22} className="text-primary" />
              <Text style={styles.menuText}>Extract Text</Text>
            </Pressable>
            <Pressable
              style={styles.menuRow}
              onPress={() => {
                setMenuOpen(false);
                setDetailsOpen(true);
              }}
            >
              <Icon name="event" size={22} className="text-primary" />
              <Text style={styles.menuText}>Tags & Expiry</Text>
            </Pressable>
            <Pressable
              style={styles.menuRow}
              onPress={() => {
                setMenuOpen(false);
                handlePrint();
              }}
            >
              <Icon name="print" size={22} className="text-primary" />
              <Text style={styles.menuText}>Print</Text>
            </Pressable>
            <Pressable
              style={styles.menuRow}
              onPress={() => {
                setMenuOpen(false);
                setLockOpen(true);
              }}
            >
              <Icon name="lock" size={22} className="text-primary" />
              <Text style={styles.menuText}>Share with Password</Text>
            </Pressable>
            <Pressable
              style={styles.menuRow}
              onPress={() => {
                setMenuOpen(false);
                void toggleFavorite(document.id).then(reload);
              }}
            >
              <Icon name={document.favorite ? 'star' : 'star-border'} size={22} className="text-primary" />
              <Text style={styles.menuText}>{document.favorite ? 'Remove from Favorites' : 'Add to Favorites'}</Text>
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

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: c.background,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.background,
  },
  emptyText: {
    color: c['on-surface-variant'],
    fontFamily: 'InterTight_400Regular',
    fontSize: 16,
    marginBottom: 16,
  },
  emptyBtn: {
    backgroundColor: c.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyBtnText: {
    color: c['on-primary'],
    fontFamily: 'InterTight_600SemiBold',
    fontSize: 15,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 10,
    // Glass header: rounded bottom corners, glass background added in the view.
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
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
    color: c['on-surface'],
    fontFamily: 'InterTight_600SemiBold',
    fontSize: 16,
  },
  headerSub: {
    color: c['on-surface-variant'],
    fontFamily: 'InterTight_400Regular',
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
    backgroundColor: 'rgba(127,127,127,0.14)',
    paddingHorizontal: 12,
    minHeight: 36,
    borderRadius: 18,
    marginRight: 2,
    maxWidth: 130,
  },
  expiringSoon: {
    color: '#c81e1e',
    fontFamily: 'InterTight_600SemiBold',
  },
  tagText: {
    color: c['on-surface-variant'],
    fontFamily: 'InterTight_500Medium',
    fontSize: 12,
  },
  thumbStrip: {
    maxHeight: 96,
    backgroundColor: c['surface-container-lowest'],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c['outline-variant'],
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
    backgroundColor: c['surface-container'],
  },
  thumbFrameActive: {
    borderColor: c.primary,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  thumbNum: {
    marginTop: 4,
    fontFamily: 'InterTight_400Regular',
    fontSize: 11,
    color: c['on-surface-variant'],
  },
  thumbNumActive: {
    color: c.primary,
    fontFamily: 'InterTight_600SemiBold',
  },
  previewScroll: {
    flex: 1,
    backgroundColor: c.background,
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
    backgroundColor: c['surface-container-lowest'],
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
    color: c['on-surface-variant'],
    fontFamily: 'InterTight_400Regular',
    fontSize: 15,
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'flex-end',
    paddingRight: 12,
  },
  menuSheet: {
    backgroundColor: c.background,
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
    borderBottomColor: c['outline-variant'],
  },
  menuRowDanger: {
    borderBottomWidth: 0,
  },
  menuText: {
    fontFamily: 'InterTight_400Regular',
    fontSize: 15,
    color: c['on-surface'],
  },
  menuTextDanger: {
    color: c.error,
  },
});
