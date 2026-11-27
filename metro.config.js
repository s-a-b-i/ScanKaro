const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Firebase JS SDK — Metro package.json "exports" conflict (Expo SDK 53+)
// https://docs.expo.dev/guides/using-firebase/#configure-metro
config.resolver.sourceExts.push('cjs');
config.resolver.unstable_enablePackageExports = false;

// Never bundle or watch native build output: after an Android build these folders hold
// thousands of files and Metro's watcher on Windows times out ("Failed to start watch mode").
config.resolver.blockList = [
  ...[].concat(config.resolver.blockList ?? []),
  /[\\/]android[\\/](app[\\/])?(build|\.cxx)[\\/].*/,
  /[\\/]android[\\/]\.gradle[\\/].*/,
  /[\\/]ios[\\/](build|Pods)[\\/].*/,
];

// Web only: native-only packages that load their native module at import time (and so
// crash the whole web app) are swapped for small stand-ins with the same exports.
const WEB_STUBS = {
  'react-native-pdf-thumbnail': path.resolve(__dirname, 'web-stubs/react-native-pdf-thumbnail.js'),
  // No web support at all; the app's storage runs on it. In-memory stand-in for UI checks.
  'expo-file-system': path.resolve(__dirname, 'web-stubs/expo-file-system.js'),
  // No web support; the app lock reads it on start. localStorage-backed, preview only.
  'expo-secure-store': path.resolve(__dirname, 'web-stubs/expo-secure-store.js'),
};
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && WEB_STUBS[moduleName]) {
    return { type: 'sourceFile', filePath: WEB_STUBS[moduleName] };
  }
  return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
