import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../components/Icon';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { appConfig } from '../constants/config';
import { documentService } from '../services';
import { ocrApi } from '../services/api/ocr';
import { getDocumentById } from '../services';
import { goBackOr } from '../utils/navigation';

const OCR_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ur', label: 'Urdu' },
  { code: 'ar', label: 'Arabic' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
] as const;

export default function OcrScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { documentId, publicId } = useLocalSearchParams<{ documentId?: string; publicId?: string }>();

  const [text, setText] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [language, setLanguage] = useState<(typeof OCR_LANGUAGES)[number]>(OCR_LANGUAGES[0]);
  const [languageOpen, setLanguageOpen] = useState(false);

  const runOcr = useCallback(async () => {
    if (!documentId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const doc = await getDocumentById(documentId);
      if (!doc) {
        Alert.alert('Not found', 'Document could not be loaded.');
        goBackOr(router, documentId ? `/document/${documentId}` : '/(tabs)');
        return;
      }

      setPreviewUrl(doc.pageUrls?.[0] ?? doc.image ?? '');

      if (doc.ocrText?.trim()) {
        setText(doc.ocrText);
        setLoading(false);
        return;
      }

      const cloudinaryPublicId = publicId ?? doc.firstPagePublicId;
      if (!cloudinaryPublicId || !appConfig.api.enabled) {
        setText('Connect the API and OCR worker to extract text from this scan.');
        setLoading(false);
        return;
      }

      const extracted = await ocrApi.extractFromPublicId(cloudinaryPublicId);
      setText(extracted);
    } catch (error) {
      Alert.alert(
        'OCR failed',
        error instanceof Error ? error.message : 'Could not extract text. Is the OCR worker running?',
      );
    } finally {
      setLoading(false);
    }
  }, [documentId, publicId, router]);

  useEffect(() => {
    runOcr();
  }, [runOcr]);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    if (!documentId || !documentService.saveOcrText) return;

    setSaving(true);
    try {
      await documentService.saveOcrText(documentId, text);
      Alert.alert('Saved', 'OCR text saved to your document.');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Could not save OCR text');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <LoadingOverlay visible={loading && !text} message="Extracting text…" />

      <View className="h-14 flex-row items-center justify-between border-b border-outline-variant bg-surface px-margin-mobile">
        <Pressable onPress={() => goBackOr(router, documentId ? `/document/${documentId}` : '/(tabs)')} className="rounded-full p-2">
          <Icon name="arrow-back" size={24} className="text-primary" />
        </Pressable>
        <Text className="font-inter-semibold text-headline-lg-mobile text-primary">OCR Text</Text>
        <Pressable
          onPress={() => setLanguageOpen(true)}
          className="flex-row items-center gap-1 rounded-full bg-surface-container-low px-3 py-1.5"
        >
          <Icon name="translate" size={18} className="text-primary" />
          <Text className="font-inter text-label-md text-primary">{language.label}</Text>
          <Icon name="expand-more" size={18} className="text-primary" />
        </Pressable>
      </View>

      <View className="flex-1 px-margin-mobile pt-stack-md">
        <View className="mb-gutter h-56 overflow-hidden rounded-xl border border-outline-variant bg-surface-container">
          {previewUrl ? (
            <Image source={{ uri: previewUrl }} className="h-full w-full" resizeMode="contain" />
          ) : (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator color="#00685f" />
            </View>
          )}
        </View>

        <View className="flex-1 overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest">
          <View className="flex-row items-center justify-between border-b border-outline-variant bg-surface-container-low/50 px-4 py-2">
            <Text className="font-inter text-label-caps uppercase text-on-surface-variant">
              Extracted Text · {language.label}
            </Text>
            <View className="flex-row items-center gap-2">
              <Pressable onPress={runOcr} className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5 active:bg-primary-container/20">
                <Icon name="refresh" size={20} className="text-primary" />
                <Text className="font-inter text-label-md text-primary">Retry</Text>
              </Pressable>
              <View className="h-4 w-px bg-outline-variant" />
              <Pressable onPress={handleCopy} className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5 active:bg-primary-container/20">
                <Icon name="content-copy" size={20} className="text-primary" />
                <Text className="font-inter text-label-md text-primary">Copy</Text>
              </Pressable>
            </View>
          </View>
          <TextInput
            multiline
            value={text}
            onChangeText={setText}
            editable={!loading}
            placeholder={loading ? 'Extracting text…' : 'OCR text will appear here'}
            placeholderTextColor="#6d7a77"
            className="flex-1 p-4 font-inter text-body-lg leading-6 text-on-surface"
            textAlignVertical="top"
          />
        </View>
      </View>

      <Pressable
        onPress={handleSave}
        disabled={saving || !documentId}
        className="absolute bottom-6 right-margin-mobile h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-xl active:scale-90"
        style={{ bottom: insets.bottom + 24 }}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Icon name="save" size={28} className="text-on-primary" />
        )}
      </Pressable>

      {copied ? (
        <View className="absolute bottom-24 left-0 right-0 items-center">
          <View className="rounded-full bg-inverse-surface px-6 py-3 shadow-lg">
            <Text className="font-inter text-label-md text-inverse-on-surface">Copied to clipboard</Text>
          </View>
        </View>
      ) : null}

      <Modal visible={languageOpen} transparent animationType="fade" onRequestClose={() => setLanguageOpen(false)}>
        <Pressable className="flex-1 justify-end bg-black/40" onPress={() => setLanguageOpen(false)}>
          <Pressable className="rounded-t-3xl bg-surface px-margin-mobile pb-8 pt-4" onPress={(e) => e.stopPropagation()}>
            <View className="mb-4 h-1 w-10 self-center rounded-full bg-outline-variant" />
            <Text className="mb-4 font-inter-semibold text-title-md text-on-surface">Recognition Language</Text>
            {OCR_LANGUAGES.map((lang) => (
              <Pressable
                key={lang.code}
                onPress={() => {
                  setLanguage(lang);
                  setLanguageOpen(false);
                }}
                className="flex-row items-center justify-between border-b border-outline-variant/30 py-4 active:opacity-80"
              >
                <Text className="font-inter text-body-lg text-on-surface">{lang.label}</Text>
                {language.code === lang.code ? (
                  <Icon name="check" size={22} className="text-primary" />
                ) : null}
              </Pressable>
            ))}
            <Text className="mt-4 text-center font-inter text-body-sm text-on-surface-variant">
              Language selection applies when multi-language OCR is enabled on the server.
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
