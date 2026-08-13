/**
 * Adaptador de Ícones TCS
 *
 * Usa tcs-mark.png (pin com checkmark) para gerar:
 * - Favicon (48x48)
 * - Notification (96x96)
 * - Splash-icon (288x288)
 *
 * Mantém assets/icon.png inalterado (logo TCS com barras)
 */

const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');

async function resizeIcon(inputPath, outputPath, size, name) {
  console.log(`📐 Gerando ${name} (${size}x${size})...`);

  const image = await loadImage(inputPath);
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Desenhar imagem redimensionada
  ctx.drawImage(image, 0, 0, size, size);

  // Salvar
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);
  console.log(`✅ ${outputPath}`);
}

async function main() {
  console.log('\n🎨 TCS Icon Adapter\n');
  console.log('📦 Usando: assets/brand/tcs-mark.png (pin com checkmark)\n');

  const source = 'assets/brand/tcs-mark.png';

  try {
    // Verificar se o arquivo fonte existe
    if (!fs.existsSync(source)) {
      throw new Error(`Arquivo não encontrado: ${source}`);
    }

    // Gerar apenas os 3 ícones solicitados
    await resizeIcon(source, 'assets/favicon.png', 48, 'Favicon');
    await resizeIcon(source, 'assets/notification-icon.png', 96, 'Notification Icon');
    await resizeIcon(source, 'assets/splash-icon.png', 288, 'Splash Icon');

    console.log('\n✨ Ícones adaptados com sucesso!\n');
    console.log('📂 Arquivos gerados:');
    console.log('   • assets/favicon.png (48x48)');
    console.log('   • assets/notification-icon.png (96x96)');
    console.log('   • assets/splash-icon.png (288x288)');
    console.log('\n📌 assets/icon.png mantidoinalterado\n');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

main();
