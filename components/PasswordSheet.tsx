/** Asks for a new PDF password twice, with show/hide. */
import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../constants/theme';
import { PDF_PASSWORD_RULE } from '../utils/pdfEncrypt';
import { Icon } from './Icon';
import { GlassBackground } from './Glass';
import { KeyboardAvoid } from './KeyboardAvoid';

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string;
  actionLabel: string;
  onCancel: () => void;
  onSubmit: (password: string) => void;
};

export function PasswordSheet({ visible, title, subtitle, actionLabel, onCancel, onSubmit }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (visible) {
      setPassword('');
      setAgain('');
      setShow(false);
    }
  }, [visible]);

  const submit = () => {
    if (!PDF_PASSWORD_RULE.test(password)) {
      Alert.alert('Check the password', 'Use 4–32 characters: English letters, numbers and symbols.');
      return;
    }
    if (password !== again) {
      Alert.alert('Passwords do not match', 'Type the same password twice.');
      return;
    }
    onSubmit(password);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoid inModal className="flex-1 justify-end bg-black/50">
        <Pressable className="flex-1" onPress={onCancel} />
        <View className="overflow-hidden rounded-t-[32px] px-5 pt-3" style={{ paddingBottom: insets.bottom + 20 }}>
          <GlassBackground radius={32} variant="sheet" topOnly />
          <View className="mb-4 h-1 w-10 self-center rounded-full bg-outline-variant" />
          <Text className="font-inter-semibold text-[22px] tracking-[-0.4px] text-on-surface">{title}</Text>
          {subtitle ? (
            <Text className="mb-4 mt-1 font-inter text-[14px] text-on-surface-variant" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : (
            <View className="h-4" />
          )}
          {[
            { value: password, set: setPassword, placeholder: 'Password' },
            { value: again, set: setAgain, placeholder: 'Type it again' },
          ].map((field) => (
            <TextInput
              key={field.placeholder}
              value={field.value}
              onChangeText={field.set}
              placeholder={field.placeholder}
              placeholderTextColor={`${colors['on-surface-variant']}99`}
              secureTextEntry={!show}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={32}
              className="mb-2.5 h-14 rounded-2xl bg-surface-container px-4 font-inter text-[17px] text-on-surface"
            />
          ))}
          <Pressable onPress={() => setShow((v) => !v)} className="mb-1 flex-row items-center gap-2 py-1">
            <Icon name={show ? 'visibility-off' : 'visibility'} size={18} className="text-on-surface-variant" />
            <Text className="font-inter text-[14px] text-on-surface-variant">{show ? 'Hide password' : 'Show password'}</Text>
          </Pressable>
          <Text className="font-inter text-[13px] leading-[18px] text-on-surface-variant">
            Anyone opening the PDF will need this password. Keep it safe: it cannot be recovered.
          </Text>
          <Pressable onPress={submit} className="mt-4 h-14 items-center justify-center rounded-full bg-on-surface active:opacity-85">
            <Text className="font-inter-semibold text-[17px] text-surface">{actionLabel}</Text>
          </Pressable>
        </View>
      </KeyboardAvoid>
    </Modal>
  );
}
