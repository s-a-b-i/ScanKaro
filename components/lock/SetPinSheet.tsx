import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PIN_LENGTH, setPin, verifyPin } from '../../services/appLock';
import { PinPad } from './PinPad';

type Mode = 'create' | 'verify';

type SetPinSheetProps = {
  visible: boolean;
  /** "create": choose a new PIN (entered twice). "verify": confirm the current PIN. */
  mode: Mode;
  onDone: () => void;
  onCancel: () => void;
};

/** Full-screen PIN entry used by Settings to turn the lock on, change the PIN, or turn it off. */
export function SetPinSheet({ visible, mode, onDone, onCancel }: SetPinSheetProps) {
  const insets = useSafeAreaInsets();
  const [value, setValue] = useState('');
  const [first, setFirst] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setValue('');
      setFirst(null);
      setMessage(null);
    }
  }, [visible]);

  const onChange = async (next: string) => {
    setValue(next);
    setMessage(null);
    if (next.length < PIN_LENGTH) return;

    if (mode === 'verify') {
      const result = await verifyPin(next);
      setValue('');
      if (result.ok) onDone();
      else setMessage(result.waitSeconds ? `Too many attempts. Wait ${result.waitSeconds} s.` : 'Wrong PIN.');
      return;
    }

    if (first === null) {
      setFirst(next);
      setValue('');
      return;
    }
    if (next !== first) {
      setFirst(null);
      setValue('');
      setMessage("PINs didn't match. Try again.");
      return;
    }
    await setPin(next);
    onDone();
  };

  const title = mode === 'verify' ? 'Enter your PIN' : first === null ? 'Choose a 4-digit PIN' : 'Enter it again';
  const subtitle =
    mode === 'verify'
      ? 'Confirm it is you.'
      : first === null
        ? 'You will need it to open ScanKaro.'
        : 'Confirm your new PIN.';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel} statusBarTranslucent>
      <View
        className="flex-1 items-center justify-center bg-background"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      >
        <PinPad title={title} subtitle={subtitle} message={message} value={value} onChange={(v) => void onChange(v)} />
        <Pressable onPress={onCancel} hitSlop={8} className="mt-6 px-4 py-2">
          <Text className="font-inter-semibold text-[15px] text-on-surface-variant">Cancel</Text>
        </Pressable>
      </View>
    </Modal>
  );
}
