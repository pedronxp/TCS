/**
 * Validador de Ícones TCS
 *
 * Verifica se todos osícones necessários existem e têm as dimensões corretas
 */

const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');

const REQUIRED_ICONS = [
  { path: 'assets/icon.png', width: 1024, height: 1024, name: 'Ícone Principal' },
  { path: 'assets/android-icon-foreground.png', width: 432, height: 432, name: 'Android Foreground' },
  { path: 'assets/android-icon-background.png', width: 432, height: 432, name: 'Android Background' },
  { path: 'assets/android-icon-monochrome.png', width: 432, height: 432, name: 'Android Monochrome' },
  { path: 'assets/favicon.png', width: 48, height: 48, name: 'Favicon' },
  { path: 'assets/notification-icon.png', width: 96, height: 96, name: 'Notification' },
  { path: 'assets/splash-icon.png', width: 288, height: 288, name: 'Splash' },
];

async function validateIcon(iconDef) {
  const { path, width, height, name } = iconDef;

  // Verificar se o arquivo existe
  if (!fs.existsSync(path)) {
    return { valid: false, error: `Arquivo não encontrado: ${path}`, name };
  }

  try {
    // Carregar imagem e verificar dimensões
    const image = await loadImage(path);

    if (image.width !== width || image.height !== height) {
      return {
        valid: false,
        error: `Dimensões incorretas: esperado ${width}x${height}, encontrado ${image.width}x${image.height}`,
        name,
        path
      };
    }

    // Obter tamanho do arquivo
    const stats = fs.statSync(path);
    const sizeKB = (stats.size / 1024).toFixed(1);

    return {
      valid: true,
      name,
      path,
      dimensions: `${image.width}x${image.height}`,
      size: `${sizeKB} KB`
    };

  } catch (error) {
    return {
      valid: false,
      error: `Erro ao carregar imagem: ${error.message}`,
      name,
      path
    };
  }
}

async function validateAppJson() {
  console.log('\n📋 Verificando app.json...\n');

  const appJson = JSON.parse(fs.readFileSync('app.json', 'utf8'));
  const errors = [];
  const warnings = [];

  // Verificar ícone principal
  if (appJson.expo.icon !== './assets/icon.png') {
    errors.push(`expo.icon aponta para "${appJson.expo.icon}" em vez de "./assets/icon.png"`);
  }

  // Verificar splash
  if (appJson.expo.splash.image !== './assets/splash-icon.png') {
    errors.push(`expo.splash.image aponta para "${appJson.expo.splash.image}" em vez de "./assets/splash-icon.png"`);
  }

  // Verificar adaptive icon Android
  if (appJson.expo.android.adaptiveIcon.foregroundImage !== './assets/android-icon-foreground.png') {
    errors.push(`android.adaptiveIcon.foregroundImage incorreto`);
  }

  if (!appJson.expo.android.adaptiveIcon.monochromeImage) {
    warnings.push('android.adaptiveIcon.monochromeImage não configurado (recomendado para Android 13+)');
  }

  // Verificar favicon
  if (appJson.expo.web.favicon !== './assets/favicon.png') {
    errors.push(`web.favicon aponta para "${appJson.expo.web.favicon}" em vez de "./assets/favicon.png"`);
  }

  // Verificar notification icon
  const notificationPlugin = appJson.expo.plugins.find(p =>
    Array.isArray(p) && p[0] === 'expo-notifications'
  );

  if (notificationPlugin && notificationPlugin[1].icon !== './assets/notification-icon.png') {
    errors.push(`expo-notifications.icon aponta para "${notificationPlugin[1].icon}" em vez de "./assets/notification-icon.png"`);
  }

  if (errors.length > 0) {
    console.log('❌ Erros no app.json:');
    errors.forEach(err => console.log(`   • ${err}`));
    console.log('');
  }

  if (warnings.length > 0) {
    console.log('⚠️  Avisos:');
    warnings.forEach(warn => console.log(`   • ${warn}`));
    console.log('');
  }

  if (errors.length === 0 && warnings.length === 0) {
    console.log('✅ app.json configurado corretamente\n');
  }

  return { errors, warnings };
}

async function main() {
  console.log('\n🎨 TCS Icon Validator\n');
  console.log('='.repeat(60));

  // Validar app.json
  const { errors: appJsonErrors } = await validateAppJson();

  // Validar cadaícone
  console.log('📱 Validando ícones...\n');

  const results = [];
  for (const iconDef of REQUIRED_ICONS) {
    const result = await validateIcon(iconDef);
    results.push(result);
  }

  // Exibir resultados
  const valid = results.filter(r => r.valid);
  const invalid = results.filter(r => !r.valid);

  if (valid.length > 0) {
    console.log('✅ Ícones válidos:\n');
    valid.forEach(r => {
      console.log(`   ${r.name}`);
      console.log(`   └─ ${r.path} (${r.dimensions}, ${r.size})`);
      console.log('');
    });
  }

  if (invalid.length > 0) {
    console.log('❌ Ícones com problemas:\n');
    invalid.forEach(r => {
      console.log(`   ${r.name}`);
      console.log(`   └─ ${r.error}`);
      console.log('');
    });
  }

  // Resumo final
  console.log('='.repeat(60));
  console.log(`\n📊 Resumo: ${valid.length}/${REQUIRED_ICONS.length} ícones válidos\n`);

  if (invalid.length === 0 && appJsonErrors.length === 0) {
    console.log('✨ Todos osícones estão corretos e prontos para build!\n');
    process.exit(0);
  } else {
    console.log('⚠️  Corrija os problemas acima antes de fazer o build.\n');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('\n❌ Erro ao validar ícones:', error.message);
  process.exit(1);
});
