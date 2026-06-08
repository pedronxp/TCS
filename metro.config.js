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
  'supabase',
];

config.resolver.blockList = ignoredDirs.map(pathToBlockListPattern);

module.exports = config;
