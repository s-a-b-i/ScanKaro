import { useEffect, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, View, ViewProps } from 'react-native';

type Props = ViewProps & {
  className?: string;
  /** True for content inside a <Modal> (bottom sheets). Same behaviour; kept for clarity. */
  inModal?: boolean;
};

/**
 * Keeps inputs above the keyboard.
 * - iOS: the standard KeyboardAvoidingView.
 * - Android: the app draws edge-to-edge, so the window does not resize for the keyboard.
 *   Pad by the keyboard height while it is open and reset to zero when it closes.
 *   (KeyboardAvoidingView here left a gap behind after the keyboard closed.)
 */
export function KeyboardAvoid({ inModal: _inModal, style, ...props }: Props) {
  const [keyboard, setKeyboard] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', (e) => setKeyboard(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  if (Platform.OS === 'ios') return <KeyboardAvoidingView behavior="padding" style={style} {...props} />;
  return <View style={[style, keyboard ? { paddingBottom: keyboard } : null]} {...props} />;
}
