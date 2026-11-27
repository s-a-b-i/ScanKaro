import { File } from 'expo-file-system';
import { useRouter } from 'expo-router';
import { ComponentProps, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../components/Icon';
import { GlassBackground } from '../components/Glass';
import { KeyboardAvoid } from '../components/KeyboardAvoid';
import { SearchField } from '../components/SearchField';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { useTabBarInset } from '../components/ui';
import { pastel, PastelName } from '../constants/pastel';
import { useTheme } from '../constants/theme';
import { goBackOr } from '../utils/navigation';
import {
  baseName,
  extractPages,
  formatBytes,
  getPdfInfo,
  getPdfPageCount,
  PAPER_SIZES,
  PaperSize,
  PdfInfo,
  resizePdf,
  setPdfInfo,
  imagesToPdf,
  mergePdfs,
  numberPdfPages,
  parsePageRanges,
  PDF_PAGE_SIZES,
  PdfFile,
  PdfPageSize,
  pickPdfs,
  protectPdf,
  rotatePdf,
  sharePdf,
  splitPdf,
  watermarkPdf,
} from '../utils/pdf';
import { PDF_PASSWORD_RULE } from '../utils/pdfEncrypt';
import { compressPdf } from '../utils/pdfRender';
import { pdfPageImages, pdfToImages, shareImagesResult } from '../utils/pdfToImages';
import { pickImages } from '../utils/scanPicker';
import { DocumentPickerSheet } from '../components/DocumentPickerSheet';
import { useScan } from '../context/ScanProvider';
import { localDocumentService } from '../services/local/library';
import type { DocumentItem } from '../types';
import { shareDocx } from '../utils/docx';
import { pdfToLongImage, shareLongImage } from '../utils/longImage';
import { OCR_LANGUAGES, recognizePages } from '../utils/ocr';
import { shareAsExcel, shareAsPptx } from '../utils/office';
import { printPages } from '../utils/print';

type IconName = ComponentProps<typeof Icon>['name'];

type EditKind = 'rotate' | 'watermark' | 'protect' | 'info' | 'resize';

/** Tools that start by picking a saved document. */
type DocTool = 'translate' | 'ocr' | 'word' | 'excel' | 'ppt' | 'long' | 'sign' | 'erase' | 'noMarks' | 'reorder' | 'print';

const DOC_TOOL_TITLES: Record<DocTool, string> = {
  translate: 'Translate…',
  ocr: 'Extract text from…',
  word: 'Convert to Word…',
  excel: 'Convert to Excel…',
  ppt: 'Convert to PowerPoint…',
  long: 'Make a long image of…',
  sign: 'Sign…',
  erase: 'Erase parts of…',
  noMarks: 'Remove pen marks from…',
  reorder: 'Reorder pages of…',
  print: 'Print…',
};

const EDIT_TITLES: Record<EditKind, { title: string; action: string }> = {
  rotate: { title: 'Rotate pages', action: 'Rotate' },
  watermark: { title: 'Watermark', action: 'Add watermark' },
  protect: { title: 'Password protect', action: 'Lock PDF' },
  info: { title: 'Document info', action: 'Save info' },
  resize: { title: 'Page size', action: 'Change size' },
};

const today = () => new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

/** Lets the loading overlay paint before CPU work starts. */
const nextFrame = () => new Promise((resolve) => setTimeout(resolve, 60));

type ToolSection = 'Scan' | 'Import' | 'Convert' | 'Edit' | 'Utilities';
const TOOL_SECTIONS: ToolSection[] = ['Scan', 'Import', 'Convert', 'Edit', 'Utilities'];

type Tool = {
  key: string;
  label: string;
  icon: IconName;
  color: PastelName;
  section: ToolSection;
  /** Extra words people might search for. */
  keywords?: string;
  onPress: () => void;
};

/** One tool in the 4-column grid: tonal circle icon with a short label under it. */
function ToolCell({ tool }: { tool: Tool }) {
  const { isDark } = useTheme();
  return (
    <Pressable
      onPress={tool.onPress}
      accessibilityRole="button"
      accessibilityLabel={tool.label}
      className="w-1/4 items-center px-1 pb-4 pt-2 active:opacity-60"
    >
      <View
        className="h-[52px] w-[52px] items-center justify-center rounded-full"
        style={{ backgroundColor: pastel(tool.color, isDark) }}
      >
        <Icon name={tool.icon} size={24} className="text-on-surface" />
      </View>
      <Text
        className="mt-2 text-center font-inter-medium text-[12.5px] leading-[16px] text-on-surface"
        numberOfLines={2}
      >
        {tool.label}
      </Text>
    </Pressable>
  );
}

/** The PDF tools route (opened from links); the Tools tab shows the same screen. */
export default function PdfToolsRoute() {
  return <PdfToolsScreen />;
}

/** All tools. In the Tools tab: no back button, a Scan & QR section, room for the tab bar. */
export function PdfToolsScreen({ inTab = false }: { inTab?: boolean }) {
  const tabInset = useTabBarInset();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [pageSize, setPageSize] = useState<PdfPageSize>('a4');
  const [busy, setBusy] = useState<string | null>(null);
  const [docTool, setDocTool] = useState<DocTool | null>(null);
  const [toolQuery, setToolQuery] = useState('');
  const [toolSection, setToolSection] = useState<'All' | ToolSection>('All');
  const { addPage, reset: resetScan } = useScan();
  const scanMode = (mode: string) => router.push({ pathname: '/scan', params: { mode } });
  const [results, setResults] = useState<PdfFile[] | null>(null);
  const [extractSource, setExtractSource] = useState<{ uri: string; name: string; pages: number } | null>(null);
  const [ranges, setRanges] = useState('');
  const [savings, setSavings] = useState<{ before: number; after: number } | null>(null);
  // Images to PDF review: chosen photos (in page order) and the file name.
  const [review, setReview] = useState<string[] | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [pdfTitle, setPdfTitle] = useState('');
  // Rotate / Watermark: the chosen PDF and its options.
  const [edit, setEdit] = useState<{
    kind: EditKind;
    uri: string;
    name: string;
    pages: number;
  } | null>(null);
  const [angle, setAngle] = useState<90 | 180 | 270>(90);
  const [editPages, setEditPages] = useState('');
  const [watermark, setWatermark] = useState('CONFIDENTIAL');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [info, setInfo] = useState<PdfInfo>({ title: '', author: '', subject: '', keywords: '' });
  const [paper, setPaper] = useState<PaperSize>('a4');

  /** Runs a tool with a progress overlay and shows its output files. */
  const run = async (message: string, task: () => Promise<PdfFile[]>) => {
    setBusy(message);
    setSavings(null);
    try {
      await nextFrame();
      setResults(await task());
    } catch (error) {
      Alert.alert('Something went wrong', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  /** Step 1: pick photos, then review them (order, remove, name) before creating the PDF. */
  const handleImagesToPdf = async () => {
    // Pick first: Android will not open the gallery while a modal is showing.
    const images = await pickImages();
    if (images.length === 0) return;
    setReview(images);
    setPdfTitle(`Images ${today()}`);
    setReviewOpen(true);
  };

  const addMoreImages = async () => {
    // Close the sheet so Android lets the gallery open, then bring it back.
    setReviewOpen(false);
    await nextFrame();
    const more = await pickImages();
    setReview((current) => [...(current ?? []), ...more]);
    setReviewOpen(true);
  };

  const moveImage = (from: number, to: number) => {
    setReview((current) => {
      if (!current || to < 0 || to >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const removeImage = (index: number) => {
    setReview((current) => current?.filter((_, i) => i !== index) ?? null);
  };

  /** Step 2: build the PDF from the reviewed photos. */
  const createPdfFromReview = async () => {
    const images = review ?? [];
    if (images.length === 0) return;
    setReviewOpen(false);
    setReview(null);
    await run(`Creating PDF from ${images.length} image${images.length === 1 ? '' : 's'}…`, async () => [
      await imagesToPdf(images, {
        title: pdfTitle.trim() || `Images ${today()}`,
        pageSize,
        searchable: true,
        onProgress: (done, total) => setBusy(`Adding page ${done} of ${total}…`),
      }),
    ]);
  };

  const handleOpenPdf = async () => {
    const [pdf] = await pickPdfs(false);
    if (!pdf) return;
    router.push({ pathname: '/pdf-viewer', params: { uri: pdf.uri, name: pdf.name } });
  };

  const handleCompress = async () => {
    const [pdf] = await pickPdfs(false);
    if (!pdf) return;
    const before = new File(pdf.uri).size;
    await run('Compressing…', async () => {
      const pageCount = await getPdfPageCount(pdf.uri);
      const result = await compressPdf(pdf.uri, pdf.name, pageCount, (done, total) =>
        setBusy(`Compressing… ${Math.round((done / total) * 100)}%`),
      );
      if (before > 0 && result.size >= before) {
        Alert.alert('Already compact', 'This PDF is already small, so the compressed copy is not smaller.');
      }
      setSavings(before > 0 ? { before, after: result.size } : null);
      return [result];
    });
  };

  const handleMerge = async () => {
    const pdfs = await pickPdfs(true);
    if (pdfs.length === 0) return;
    if (pdfs.length === 1) {
      Alert.alert('Pick more files', 'Select at least two PDFs to merge.');
      return;
    }
    await run(`Merging ${pdfs.length} PDFs…`, async () => [
      await mergePdfs(
        pdfs.map((p) => p.uri),
        `Merged ${today()}`,
      ),
    ]);
  };

  const handleSplit = async () => {
    const [pdf] = await pickPdfs(false);
    if (!pdf) return;
    await run('Splitting pages…', () => splitPdf(pdf.uri, baseName(pdf.name)));
  };

  const handleExtractPick = async () => {
    const [pdf] = await pickPdfs(false);
    if (!pdf) return;
    try {
      const pages = await getPdfPageCount(pdf.uri);
      setRanges('');
      setExtractSource({ ...pdf, pages });
    } catch (error) {
      Alert.alert('Could not open PDF', error instanceof Error ? error.message : 'This file could not be read.');
    }
  };

  const handleExtract = async () => {
    if (!extractSource) return;
    let indices: number[];
    try {
      indices = parsePageRanges(ranges, extractSource.pages);
    } catch (error) {
      Alert.alert('Check the pages', error instanceof Error ? error.message : 'Invalid page list.');
      return;
    }
    const source = extractSource;
    setExtractSource(null);
    await run('Extracting pages…', async () => [
      await extractPages(source.uri, indices, `${baseName(source.name)} (pages ${ranges.replace(/\s+/g, '')})`),
    ]);
  };

  const handleEditPick = async (kind: EditKind) => {
    const [pdf] = await pickPdfs(false);
    if (!pdf) return;
    try {
      const pages = await getPdfPageCount(pdf.uri);
      if (kind === 'info') {
        const current = await getPdfInfo(pdf.uri);
        setInfo({ title: current.title, author: current.author, subject: current.subject, keywords: current.keywords });
      }
      setEditPages('');
      setPassword('');
      setPassword2('');
      setShowPassword(false);
      setEdit({ kind, ...pdf, pages });
    } catch (error) {
      Alert.alert('Could not open PDF', error instanceof Error ? error.message : 'This file could not be read.');
    }
  };

  const handleEditApply = async () => {
    if (!edit) return;
    const source = edit;
    const title = baseName(source.name);
    if (source.kind === 'rotate') {
      let indices: number[] | null = null;
      if (editPages.trim()) {
        try {
          indices = parsePageRanges(editPages, source.pages);
        } catch (error) {
          Alert.alert('Check the pages', error instanceof Error ? error.message : 'Invalid page list.');
          return;
        }
      }
      setEdit(null);
      await run('Rotating pages…', async () => [await rotatePdf(source.uri, indices, angle, `${title} (rotated)`)]);
    } else if (source.kind === 'info') {
      setEdit(null);
      await run('Saving info…', async () => [await setPdfInfo(source.uri, info, title)]);
    } else if (source.kind === 'resize') {
      setEdit(null);
      const label = PAPER_SIZES.find((p) => p.key === paper)!.label;
      await run('Changing page size…', async () => [await resizePdf(source.uri, paper, `${title} (${label})`)]);
    } else if (source.kind === 'protect') {
      if (!PDF_PASSWORD_RULE.test(password)) {
        Alert.alert('Check the password', 'Use 4–32 characters: English letters, numbers and symbols.');
        return;
      }
      if (password !== password2) {
        Alert.alert('Passwords do not match', 'Type the same password twice.');
        return;
      }
      setEdit(null);
      await run('Adding password…', async () => [await protectPdf(source.uri, password, `${title} (protected)`)]);
    } else {
      if (!watermark.trim()) {
        Alert.alert('Add text', 'Type the watermark text.');
        return;
      }
      setEdit(null);
      await run('Adding watermark…', async () => [await watermarkPdf(source.uri, watermark, `${title} (watermarked)`)]);
    }
  };

  const handleToImages = async () => {
    const [pdf] = await pickPdfs(false);
    if (!pdf) return;
    setBusy('Converting pages…');
    try {
      await nextFrame();
      const result = await pdfToImages(pdf.uri, pdf.name, (done, total) =>
        setBusy(`Converting page ${done} of ${total}…`),
      );
      setBusy(null);
      await shareImagesResult(result);
    } catch (error) {
      setBusy(null);
      Alert.alert('Could not convert', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const handleNumbers = async () => {
    const [pdf] = await pickPdfs(false);
    if (!pdf) return;
    await run('Numbering pages…', async () => [await numberPdfPages(pdf.uri, `${baseName(pdf.name)} (numbered)`)]);
  };

  /** Runs a tool that ends in the share sheet (no result list). */
  const runShare = async (message: string, task: () => Promise<void>) => {
    setBusy(message);
    try {
      await nextFrame();
      await task();
    } catch (error) {
      Alert.alert('Something went wrong', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  /** Starts a new scan from ready-made page images, then opens Enhance. */
  const startScanWith = (uris: string[], filter?: string) => {
    resetScan();
    uris.forEach((uri) => addPage(uri));
    router.push(filter ? { pathname: '/enhance', params: { filter } } : '/enhance');
  };

  const handleImportImages = async () => {
    const images = await pickImages();
    if (images.length > 0) startScanWith(images);
  };

  const handleImportFile = async () => {
    const [pdf] = await pickPdfs(false);
    if (!pdf) return;
    await runShare('Importing PDF…', async () => {
      const pages = await pdfPageImages(pdf.uri, (done, total) => setBusy(`Importing page ${done} of ${total}…`));
      startScanWith(pages, 'original');
    });
  };

  const handleLongImage = async () => {
    const [pdf] = await pickPdfs(false);
    if (!pdf) return;
    await runShare('Making a long image…', () =>
      pdfToLongImage(pdf.uri, pdf.name, (done, total) => setBusy(`Adding page ${done} of ${total}…`)),
    );
  };

  /** Tools that work on a saved document: pick it first. */
  const pickDoc = (kind: DocTool) => setDocTool(kind);

  const runDocTool = async (picked: DocumentItem) => {
    const kind = docTool;
    setDocTool(null);
    if (!kind) return;
    const doc = await localDocumentService.getById(picked.id);
    const pages = doc?.pageUrls ?? [];
    if (!doc || pages.length === 0) {
      Alert.alert('Document not found', 'This document has no pages.');
      return;
    }
    switch (kind) {
      case 'ocr':
        router.push({ pathname: '/ocr', params: { documentId: doc.id } });
        return;
      case 'translate':
        router.push({ pathname: '/translate', params: { documentId: doc.id } });
        return;
      case 'sign':
      case 'erase':
        router.push({ pathname: '/annotate/[id]', params: { id: doc.id, page: '0', tool: kind } });
        return;
      case 'reorder':
        router.push(`/manage-pages/${doc.id}`);
        return;
      case 'noMarks':
        startScanWith(pages, 'noMarks');
        return;
      case 'print':
        await runShare('Preparing to print…', () => printPages(pages, doc.title, 1));
        return;
      case 'word':
        await runShare('Reading text…', async () => {
          const text =
            doc.ocrText?.trim() ||
            (await recognizePages(pages, OCR_LANGUAGES[0], (done, total) => setBusy(`Reading page ${done} of ${total}…`)));
          if (!text.trim()) throw new Error('No text was found in this document.');
          await shareDocx(text, doc.title);
        });
        return;
      case 'excel':
        await runShare('Finding tables…', () =>
          shareAsExcel(pages, doc.title, (done, total) => setBusy(`Reading page ${done} of ${total}…`)),
        );
        return;
      case 'ppt':
        await runShare('Making slides…', () => shareAsPptx(pages, doc.title));
        return;
      case 'long':
        await runShare('Making a long image…', () => shareLongImage(pages, doc.title));
        return;
    }
  };

  const share = async (file: PdfFile) => {
    try {
      await sharePdf(file);
    } catch (error) {
      Alert.alert('Could not share', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const tools: Tool[] = [
    // Scan
    { key: 'scan', label: 'Scan to PDF', icon: 'document-scanner', color: 'blue', section: 'Scan', keywords: 'camera pdf', onPress: () => router.push('/scan') },
    { key: 'id', label: 'ID cards', icon: 'badge', color: 'green', section: 'Scan', keywords: 'cnic passport license', onPress: () => scanMode('id') },
    { key: 'ocr', label: 'Extract text', icon: 'text-snippet', color: 'yellow', section: 'Scan', keywords: 'ocr copy', onPress: () => pickDoc('ocr') },
    { key: 'idphoto', label: 'ID photo', icon: 'portrait', color: 'pink', section: 'Scan', keywords: 'passport visa picture', onPress: () => router.push('/id-photo') },
    { key: 'translate', label: 'Translate photo', icon: 'translate', color: 'blue', section: 'Scan', keywords: 'urdu language', onPress: () => router.push('/translate') },
    { key: 'translateDoc', label: 'Translate doc', icon: 'g-translate', color: 'green', section: 'Scan', keywords: 'urdu language document', onPress: () => pickDoc('translate') },
    { key: 'book', label: 'Book', icon: 'menu-book', color: 'yellow', section: 'Scan', keywords: 'pages spread', onPress: () => scanMode('book') },
    { key: 'board', label: 'Whiteboard', icon: 'developer-board', color: 'pink', section: 'Scan', keywords: 'board class', onPress: () => scanMode('whiteboard') },
    { key: 'slides', label: 'Slides', icon: 'slideshow', color: 'blue', section: 'Scan', keywords: 'screen projector', onPress: () => scanMode('slides') },
    { key: 'time', label: 'Timestamp', icon: 'schedule', color: 'green', section: 'Scan', keywords: 'date time', onPress: () => scanMode('timestamp') },
    { key: 'receipt', label: 'Receipt', icon: 'receipt-long', color: 'yellow', section: 'Scan', keywords: 'bill', onPress: () => scanMode('receipt') },
    { key: 'card', label: 'Business card', icon: 'contact-page', color: 'pink', section: 'Scan', keywords: 'contact visiting', onPress: () => scanMode('card') },
    { key: 'qr', label: 'QR scanner', icon: 'qr-code-scanner', color: 'blue', section: 'Scan', keywords: 'barcode wifi', onPress: () => router.push('/qr') },
    // Import
    { key: 'img2pdf', label: 'Images to PDF', icon: 'picture-as-pdf', color: 'yellow', section: 'Import', keywords: 'photos jpg', onPress: () => void handleImagesToPdf() },
    { key: 'importImg', label: 'Import images', icon: 'photo-library', color: 'green', section: 'Import', keywords: 'gallery photos', onPress: () => void handleImportImages() },
    { key: 'importPdf', label: 'Import PDF', icon: 'upload-file', color: 'blue', section: 'Import', keywords: 'file', onPress: () => void handleImportFile() },
    { key: 'openPdf', label: 'Open PDF', icon: 'chrome-reader-mode', color: 'pink', section: 'Import', keywords: 'view read', onPress: () => void handleOpenPdf() },
    // Convert
    { key: 'word', label: 'To Word', icon: 'description', color: 'blue', section: 'Convert', keywords: 'docx', onPress: () => pickDoc('word') },
    { key: 'excel', label: 'To Excel', icon: 'table-chart', color: 'green', section: 'Convert', keywords: 'xlsx sheet table', onPress: () => pickDoc('excel') },
    { key: 'ppt', label: 'To PPT', icon: 'slideshow', color: 'pink', section: 'Convert', keywords: 'pptx powerpoint slides', onPress: () => pickDoc('ppt') },
    { key: 'pdf2img', label: 'PDF to images', icon: 'collections', color: 'yellow', section: 'Convert', keywords: 'jpg', onPress: () => void handleToImages() },
    { key: 'long', label: 'Long image', icon: 'view-day', color: 'blue', section: 'Convert', keywords: 'pdf stitch', onPress: () => void handleLongImage() },
    { key: 'compress', label: 'Compress', icon: 'compress', color: 'green', section: 'Convert', keywords: 'pdf smaller size', onPress: () => void handleCompress() },
    // Edit
    { key: 'sign', label: 'Sign', icon: 'gesture', color: 'green', section: 'Edit', keywords: 'signature', onPress: () => pickDoc('sign') },
    { key: 'watermark', label: 'Watermark', icon: 'branding-watermark', color: 'blue', section: 'Edit', keywords: 'pdf stamp', onPress: () => void handleEditPick('watermark') },
    { key: 'erase', label: 'Smart erase', icon: 'auto-fix-normal', color: 'yellow', section: 'Edit', keywords: 'remove', onPress: () => pickDoc('erase') },
    { key: 'noMarks', label: 'Erase pen marks', icon: 'format-color-reset', color: 'pink', section: 'Edit', keywords: 'ink handwriting remove', onPress: () => pickDoc('noMarks') },
    { key: 'restore', label: 'Restore photo', icon: 'auto-fix-high', color: 'yellow', section: 'Edit', keywords: 'old faded', onPress: () => router.push('/restore-photo') },
    { key: 'reorder', label: 'Reorder pages', icon: 'swap-vert', color: 'blue', section: 'Edit', keywords: 'move order', onPress: () => pickDoc('reorder') },
    { key: 'merge', label: 'Merge PDFs', icon: 'call-merge', color: 'green', section: 'Edit', keywords: 'combine join', onPress: () => void handleMerge() },
    { key: 'split', label: 'Split PDF', icon: 'call-split', color: 'yellow', section: 'Edit', keywords: 'separate', onPress: () => void handleSplit() },
    { key: 'extract', label: 'Extract pages', icon: 'content-cut', color: 'pink', section: 'Edit', keywords: 'pdf pages', onPress: () => void handleExtractPick() },
    { key: 'rotate', label: 'Rotate', icon: 'rotate-right', color: 'blue', section: 'Edit', keywords: 'pdf turn', onPress: () => void handleEditPick('rotate') },
    { key: 'resize', label: 'Page size', icon: 'aspect-ratio', color: 'green', section: 'Edit', keywords: 'a4 letter', onPress: () => void handleEditPick('resize') },
    { key: 'numbers', label: 'Page numbers', icon: 'format-list-numbered', color: 'yellow', section: 'Edit', keywords: 'pdf', onPress: () => void handleNumbers() },
    { key: 'lock', label: 'Lock PDF', icon: 'lock', color: 'pink', section: 'Edit', keywords: 'password protect', onPress: () => void handleEditPick('protect') },
    { key: 'info', label: 'Edit info', icon: 'info', color: 'blue', section: 'Edit', keywords: 'title author', onPress: () => void handleEditPick('info') },
    // Utilities
    { key: 'locker', label: 'Locker', icon: 'lock', color: 'blue', section: 'Utilities', keywords: 'private hide vault secret photos files', onPress: () => router.push('/locker') },
    { key: 'qrNew', label: 'Create QR', icon: 'qr-code-2', color: 'yellow', section: 'Utilities', keywords: 'code', onPress: () => router.push('/qr-create') },
    { key: 'history', label: 'Scan history', icon: 'history', color: 'blue', section: 'Utilities', keywords: 'qr codes', onPress: () => router.push('/qr-history') },
    { key: 'print', label: 'Print', icon: 'print', color: 'green', section: 'Utilities', keywords: 'printer', onPress: () => pickDoc('print') },
    { key: 'dupes', label: 'Duplicates', icon: 'filter-none', color: 'pink', section: 'Utilities', keywords: 'same copy', onPress: () => router.push('/duplicates') },
  ];

  const q = toolQuery.trim().toLowerCase();
  const visibleSections = TOOL_SECTIONS.filter((sec) => toolSection === 'All' || sec === toolSection)
    .map((section) => ({
      section,
      items: tools.filter(
        (t) => t.section === section && (!q || `${t.label} ${t.keywords ?? ''}`.toLowerCase().includes(q)),
      ),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <LoadingOverlay visible={!!busy} message={busy ?? ''} />

      {inTab ? (
        <View className="h-4" />
      ) : (
        <View className="h-16 flex-row items-center px-5">
          <Pressable
            onPress={() => goBackOr(router, '/(tabs)')}
            hitSlop={6}
            accessibilityLabel="Back"
            className="h-12 w-12 items-center justify-center overflow-hidden rounded-full active:opacity-70"
          >
            <GlassBackground radius={24} />
            <Icon name="arrow-back" size={22} className="text-on-surface" />
          </Pressable>
        </View>
      )}

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: inTab ? tabInset : insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        <Text className="mt-2 font-inter-semibold text-[34px] leading-[40px] tracking-[-1px] text-on-surface">
          {inTab ? 'Tools' : 'PDF tools'}
        </Text>

        <View className="mb-3 mt-4">
          <SearchField value={toolQuery} onChangeText={setToolQuery} placeholder="Search tools" />
        </View>

        {/* Scope: filter by category. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2"
          className="-mx-5 mb-4"
          contentContainerStyle={{ paddingHorizontal: 20 }}
          style={{ flexGrow: 0 }}
        >
          {(['All', ...TOOL_SECTIONS] as const).map((name) => {
            const active = name === toolSection;
            return (
              <Pressable
                key={name}
                onPress={() => setToolSection(name)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                className={`h-9 justify-center rounded-full px-4 ${
                  active ? 'bg-on-surface' : 'border border-outline-variant/70'
                }`}
              >
                <Text className={`font-inter-semibold text-[14px] ${active ? 'text-surface' : 'text-on-surface'}`}>
                  {name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {visibleSections.length === 0 ? (
          <View className="items-center py-16">
            <Icon name="search-off" size={36} className="text-on-surface-variant" />
            <Text className="mt-3 font-inter-semibold text-[16px] text-on-surface">No tools found</Text>
            <Text className="mt-1 font-inter text-[14px] text-on-surface-variant">Try another word, like "PDF" or "scan".</Text>
          </View>
        ) : (
          visibleSections.map(({ section, items }) => (
            <View key={section} className="mb-3">
              <Text accessibilityRole="header" className="mb-1 mt-2 font-inter-semibold text-[17px] text-on-surface">
                {section}
              </Text>
              <View className="-mx-1 flex-row flex-wrap">
                {items.map((tool) => (
                  <ToolCell key={tool.key} tool={tool} />
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <DocumentPickerSheet
        title={docTool ? DOC_TOOL_TITLES[docTool] : null}
        onCancel={() => setDocTool(null)}
        onPick={(doc) => void runDocTool(doc)}
      />

      {/* Extract pages: choose which pages */}
      <Modal visible={!!extractSource} transparent animationType="fade" onRequestClose={() => setExtractSource(null)}>
        <KeyboardAvoid inModal className="flex-1 justify-end bg-black/50">
          <Pressable className="flex-1" onPress={() => setExtractSource(null)} />
          <View className="overflow-hidden rounded-t-[32px] px-5 pt-3" style={{ paddingBottom: insets.bottom + 20 }}>
            <GlassBackground radius={32} variant="sheet" topOnly />
            <View className="mb-4 h-1 w-10 self-center rounded-full bg-outline-variant" />
            <Text className="font-inter-semibold text-[22px] tracking-[-0.4px] text-on-surface">Extract pages</Text>
            <Text className="mb-4 mt-1 font-inter text-[14px] text-on-surface-variant" numberOfLines={1}>
              {extractSource?.name} · {extractSource?.pages} page{extractSource?.pages === 1 ? '' : 's'}
            </Text>
            <TextInput
              value={ranges}
              onChangeText={setRanges}
              placeholder="e.g. 1-3, 5"
              placeholderTextColor={`${colors['on-surface-variant']}99`}
              keyboardType="numbers-and-punctuation"
              autoFocus
              onSubmitEditing={() => void handleExtract()}
              className="h-14 rounded-2xl bg-surface-container px-4 font-inter text-[17px] text-on-surface"
            />
            <Pressable
              onPress={() => void handleExtract()}
              className="mt-4 h-14 items-center justify-center rounded-full bg-on-surface active:opacity-85"
            >
              <Text className="font-inter-semibold text-[17px] text-surface">Extract</Text>
            </Pressable>
          </View>
        </KeyboardAvoid>
      </Modal>

      {/* Rotate / Watermark options */}
      <Modal visible={!!edit} transparent animationType="fade" onRequestClose={() => setEdit(null)}>
        <KeyboardAvoid inModal className="flex-1 justify-end bg-black/50">
          <Pressable className="flex-1" onPress={() => setEdit(null)} />
          <View className="overflow-hidden rounded-t-[32px] px-5 pt-3" style={{ paddingBottom: insets.bottom + 20 }}>
            <GlassBackground radius={32} variant="sheet" topOnly />
            <View className="mb-4 h-1 w-10 self-center rounded-full bg-outline-variant" />
            <Text className="font-inter-semibold text-[22px] tracking-[-0.4px] text-on-surface">
              {edit ? EDIT_TITLES[edit.kind].title : ''}
            </Text>
            <Text className="mb-4 mt-1 font-inter text-[14px] text-on-surface-variant" numberOfLines={1}>
              {edit?.name} · {edit?.pages} page{edit?.pages === 1 ? '' : 's'}
            </Text>

            {edit?.kind === 'rotate' ? (
              <>
                <View className="flex-row rounded-full bg-surface-container p-1">
                  {(
                    [
                      [90, 'Right 90°'],
                      [180, '180°'],
                      [270, 'Left 90°'],
                    ] as const
                  ).map(([value, label]) => (
                    <Pressable
                      key={value}
                      onPress={() => setAngle(value)}
                      className={`h-10 flex-1 items-center justify-center rounded-full ${angle === value ? 'bg-surface-container-lowest' : ''}`}
                    >
                      <Text
                        className={`text-[14px] ${angle === value ? 'font-inter-semibold text-on-surface' : 'font-inter text-on-surface-variant'}`}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text className="mb-2 mt-4 font-inter-semibold text-[14px] text-on-surface">Pages</Text>
                <TextInput
                  value={editPages}
                  onChangeText={setEditPages}
                  placeholder="All pages (or e.g. 2, 4-5)"
                  placeholderTextColor={`${colors['on-surface-variant']}99`}
                  keyboardType="numbers-and-punctuation"
                  className="h-14 rounded-2xl bg-surface-container px-4 font-inter text-[17px] text-on-surface"
                />
              </>
            ) : edit?.kind === 'info' ? (
              <>
                {(
                  [
                    ['title', 'Title'],
                    ['author', 'Author'],
                    ['subject', 'Subject'],
                    ['keywords', 'Keywords (comma-separated)'],
                  ] as const
                ).map(([key, label]) => (
                  <View key={key} className="mb-2.5 rounded-2xl bg-surface-container px-4 pb-1.5 pt-2">
                    <Text className="font-inter text-[12px] text-on-surface-variant">{label}</Text>
                    <TextInput
                      value={info[key]}
                      onChangeText={(t) => setInfo((cur) => ({ ...cur, [key]: t }))}
                      className="min-h-[30px] py-0.5 font-inter text-[16px] text-on-surface"
                    />
                  </View>
                ))}
              </>
            ) : edit?.kind === 'resize' ? (
              <>
                <View className="flex-row rounded-full bg-surface-container p-1">
                  {PAPER_SIZES.map((p) => (
                    <Pressable
                      key={p.key}
                      onPress={() => setPaper(p.key)}
                      className={`h-10 flex-1 items-center justify-center rounded-full ${paper === p.key ? 'bg-surface-container-lowest' : ''}`}
                    >
                      <Text
                        className={`text-[14px] ${paper === p.key ? 'font-inter-semibold text-on-surface' : 'font-inter text-on-surface-variant'}`}
                      >
                        {p.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text className="mt-3 font-inter text-[13px] leading-[18px] text-on-surface-variant">
                  Pages are scaled to fit and centred. Landscape pages stay landscape, and text stays sharp.
                </Text>
              </>
            ) : edit?.kind === 'protect' ? (
              <>
                {[
                  { value: password, set: setPassword, placeholder: 'Password' },
                  { value: password2, set: setPassword2, placeholder: 'Type it again' },
                ].map((field) => (
                  <TextInput
                    key={field.placeholder}
                    value={field.value}
                    onChangeText={field.set}
                    placeholder={field.placeholder}
                    placeholderTextColor={`${colors['on-surface-variant']}99`}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={32}
                    className="mb-2.5 h-14 rounded-2xl bg-surface-container px-4 font-inter text-[17px] text-on-surface"
                  />
                ))}
                <Pressable onPress={() => setShowPassword((v) => !v)} className="mb-1 flex-row items-center gap-2 py-1">
                  <Icon
                    name={showPassword ? 'visibility-off' : 'visibility'}
                    size={18}
                    className="text-on-surface-variant"
                  />
                  <Text className="font-inter text-[14px] text-on-surface-variant">
                    {showPassword ? 'Hide password' : 'Show password'}
                  </Text>
                </Pressable>
                <Text className="font-inter text-[13px] leading-[18px] text-on-surface-variant">
                  Anyone opening the PDF will need this password. Keep it safe: it cannot be recovered.
                </Text>
              </>
            ) : (
              <TextInput
                value={watermark}
                onChangeText={setWatermark}
                placeholder="e.g. CONFIDENTIAL"
                placeholderTextColor={`${colors['on-surface-variant']}99`}
                autoCapitalize="characters"
                maxLength={40}
                className="h-14 rounded-2xl bg-surface-container px-4 font-inter text-[17px] text-on-surface"
              />
            )}

            <Pressable
              onPress={() => void handleEditApply()}
              className="mt-4 h-14 items-center justify-center rounded-full bg-on-surface active:opacity-85"
            >
              <Text className="font-inter-semibold text-[17px] text-surface">
                {edit ? EDIT_TITLES[edit.kind].action : ''}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoid>
      </Modal>

      {/* Images to PDF: review pages before creating */}
      <Modal visible={reviewOpen} transparent animationType="slide" onRequestClose={() => setReviewOpen(false)}>
        <KeyboardAvoid inModal className="flex-1 justify-end bg-black/50">
          <Pressable className="flex-1" onPress={() => setReviewOpen(false)} />
          <View
            className="max-h-[88%] overflow-hidden rounded-t-[32px] pt-3"
            style={{ paddingBottom: insets.bottom + 20 }}
          >
            <GlassBackground radius={32} variant="sheet" topOnly />
            <View className="mb-4 h-1 w-10 self-center rounded-full bg-outline-variant" />
            <View className="mb-1 flex-row items-center justify-between px-5">
              <Text className="font-inter-semibold text-[22px] tracking-[-0.4px] text-on-surface">
                {review?.length ?? 0} page{review?.length === 1 ? '' : 's'}
              </Text>
              <Pressable
                onPress={() => void addMoreImages()}
                className="h-9 flex-row items-center gap-1 rounded-full bg-surface-container px-3 active:opacity-70"
              >
                <Icon name="add" size={18} className="text-on-surface" />
                <Text className="font-inter-semibold text-[13px] text-on-surface">Add more</Text>
              </Pressable>
            </View>
            <Text className="mb-3 px-5 font-inter text-[13px] text-on-surface-variant">
              Use the arrows to change the order. Pages appear in the PDF as shown.
            </Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3 px-5 pb-2">
              {review?.map((uri, index) => {
                const last = index === (review?.length ?? 0) - 1;
                return (
                  <View key={`${uri}-${index}`} className="w-[112px]">
                    <View className="h-[150px] overflow-hidden rounded-2xl bg-surface-container">
                      <Image source={{ uri }} className="h-full w-full" resizeMode="cover" />
                      <View className="absolute left-2 top-2 h-6 min-w-6 items-center justify-center rounded-full bg-black/65 px-1.5">
                        <Text className="font-inter-semibold text-[12px] text-white">{index + 1}</Text>
                      </View>
                      <Pressable
                        onPress={() => removeImage(index)}
                        hitSlop={6}
                        accessibilityLabel={`Remove page ${index + 1}`}
                        className="absolute right-2 top-2 h-6 w-6 items-center justify-center rounded-full bg-black/65"
                      >
                        <Icon name="close" size={14} className="text-white" />
                      </Pressable>
                    </View>
                    <View className="mt-1.5 flex-row justify-between">
                      <Pressable
                        onPress={() => moveImage(index, index - 1)}
                        disabled={index === 0}
                        hitSlop={6}
                        accessibilityLabel="Move earlier"
                        className={`h-8 w-12 items-center justify-center rounded-full bg-surface-container ${
                          index === 0 ? 'opacity-30' : ''
                        }`}
                      >
                        <Icon name="chevron-left" size={20} className="text-on-surface" />
                      </Pressable>
                      <Pressable
                        onPress={() => moveImage(index, index + 1)}
                        disabled={last}
                        hitSlop={6}
                        accessibilityLabel="Move later"
                        className={`h-8 w-12 items-center justify-center rounded-full bg-surface-container ${
                          last ? 'opacity-30' : ''
                        }`}
                      >
                        <Icon name="chevron-right" size={20} className="text-on-surface" />
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <View className="px-5">
              <Text className="mb-2 mt-4 font-inter-semibold text-[14px] text-on-surface">File name</Text>
              <TextInput
                value={pdfTitle}
                onChangeText={setPdfTitle}
                placeholder="Document name"
                placeholderTextColor={`${colors['on-surface-variant']}99`}
                className="h-12 rounded-2xl bg-surface-container px-4 font-inter text-[16px] text-on-surface"
              />
              <Text className="mb-2 mt-4 font-inter-semibold text-[14px] text-on-surface">Page size</Text>
              <View className="flex-row rounded-full bg-surface-container p-1">
                {PDF_PAGE_SIZES.map(({ key, label }) => {
                  const active = pageSize === key;
                  return (
                    <Pressable
                      key={key}
                      onPress={() => setPageSize(key)}
                      className={`h-9 flex-1 items-center justify-center rounded-full ${
                        active ? 'bg-surface-container-lowest' : ''
                      }`}
                    >
                      <Text
                        className={`text-[13px] ${
                          active ? 'font-inter-semibold text-on-surface' : 'font-inter text-on-surface-variant'
                        }`}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable
                onPress={() => void createPdfFromReview()}
                disabled={!review?.length}
                className={`mt-5 h-14 flex-row items-center justify-center gap-2 rounded-full bg-on-surface active:opacity-85 ${
                  review?.length ? '' : 'opacity-40'
                }`}
              >
                <Icon name="picture-as-pdf" size={20} className="text-surface" />
                <Text className="font-inter-semibold text-[17px] text-surface">Create PDF</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoid>
      </Modal>

      {/* Results */}
      <Modal visible={!!results} transparent animationType="slide" onRequestClose={() => setResults(null)}>
        <View className="flex-1 justify-end bg-black/50">
          <Pressable className="flex-1" onPress={() => setResults(null)} />
          <View
            className="max-h-[75%] overflow-hidden rounded-t-[32px] px-5 pt-3"
            style={{ paddingBottom: insets.bottom + 20 }}
          >
            <GlassBackground radius={32} variant="sheet" topOnly />
            <View className="mb-4 h-1 w-10 self-center rounded-full bg-outline-variant" />
            <View className="mb-4 flex-row items-center gap-3">
              <View className="h-11 w-11 items-center justify-center rounded-full bg-on-surface">
                <Icon name="check" size={24} className="text-surface" />
              </View>
              <Text className="flex-1 font-inter-semibold text-[22px] tracking-[-0.4px] text-on-surface">
                {results && results.length > 1 ? `${results.length} PDFs ready` : 'Your PDF is ready'}
              </Text>
            </View>
            {savings && savings.after < savings.before ? (
              <Text className="mb-3 font-inter text-[14px] text-on-surface-variant">
                {formatBytes(savings.before)} → {formatBytes(savings.after)} (
                {Math.round((1 - savings.after / savings.before) * 100)}% smaller)
              </Text>
            ) : null}
            <ScrollView className="mb-4" showsVerticalScrollIndicator={false}>
              {results?.map((file) => (
                <View key={file.uri} className="mb-2 flex-row items-center gap-3 rounded-2xl bg-surface-container p-3">
                  {file.preview ? (
                    <Image
                      source={{ uri: file.preview }}
                      className="h-14 w-11 rounded-lg bg-white"
                      resizeMode="cover"
                    />
                  ) : (
                    <View className="h-10 w-10 items-center justify-center rounded-xl bg-[#e5484d]/15">
                      <Icon name="picture-as-pdf" size={22} className="text-[#e5484d]" />
                    </View>
                  )}
                  <View className="min-w-0 flex-1">
                    <Text className="font-inter-semibold text-[15px] text-on-surface" numberOfLines={1}>
                      {file.name}
                    </Text>
                    <Text className="font-inter text-[12px] text-on-surface-variant">
                      {file.pages} page{file.pages === 1 ? '' : 's'} · {formatBytes(file.size)}
                    </Text>
                  </View>
                  {file.locked ? (
                    <View className="h-11 w-11 items-center justify-center rounded-full bg-surface-container-high">
                      <Icon name="lock" size={18} className="text-on-surface" />
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => {
                        setResults(null);
                        router.push({ pathname: '/pdf-viewer', params: { uri: file.uri, name: file.name } });
                      }}
                      hitSlop={6}
                      accessibilityLabel={`View ${file.name}`}
                      className="h-11 w-11 items-center justify-center rounded-full bg-surface-container-high active:opacity-80"
                    >
                      <Icon name="visibility" size={18} className="text-on-surface" />
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() => void share(file)}
                    hitSlop={6}
                    className="h-10 flex-row items-center gap-1 rounded-full bg-on-surface px-3.5 active:opacity-80"
                  >
                    <Icon name="ios-share" size={16} className="text-surface" />
                    <Text className="font-inter-semibold text-[13px] text-surface">Share</Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
            <Text className="mb-3 text-center font-inter text-[12px] text-on-surface-variant">
              Use Share to save to Files or Drive, send, or print.
            </Text>
            <Pressable
              onPress={() => setResults(null)}
              className="h-14 items-center justify-center rounded-full border border-outline-variant active:bg-surface-container"
            >
              <Text className="font-inter-semibold text-[17px] text-on-surface">Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
