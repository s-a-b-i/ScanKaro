import { ActivityIndicator, Modal, Text, View } from 'react-native';

type LoadingOverlayProps = {
  visible: boolean;
  message?: string;
};

export function LoadingOverlay({ visible, message = 'Please wait…' }: LoadingOverlayProps) {
  if (!visible) return null;

  return (
    <Modal transparent visible animationType="fade">
      <View className="flex-1 items-center justify-center bg-black/40 px-8">
        <View className="w-full max-w-xs items-center rounded-2xl bg-surface px-6 py-8 shadow-lg">
          <ActivityIndicator size="large" color="#8e8e93" />
          <Text className="mt-4 text-center font-inter text-body-lg text-on-surface">{message}</Text>
        </View>
      </View>
    </Modal>
  );
}
