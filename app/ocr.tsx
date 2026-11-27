import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { ScreenHeader } from '../components/ScreenHeader';
import { shadows } from '../components/ui';
import { useTheme } from '../constants/theme';
import { useApp } from '../context/AppProvider';
import { documentService, getDocumentById } from '../services';
import { ocrApi } from '../services/api/ocr';
import { DocumentItem } from '../types';
import { goBackOr } from '../utils/navigation';
import { shareDocx } from '../utils/docx';
import { OCR_LANGUAGES, OcrLanguage, recognizePages, serverOcrAvailable, shareText } from '../utils/ocr';

/** Extract text from a document's pages: on the device for Latin scripts and Hindi. */
export default function OcrScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { colors } = useTheme();
  const { refreshDocuments } = useApp();
  const { documentId } = useLocalSearchParams<{ documentId?: string }>();

  const [doc, setDoc] = useState<DocumentItem | null>(null);
  const [text, setText] = useState('');
  const [status, setStatus] = useState<string | null>('Loading…');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [language, setLanguage] = useState<OcrLanguage>(OCR_LANGUAGES[0]);
  const [languageOpen, setLanguageOpen] = useState(false);
  const runId = useRef(0);

  const back = () => goBackOr(router, documentId ? `/document/${documentId}` : '/(tabs)');

  const extract = useCallback(async (target: DocumentItem, lang: OcrLanguage) => {
    const id = ++runId.current;
    const pages = target.pageUrls?.length ? target.pageUrls : target.image ? [target.image] : [];
    if (pages.length === 0) {
      setStatus(null);
      return;
    }

    try {
      if (lang.engine === 'server') {
        const publicId = target.firstPagePublicId ?? target.pagePublicIds?.[0];
        if (!serverOcrAvailable() || !publicId) {
          setStatus(null);
          Alert.alert(
            `${lang.label} needs the server`,
            `On-device recognition supports English, other Latin-script languages and Hindi. ${lang.label} uses the ScanKaro server, which is not connected.`,
          );
          return;
        }
        setStatus('Sending to the server…');
        const extracted = await ocrApi.extractFromPublicId(publicId);
        if (id === runId.current) setText(extracted);
        return;
      }

      setStatus(pages.length > 1 ? `Reading page 1 of ${pages.length}…` : 'Reading text…');
      const extracted = await recognizePages(pages, lang, (done, total) => {
        if (id === runId.current && done < total) setStatus(`Reading page ${done + 1} of ${total}…`);
      });
      if (id !== runId.current) return;
      setText(extracted);
      if (!extracted) {
        Alert.alert('No text found', 'Try a clearer scan, or pick the language of the document.');
      }
    } catch (error) {
      if (id === runId.current) {
        Alert.alert('Could not read text', error instanceof Error ? error.message : 'Please try again.');
      }
    } finally {
      if (id === runId.current) setStatus(null);
    }
  }, []);

  useEffect(() => {
    if (!documentId) return;
    void (async () => {
      const loaded = await getDocumentById(documentId);
      if (!loaded) {
        Alert.alert('Not found', 'This document could not be loaded.');
        back();
        return;
      }
      setDoc(loaded);
      if (loaded.ocrText?.trim()) {
        // Show text saved earlier; "Read again" re-runs recognition.
        setText(loaded.ocrText);
        setStatus(null);
      } else {
        await extract(loaded, OCR_LANGUAGES[0]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  const chooseLanguage = (lang: OcrLanguage) => {
    setLanguage(lang);
    setLanguageOpen(false);
    if (doc) void extract(doc, lang);
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareAs = async (format: 'txt' | 'docx') => {
    try {
      const title = doc?.title ?? 'Text';
      await (format === 'docx' ? shareDocx(text, title) : shareText(text, title));
    } catch (error) {
      Alert.alert('Could not share', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const handleShare = () => {
    Alert.alert('Share text as', undefined, [
      { text: 'Word (.docx)', onPress: () => void shareAs('docx') },
      { text: 'Plain text (.txt)', onPress: () => void shareAs('txt') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleSave = async () => {
    if (!documentId || !documentService.saveOcrText) return;
    setSaving(true);
    try {
      await documentService.saveOcrText(documentId, text);
      await refreshDocuments();
      toast.show('Text saved. This document is now searchable.');
    } catch (error) {
      Alert.alert('Could not save', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const busy = status !== null;
  const hasText = text.trim().length > 0;

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <ScreenHeader
        title="Extract Text"
        subtitle={doc?.title}
        onBack={back}
        right={
          <Pressable
            onPress={() => setLanguageOpen(true)}
            accessibilityLabel={`Language: ${language.label}`}
            className="h-9 flex-row items-center gap-1 rounded-full bg-surface-container-lowest px-3 active:opacity-70"
            style={shadows.soft}
          >
            <Icon name="translate" size={16} className="text-primary" />
            <Text className="font-inter-semibold text-label-md text-primary">{language.code.toUpperCase()}</Text>
          </Pressable>
        }
      />

      <View className="flex-1 px-margin-mobile pt-2" style={{ paddingBottom: insets.bottom + 12 }}>
        <View className="mb-3 h-44 overflow-hidden rounded-3xl bg-surface-container-lowest" style={shadows.soft}>
          {doc?.image ? (
            <Image source={{ uri: doc.image }} className="h-full w-full" resizeMode="contain" />
          ) : (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator color={colors.primary} />
            </View>
          )}
        </View>

        <View className="flex-1 overflow-hidden rounded-3xl bg-surface-container-lowest" style={shadows.soft}>
          <View className="flex-row items-center justify-between border-b border-outline-variant/40 py-1.5 pl-4 pr-1">
            <Text className="font-inter-semibold text-label-md text-on-surface-variant" numberOfLines={1}>
              {language.engine === 'device' ? 'On this device' : 'Server'} · {language.label}
            </Text>
            <View className="flex-row items-center">
              {[
                { icon: 'refresh' as const, label: 'Read again', onPress: () => doc && void extract(doc, language), off: busy },
                { icon: 'content-copy' as const, label: 'Copy', onPress: () => void handleCopy(), off: !hasText },
                { icon: 'ios-share' as const, label: 'Share as Word or text', onPress: handleShare, off: !hasText },
              ].map((a) => (
                <Pressable
                  key={a.label}
                  onPress={a.onPress}
                  disabled={a.off}
                  accessibilityLabel={a.label}
                  className={`h-11 w-11 items-center justify-center rounded-full active:bg-surface-container ${
                    a.off ? 'opacity-30' : ''
                  }`}
                >
                  <Icon name={a.icon} size={20} className="text-primary" />
                </Pressable>
              ))}
            </View>
          </View>
          {busy ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator color={colors.primary} />
              <Text className="mt-3 font-inter text-body-sm text-on-surface-variant">{status}</Text>
            </View>
          ) : (
            <TextInput
              multiline
              value={text}
              onChangeText={setText}
              placeholder="No text yet. Tap the language button to choose another language, or read again."
              placeholderTextColor={`${colors['on-surface-variant']}99`}
              className="flex-1 p-4 pb-20 font-inter text-body-lg leading-6 text-on-surface"
              textAlignVertical="top"
            />
          )}
        </View>
      </View>

      <Pressable
        onPress={() => void handleSave()}
        disabled={saving || !hasText || busy}
        accessibilityLabel="Save text to document"
        className={`absolute right-8 h-14 flex-row items-center gap-2 rounded-full bg-on-surface px-5 active:opacity-85 ${
          !hasText || busy ? 'opacity-40' : ''
        }`}
        style={[{ bottom: insets.bottom + 28 }, shadows.lifted]}
      >
        {saving ? <ActivityIndicator color={colors.surface} /> : <Icon name="save" size={20} className="text-surface" />}
        <Text className="font-inter-semibold text-[15px] text-surface">Save</Text>
      </Pressable>

      {copied ? (
        <View className="absolute bottom-28 left-0 right-0 items-center">
          <View className="rounded-full bg-inverse-surface px-6 py-3">
            <Text className="font-inter text-label-md text-inverse-on-surface">Copied to clipboard</Text>
          </View>
        </View>
      ) : null}

      <Modal visible={languageOpen} transparent animationType="fade" onRequestClose={() => setLanguageOpen(false)}>
        <Pressable className="flex-1 justify-end bg-black/40" onPress={() => setLanguageOpen(false)}>
          <Pressable
            className="rounded-t-4xl bg-surface-container-lowest px-margin-mobile pt-3"
            style={{ paddingBottom: insets.bottom + 24 }}
            onPress={(e) => e.stopPropagation()}
          >
            <View className="mb-4 h-1 w-10 self-center rounded-full bg-outline-variant" />
            <Text className="mb-2 font-inter-semibold text-title-md text-on-surface">Document language</Text>
            {OCR_LANGUAGES.map((lang) => {
              const unavailable = lang.engine === 'server' && !serverOcrAvailable();
              return (
                <Pressable
                  key={lang.code}
                  onPress={() => chooseLanguage(lang)}
                  className="flex-row items-center justify-between border-b border-outline-variant/30 py-4 active:opacity-80"
                >
                  <View>
                    <Text className={`font-inter text-body-lg ${unavailable ? 'text-on-surface/40' : 'text-on-surface'}`}>
                      {lang.label}
                    </Text>
                    <Text className="font-inter text-[12px] text-on-surface-variant">
                      {lang.engine === 'device' ? 'Works offline' : unavailable ? 'Needs the ScanKaro server' : 'Uses the server'}
                    </Text>
                  </View>
                  {language.code === lang.code ? <Icon name="check" size={22} className="text-primary" /> : null}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
