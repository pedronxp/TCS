/**
 * Gerador de Ícones TCS - Versão Profissional
 *
 * Gera todos os ícones do app com design consistente:
 * - Pin com checkmark (logo oficial TCS)
 * - Backgrounds adaptativos com efeito glass
 * - Otimização para Android e Web
 */

const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

// Paleta de cores TCS
const COLORS = {
  green: '#2F7D6D',        // Verde petróleo principal
  darkGreen: '#1F5A4D',    // Verde escuro
  charcoal: '#1F2937',     // Cinza escuro (arco superior)
  white: '#FFFFFF',        // Branco
  glass: 'rgba(255, 255, 255, 0.12)', // Efeito glass
};

/**
 * Desenha o pin com checkmark (logo TCS)
 */
function drawTCSPin(ctx, x, y, size, colors = COLORS) {
  const scale = size / 512; // Escala baseada em design 512px

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // Arco superior (charcoal)
  ctx.beginPath();
  ctx.arc(256, 256, 180, Math.PI, 0, false);
  ctx.strokeStyle = colors.charcoal;
  ctx.lineWidth = 80;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Corpo do pin (verde petróleo)
  ctx.fillStyle = colors.green;

  // Laterais do pin
  ctx.beginPath();
  ctx.moveTo(140, 340);
  ctx.lineTo(100, 680);
  ctx.lineTo(180, 580);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(372, 340);
  ctx.lineTo(412, 680);
  ctx.lineTo(332, 580);
  ctx.closePath();
  ctx.fill();

  // Círculo central (branco)
  ctx.beginPath();
  ctx.arc(256, 256, 140, 0, Math.PI * 2);
  ctx.fillStyle = colors.white;
  ctx.fill();

  // Checkmark (verde petróleo)
  ctx.strokeStyle = colors.green;
  ctx.lineWidth = 48;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(180, 256);
  ctx.lineTo(230, 310);
  ctx.lineTo(340, 200);
  ctx.stroke();

  ctx.restore();
}

/**
 * Cria background com efeito glass moderno
 */
function createGlassBackground(canvas, colors = COLORS) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;

  // Gradiente base suave
  const gradient = ctx.createRadialGradient(
    width * 0.5, height * 0.35, 0,
    width * 0.5, height * 0.5, width * 0.7
  );
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  gradient.addColorStop(0.5, 'rgba(245, 247, 250, 0.92)');
  gradient.addColorStop(1, 'rgba(235, 240, 245, 0.88)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Efeito de profundidade (círculos concêntricos sutis)
  for (let i = 3; i >= 1; i--) {
    const radius = (width * 0.42) * (i * 0.32);
    const alpha = 0.03 * (4 - i);

    const circleGradient = ctx.createRadialGradient(
      width / 2, height / 2, radius * 0.7,
      width / 2, height / 2, radius
    );
    circleGradient.addColorStop(0, `rgba(47, 125, 109, 0)`);
    circleGradient.addColorStop(1, `rgba(47, 125, 109, ${alpha})`);

    ctx.beginPath();
    ctx.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
    ctx.fillStyle = circleGradient;
    ctx.fill();
  }

  // Highlight superior (efeito glass)
  const highlightGradient = ctx.createRadialGradient(
    width * 0.5, height * 0.25, 0,
    width * 0.5, height * 0.25, width * 0.5
  );
  highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
  highlightGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
  highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

  ctx.fillStyle = highlightGradient;
  ctx.fillRect(0, 0, width, height * 0.5);
}

/**
 * Gera ícone principal (1024x1024) com background glass
 */
async function generateMainIcon() {
  console.log('📱 Gerando ícone principal (1024x1024)...');

  const canvas = createCanvas(1024, 1024);
  const ctx = canvas.getContext('2d');

  // Background com efeito glass
  createGlassBackground(canvas);

  // Logo TCS centralizado
  drawTCSPin(ctx, 256, 150, 512);

  // Salvar
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync('assets/icon.png', buffer);
  fs.writeFileSync('assets/brand/tcs-icon-v6.png', buffer);
  console.log('✅ assets/icon.png');
  console.log('✅ assets/brand/tcs-icon-v6.png');
}

/**
 * Gera adaptive foreground (432x432) - apenas o logo
 */
async function generateAdaptiveForeground() {
  console.log('🎨 Gerando adaptive foreground (432x432)...');

  const canvas = createCanvas(432, 432);
  const ctx = canvas.getContext('2d');

  // Fundo transparente
  ctx.clearRect(0, 0, 432, 432);

  // Logo TCS centralizado (menor para safe zone do adaptive icon)
  drawTCSPin(ctx, 66, 0, 300);

  // Salvar
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync('assets/android-icon-foreground.png', buffer);
  fs.writeFileSync('assets/brand/tcs-adaptive-foreground-v6.png', buffer);
  console.log('✅ assets/android-icon-foreground.png');
  console.log('✅ assets/brand/tcs-adaptive-foreground-v6.png');
}

/**
 * Gera adaptive background (432x432) - background glass
 */
async function generateAdaptiveBackground() {
  console.log('🎨 Gerando adaptive background (432x432)...');

  const canvas = createCanvas(432, 432);

  // Background com efeito glass
  createGlassBackground(canvas);

  // Salvar
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

  // Fundo transparente
  ctx.clearRect(0, 0, 432, 432);

  // Logo em branco puro para themed icons
  const monoColors = {
    green: '#FFFFFF',
    darkGreen: '#FFFFFF',
    charcoal: '#FFFFFF',
    white: '#000000', // Invertido para contraste
    glass: 'rgba(255, 255, 255, 0)',
  };

  drawTCSPin(ctx, 66, 0, 300, monoColors);

  // Salvar
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync('assets/android-icon-monochrome.png', buffer);
  fs.writeFileSync('assets/brand/tcs-monochrome-v6.png', buffer);
  console.log('✅ assets/android-icon-monochrome.png');
  console.log('✅ assets/brand/tcs-monochrome-v6.png');
}

/**
 * Gera favicon (48x48)
 */
async function generateFavicon() {
  console.log('🌐 Gerando favicon (48x48)...');

  const canvas = createCanvas(48, 48);
  const ctx = canvas.getContext('2d');

  // Background sólido
  ctx.fillStyle = COLORS.white;
  ctx.fillRect(0, 0, 48, 48);

  // Logo simplificado
  drawTCSPin(ctx, 5, -2, 38);

  // Salvar
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync('assets/favicon.png', buffer);
  fs.writeFileSync('assets/brand/tcs-favicon-v6.png', buffer);
  console.log('✅ assets/favicon.png');
  console.log('✅ assets/brand/tcs-favicon-v6.png');
}

/**
 * Gera ícone de notificação (96x96)
 */
async function generateNotification() {
  console.log('🔔 Gerando ícone de notificação (96x96)...');

  const canvas = createCanvas(96, 96);
  const ctx = canvas.getContext('2d');

  // Fundo transparente
  ctx.clearRect(0, 0, 96, 96);

  // Logo compacto
  drawTCSPin(ctx, 10, 2, 76);

  // Salvar
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync('assets/notification-icon.png', buffer);
  fs.writeFileSync('assets/brand/tcs-notification-v6.png', buffer);
  console.log('✅ assets/notification-icon.png');
  console.log('✅ assets/brand/tcs-notification-v6.png');
}

/**
 * Gera splash icon (288x288)
 */
async function generateSplashIcon() {
  console.log('💫 Gerando splash icon (288x288)...');

  const canvas = createCanvas(288, 288);
  const ctx = canvas.getContext('2d');

  // Fundo transparente
  ctx.clearRect(0, 0, 288, 288);

  // Logo centralizado
  drawTCSPin(ctx, 32, 10, 224);

  // Salvar
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync('assets/splash-icon.png', buffer);
  fs.writeFileSync('assets/brand/tcs-splash-v6.png', buffer);
  console.log('✅ assets/splash-icon.png');
  console.log('✅ assets/brand/tcs-splash-v6.png');
}

/**
 * Gera preview do Android
 */
async function generateAndroidPreview() {
  console.log('📱 Gerando preview Android...');

  const canvas = createCanvas(1200, 800);
  const ctx = canvas.getContext('2d');

  // Background escuro
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(0, 0, 1200, 800);

  // Título
  ctx.fillStyle = '#F1F5F9';
  ctx.font = 'bold 32px Inter, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Prévia do Ícone no Android', 600, 60);

  // Seção: Tela Inicial
  ctx.fillStyle = '#94A3B8';
  ctx.font = '20px Inter, Arial, sans-serif';
  ctx.fillText('Tela Inicial', 200, 130);

  // Adaptive icon preview (redondo)
  const iconX = 200;
  const iconY = 240;
  const iconSize = 200;

  ctx.save();
  ctx.beginPath();
  ctx.arc(iconX, iconY, iconSize / 2, 0, Math.PI * 2);
  ctx.clip();

  // Background
  const bgCanvas = createCanvas(432, 432);
  createGlassBackground(bgCanvas);
  ctx.drawImage(bgCanvas, iconX - iconSize / 2, iconY - iconSize / 2, iconSize, iconSize);

  // Foreground
  const fgCanvas = createCanvas(432, 432);
  const fgCtx = fgCanvas.getContext('2d');
  drawTCSPin(fgCtx, 66, 0, 300);
  ctx.drawImage(fgCanvas, iconX - iconSize / 2, iconY - iconSize / 2, iconSize, iconSize);

  ctx.restore();

  // Label
  ctx.fillStyle = '#F1F5F9';
  ctx.font = '16px Inter, Arial, sans-serif';
  ctx.fillText('TCS', iconX, iconY + iconSize / 2 + 30);

  // Seção: Grid de Apps
  ctx.fillStyle = '#94A3B8';
  ctx.font = '20px Inter, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Grid de Apps (tamanho real)', 700, 130);

  // Grid 3x2
  const gridStartX = 520;
  const gridStartY = 180;
  const gridSize = 80;
  const gridGap = 20;

  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      const x = gridStartX + col * (gridSize + gridGap);
      const y = gridStartY + row * (gridSize + gridGap);

      // Fundo do ícone
      if (col === 1 && row === 0) {
        // Ícone TCS destacado
        ctx.save();
        ctx.beginPath();
        ctx.arc(x + gridSize / 2, y + gridSize / 2, gridSize / 2, 0, Math.PI * 2);
        ctx.clip();

        const smallBg = createCanvas(432, 432);
        createGlassBackground(smallBg);
        ctx.drawImage(smallBg, x, y, gridSize, gridSize);

        const smallFg = createCanvas(432, 432);
        const smallFgCtx = smallFg.getContext('2d');
        drawTCSPin(smallFgCtx, 66, 0, 300);
        ctx.drawImage(smallFg, x, y, gridSize, gridSize);

        ctx.restore();

        // Label TCS
        ctx.fillStyle = '#F1F5F9';
        ctx.font = '11px Inter, Arial, sans-serif';
        ctx.fillText('TCS', x + gridSize / 2, y + gridSize + 16);
      } else {
        // Placeholder
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.arc(x + gridSize / 2, y + gridSize / 2, gridSize / 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#475569';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('📱', x + gridSize / 2, y + gridSize / 2 + 8);

        ctx.fillStyle = '#64748B';
        ctx.font = '11px Inter, Arial, sans-serif';
        ctx.fillText('App', x + gridSize / 2, y + gridSize + 16);
      }
    }
  }

  // Seção: Notificação
  ctx.fillStyle = '#94A3B8';
  ctx.font = '20px Inter, Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Notificação', 100, 480);

  // Card de notificação
  ctx.fillStyle = '#2D3748';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 4;

  const notifX = 100;
  const notifY = 520;
  const notifW = 1000;
  const notifH = 120;

  ctx.beginPath();
  ctx.roundRect(notifX, notifY, notifW, notifH, 12);
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Ícone de notificação
  const notifIconCanvas = createCanvas(96, 96);
  const notifIconCtx = notifIconCanvas.getContext('2d');
  drawTCSPin(notifIconCtx, 10, 2, 76);
  ctx.drawImage(notifIconCanvas, notifX + 20, notifY + 20, 80, 80);

  // Texto da notificação
  ctx.fillStyle = '#F1F5F9';
  ctx.font = 'bold 18px Inter, Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('TCS - Relatório de Risco', notifX + 120, notifY + 45);

  ctx.fillStyle = '#CBD5E1';
  ctx.font = '15px Inter, Arial, sans-serif';
  ctx.fillText('Nova vistoria disponível', notifX + 120, notifY + 70);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '13px Inter, Arial, sans-serif';
  ctx.fillText('Toque para visualizar os detalhes', notifX + 120, notifY + 92);

  ctx.fillStyle = '#64748B';
  ctx.textAlign = 'right';
  ctx.fillText('agora', notifX + notifW - 20, notifY + 45);

  // Salvar
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync('preview-icon-android-v6.png', buffer);
  console.log('✅ preview-icon-android-v6.png');
}

/**
 * Executa geração de todos osícones
 */
async function main() {
  console.log('\n🎨 TCS Icon Generator v6 - Professional Edition\n');
  console.log('📦 Logo: Pin com checkmark (verde petróleo)\n');

  try {
    // Criar diretório se não existir
    if (!fs.existsSync('assets/brand')) {
      fs.mkdirSync('assets/brand', { recursive: true });
    }

    await generateMainIcon();
    await generateAdaptiveForeground();
    await generateAdaptiveBackground();
    await generateMonochrome();
    await generateFavicon();
    await generateNotification();
    await generateSplashIcon();
    await generateAndroidPreview();

    console.log('\n✨ Todos osícones foram gerados com sucesso!\n');
    console.log('📂 Arquivos gerados:');
    console.log('   • assets/icon.png (1024x1024)');
    console.log('   • assets/android-icon-foreground.png (432x432)');
    console.log('   • assets/android-icon-background.png (432x432)');
    console.log('   • assets/android-icon-monochrome.png (432x432)');
    console.log('   • assets/favicon.png (48x48)');
    console.log('   • assets/notification-icon.png (96x96)');
    console.log('   • assets/splash-icon.png (288x288)');
    console.log('   • preview-icon-android-v6.png\n');

  } catch (error) {
    console.error('❌ Erro ao gerar ícones:', error);
    process.exit(1);
  }
}

main();
