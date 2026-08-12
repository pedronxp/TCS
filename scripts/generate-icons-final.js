/**
 * Gerador de Ícones TCS - Versão Definitiva
 *
 * Usa tcs-mark-v5.png (logo oficial) para TODOS osícones:
 * - Icon principal (1024x1024)
 * - Adaptive icons Android (432x432)
 * - Favicon (48x48)
 * - Notification (96x96)
 * - Splash (288x288)
 *
 * Este é o logo marca oficial do TCS
 */

const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');

const SOURCE = 'assets/brand/tcs-mark-v5.png';

/**
 * Redimensiona e centraliza o logo em um canvas
 */
async function createIconFromSource(size, padding = 0, backgroundColor = null) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background (se especificado)
  if (backgroundColor) {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, size, size);
  } else {
    ctx.clearRect(0, 0, size, size);
  }

  // Carregar logo
  const logo = await loadImage(SOURCE);

  // Calcular tamanho com padding
  const logoSize = size - (padding * 2);
  const x = padding;
  const y = padding;

  // Desenhar logo centralizado
  ctx.drawImage(logo, x, y, logoSize, logoSize);

  return canvas;
}

/**
 * Gera ícone principal (1024x1024)
 */
async function generateMainIcon() {
  console.log('📱 Gerando ícone principal (1024x1024)...');

  const canvas = await createIconFromSource(1024);
  const buffer = canvas.toBuffer('image/png');

  fs.writeFileSync('assets/icon.png', buffer);
  console.log('✅ assets/icon.png');
}

/**
 * Gera adaptive foreground (432x432)
 * Safe zone: 66dp (56px em 432x432) de cada lado
 */
async function generateAdaptiveForeground() {
  console.log('🎨 Gerando adaptive foreground (432x432)...');

  const canvas = await createIconFromSource(432, 56); // Safe zone
  const buffer = canvas.toBuffer('image/png');

  fs.writeFileSync('assets/android-icon-foreground.png', buffer);
  console.log('✅ assets/android-icon-foreground.png');
}

/**
 * Gera adaptive background (432x432)
 * Background simples branco
 */
async function generateAdaptiveBackground() {
  console.log('🎨 Gerando adaptive background (432x432)...');

  const canvas = createCanvas(432, 432);
  const ctx = canvas.getContext('2d');

  // Background branco sólido
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, 432, 432);

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync('assets/android-icon-background.png', buffer);
  console.log('✅ assets/android-icon-background.png');
}

/**
 * Gera ícone monocromático (432x432) para Android 13+
 */
async function generateMonochrome() {
  console.log('⚫ Gerando ícone monocromático (432x432)...');

  const canvas = createCanvas(432, 432);
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, 432, 432);

  // Carregar logo e converter para branco puro
  const logo = await loadImage(SOURCE);
  const logoSize = 432 - 112; // Safe zone
  const offset = 56;

  // Desenhar em branco
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(logo, offset, offset, logoSize, logoSize);

  // Converter para monocromático branco
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, 432, 432);

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync('assets/android-icon-monochrome.png', buffer);
  console.log('✅ assets/android-icon-monochrome.png');
}

/**
 * Gera favicon (48x48)
 */
async function generateFavicon() {
  console.log('🌐 Gerando favicon (48x48)...');

  const canvas = await createIconFromSource(48);
  const buffer = canvas.toBuffer('image/png');

  fs.writeFileSync('assets/favicon.png', buffer);
  console.log('✅ assets/favicon.png');
}

/**
 * Gera ícone de notificação (96x96)
 */
async function generateNotification() {
  console.log('🔔 Gerando ícone de notificação (96x96)...');

  const canvas = await createIconFromSource(96);
  const buffer = canvas.toBuffer('image/png');

  fs.writeFileSync('assets/notification-icon.png', buffer);
  console.log('✅ assets/notification-icon.png');
}

/**
 * Gera splash icon (288x288)
 */
async function generateSplashIcon() {
  console.log('💫 Gerando splash icon (288x288)...');

  const canvas = await createIconFromSource(288);
  const buffer = canvas.toBuffer('image/png');

  fs.writeFileSync('assets/splash-icon.png', buffer);
  console.log('✅ assets/splash-icon.png');
}

/**
 * Gera preview visual de todos osícones
 */
async function generatePreview() {
  console.log('🖼️ Gerando preview...');

  const canvas = createCanvas(1400, 900);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(0, 0, 1400, 900);

  // Título
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 36px Inter, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Ícones TCS - Logo Marca Oficial', 700, 60);

  ctx.fillStyle = '#64748B';
  ctx.font = '18px Inter, Arial, sans-serif';
  ctx.fillText('Baseado em: tcs-mark-v5.png', 700, 90);

  const logo = await loadImage(SOURCE);

  // Grid deícones
  const icons = [
    { name: 'Icon Principal', size: 200, x: 150, y: 150 },
    { name: 'Adaptive\nForeground', size: 160, x: 450, y: 170 },
    { name: 'Favicon', size: 100, x: 750, y: 200 },
    { name: 'Notification', size: 120, x: 950, y: 190 },
    { name: 'Splash', size: 180, x: 1180, y: 160 },
  ];

  icons.forEach(icon => {
    // Background branco
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 4;
    ctx.beginPath();
    ctx.roundRect(icon.x - icon.size/2 - 20, icon.y - icon.size/2 - 20, icon.size + 40, icon.size + 40, 16);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Logo
    ctx.drawImage(logo, icon.x - icon.size/2, icon.y - icon.size/2, icon.size, icon.size);

    // Label
    ctx.fillStyle = '#1E293B';
    ctx.font = 'bold 14px Inter, Arial, sans-serif';
    ctx.textAlign = 'center';
    const lines = icon.name.split('\n');
    lines.forEach((line, i) => {
      ctx.fillText(line, icon.x, icon.y + icon.size/2 + 50 + (i * 18));
    });

    // Tamanho
    ctx.fillStyle = '#94A3B8';
    ctx.font = '12px Inter, Arial, sans-serif';
    ctx.fillText(`${icon.size}×${icon.size}`, icon.x, icon.y + icon.size/2 + 70 + (lines.length * 18));
  });

  // Seção: Preview Android
  ctx.fillStyle = '#1E293B';
  ctx.font = 'bold 24px Inter, Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Preview no Android', 100, 480);

  // Adaptive icon circular
  const adaptiveX = 250;
  const adaptiveY = 600;
  const adaptiveSize = 180;

  ctx.save();
  ctx.beginPath();
  ctx.arc(adaptiveX, adaptiveY, adaptiveSize/2, 0, Math.PI * 2);
  ctx.clip();

  // Background branco
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(adaptiveX - adaptiveSize/2, adaptiveY - adaptiveSize/2, adaptiveSize, adaptiveSize);

  // Logo (com safe zone)
  const logoSize = adaptiveSize * 0.7;
  ctx.drawImage(logo, adaptiveX - logoSize/2, adaptiveY - logoSize/2, logoSize, logoSize);

  ctx.restore();

  // Label
  ctx.fillStyle = '#64748B';
  ctx.font = '14px Inter, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Adaptive Icon', adaptiveX, adaptiveY + adaptiveSize/2 + 30);
  ctx.fillText('(Android)', adaptiveX, adaptiveY + adaptiveSize/2 + 48);

  // Notificação
  ctx.fillStyle = '#1E293B';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 6;
  ctx.beginPath();
  ctx.roundRect(480, 520, 820, 140, 16);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  // Ícone da notificação
  ctx.drawImage(logo, 510, 550, 80, 80);

  // Texto da notificação
  ctx.fillStyle = '#F1F5F9';
  ctx.font = 'bold 18px Inter, Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('TCS - Relatório de Risco', 620, 565);

  ctx.fillStyle = '#CBD5E1';
  ctx.font = '15px Inter, Arial, sans-serif';
  ctx.fillText('Nova vistoria disponível', 620, 595);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '13px Inter, Arial, sans-serif';
  ctx.fillText('Toque para visualizar os detalhes', 620, 620);

  ctx.fillStyle = '#64748B';
  ctx.textAlign = 'right';
  ctx.fillText('agora', 1260, 565);

  // Rodapé
  ctx.fillStyle = '#94A3B8';
  ctx.font = '14px Inter, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('✨ Logo marca oficial usado em todos osícones do sistema', 700, 850);

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync('preview-tcs-icons.png', buffer);
  console.log('✅ preview-tcs-icons.png');
}

async function main() {
  console.log('\n🎨 TCS Icon Generator - Logo Marca Oficial\n');
  console.log(`📦 Fonte: ${SOURCE}\n`);

  try {
    // Verificar se o arquivo existe
    if (!fs.existsSync(SOURCE)) {
      throw new Error(`Arquivo não encontrado: ${SOURCE}`);
    }

    await generateMainIcon();
    await generateAdaptiveForeground();
    await generateAdaptiveBackground();
    await generateMonochrome();
    await generateFavicon();
    await generateNotification();
    await generateSplashIcon();
    await generatePreview();

    console.log('\n✨ Todos osícones foram gerados com sucesso!\n');
    console.log('📂 Arquivos gerados:');
    console.log('   • assets/icon.png (1024x1024)');
    console.log('   • assets/android-icon-foreground.png (432x432)');
    console.log('   • assets/android-icon-background.png (432x432)');
    console.log('   • assets/android-icon-monochrome.png (432x432)');
    console.log('   • assets/favicon.png (48x48)');
    console.log('   • assets/notification-icon.png (96x96)');
    console.log('   • assets/splash-icon.png (288x288)');
    console.log('   • preview-tcs-icons.png\n');
    console.log('🎯 Logo marca oficial aplicado em TODOS osícones!\n');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

main();
