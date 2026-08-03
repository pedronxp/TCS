const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const escapePath = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pathToBlockListPattern = (dir) => {
  const absolutePath = path.resolve(__dirname, dir);
  const parts = absolutePath.split(/[\\/]+/).map(escapePath);
  return new RegExp(`^${parts.join('[/\\\\]')}[/\\\\].*`);
};
const ignoredDirs = [
  '.agents',
  '.claude',
  '.codex',
  '.codex_tmp_marker_preview',
  '.codex_tmp_update_preview',
  '.codex_tmp_version_test',
  '.codex_tmp_video',
  '.gemini',
  '.planning',
  'builds',
  'dashboard',
  'docs',
  'openspec',
  'relatorios',
  'scripts',
];

config.resolver.blockList = ignoredDirs.map(pathToBlockListPattern);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'react-native-maps') {
    return {
      filePath: path.resolve(__dirname, 'components/maps/NativeMap.web.tsx'),
      type: 'sourceFile',
    };
  }

  if (platform === 'web' && moduleName === 'expo-secure-store') {
    return {
      filePath: path.resolve(__dirname, 'components/platform/SecureStore.web.ts'),
      type: 'sourceFile',
    };
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
