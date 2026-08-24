const FACE_ID_PERMISSION =
  'O TCS usa o Face ID para proteger sua conta e desbloquear o aplicativo com segurança.';

module.exports = ({ config }) => {
  const plugins = (config.plugins || []).filter((plugin) => {
    const name = Array.isArray(plugin) ? plugin[0] : plugin;
    return name !== 'expo-local-authentication';
  });

  return {
    ...config,
    ios: {
      ...config.ios,
      infoPlist: {
        ...(config.ios?.infoPlist || {}),
        NSFaceIDUsageDescription: FACE_ID_PERMISSION,
      },
    },
    plugins: [
      ...plugins,
      [
        'expo-local-authentication',
        { faceIDPermission: FACE_ID_PERMISSION },
      ],
    ],
  };
};
