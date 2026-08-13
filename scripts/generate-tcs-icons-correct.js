/**
 * Gerador de Ícones TCS - Logo Correto
 *
 * Usa o logo oficial: TCS com barras coloridas em fundo escuro
 * Baseado em: assets/logo.png
 */

const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

// Paleta de cores TCS oficial
const COLORS = {
  background: '#1A202C',      // Fundo escuro
  blue: '#3B82F6',            // Azul (borda)
  text: '#FFFFFF',            // Branco (texto TCS)
  bar1: '#10B981',            // Verde
  bar2: '#F59E0B',            // Amarelo/Laranja
  bar3: '#F97316',            // Laranja
  bar4: '#EF4444',            // Vermelho
};

/**
 * Desenha o logo TCS oficial (TCS + barras coloridas)
 */
function drawTCSLogo(ctx, x, y, size) {
  const scale = size / 1024; // Escala baseada em 1024px

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // Fundo escuro com cantos arredondados
  ctx.fillStyle = COLORS.background;
  ctx.beginPath();
  ctx.roundRect(0, 0, 1024, 1024, 224);
  ctx.fill();

  // Borda azul
  ctx.strokeStyle = COLORS.blue;
  ctx.lineWidth = 24;
  ctx.beginPath();
  ctx.roundRect(12, 12, 1000, 1000, 212);
  ctx.stroke();

  // Texto "TCS"
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 420px Inter, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('TCS', 512, 420);

  // Barras coloridas
  const barWidth = 100;
  const barHeight = 24;
  const barY = 640;
  const totalWidth = barWidth * 4 + 20 * 3; // 4 barras + 3 espaços
  const startX = (1024 - totalWidth) / 2;

  const bars = [
    { color: COLORS.bar1, x: startX },
    { color: COLORS.bar2, x: startX + barWidth + 20 },
    { color: COLORS.bar3, x: startX + (barWidth + 20) * 2 },
    { color: COLORS.bar4, x: startX + (barWidth + 20) * 3 },
  ];

  bars.forEach(bar => {
    ctx.fillStyle = bar.color;
    ctx.fillRect(bar.x, barY, barWidth, barHeight);
  });

  ctx.restore();
}

/**
 * Gera ícone principal (1024x1024)
 */
async function generateMainIcon() {
  console.log('📱 Gerando ícone principal (1024x1024)...');

  const canvas = createCanvas(1024, 1024);
  const ctx = canvas.getContext('2d');

  drawTCSLogo(ctx, 0, 0, 1024);

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync('assets/icon.png', buffer);
  console.log('✅ assets/icon.png');
}

/**
 * Gera adaptive foreground (432x432)
 */
async function generateAdaptiveForeground() {
  console.log('🎨 Gerando adaptive foreground (432x432)...');

  const canvas = createCanvas(432, 432);
  const ctx = canvas.getContext('2d');

  // Fundo transparente
  ctx.clearRect(0, 0, 432, 432);

  // Logo TCS (escala ajustada para safe zone)
  const logoSize = 320;
  const offset = (432 - logoSize) / 2;

  drawTCSLogo(ctx, offset, offset, logoSize);

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync('assets/android-icon-foreground.png', buffer);
  console.log('✅ assets/android-icon-foreground.png');
}

/**
 * Gera adaptive background (432x432) - gradiente suave
 */
async function generateAdaptiveBackground() {
  console.log('🎨 Gerando adaptive background (432x432)...');

  const canvas = createCanvas(432, 432);
  const ctx = canvas.getContext('2d');

  // Gradiente radial suave
  const gradient = ctx.createRadialGradient(216, 180, 0, 216, 216, 300);
  gradient.addColorStop(0, '#2563EB');
  gradient.addColorStop(1, '#1E40AF');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 432, 432);

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync('assets/android-icon-background.png', buffer);
  console.log('✅ assets/android-icon-background.png');
}

/**
 * Gera ícone monocromático (432x432)
 */
async function generateMonochrome() {
  console.log('⚫ Gerando ícone monocromático (432x432)...');

  const canvas = createCanvas(432, 432);
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, 432, 432);

  const scale = 320 / 1024;
  const offset = (432 - 320) / 2;

  ctx.save();
  ctx.translate(offset, offset);
  ctx.scale(scale, scale);

  // Apenas o texto TCS em branco
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 420px Inter, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('TCS', 512, 420);

  // Barras em branco
  const barWidth = 100;
  const barHeight = 24;
  const barY = 640;
  const totalWidth = barWidth * 4 + 20 * 3;
  const startX = (1024 - totalWidth) / 2;

  for (let i = 0; i < 4; i++) {
    ctx.fillRect(startX + i * (barWidth + 20), barY, barWidth, barHeight);
  }

  ctx.restore();

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync('assets/android-icon-monochrome.png', buffer);
  console.log('✅ assets/android-icon-monochrome.png');
}

/**
 * Gera favicon (48x48)
 */
async function generateFavicon() {
  console.log('🌐 Gerando favicon (48x48)...');

  const canvas = createCanvas(48, 48);
  const ctx = canvas.getContext('2d');

  drawTCSLogo(ctx, 0, 0, 48);

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync('assets/favicon.png', buffer);
  console.log('✅ assets/favicon.png');
}

/**
 * Gera ícone de notificação (96x96)
 */
async function generateNotification() {
  console.log('🔔 Gerando ícone de notificação (96x96)...');

  const canvas = createCanvas(96, 96);
  const ctx = canvas.getContext('2d');

  drawTCSLogo(ctx, 0, 0, 96);

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync('assets/notification-icon.png', buffer);
  console.log('✅ assets/notification-icon.png');
}

/**
 * Gera splash icon (288x288)
 */
async function generateSplashIcon() {
  console.log('💫 Gerando splash icon (288x288)...');

  const canvas = createCanvas(288, 288);
  const ctx = canvas.getContext('2d');

  drawTCSLogo(ctx, 0, 0, 288);

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync('assets/splash-icon.png', buffer);
  console.log('✅ assets/splash-icon.png');
}

/**
 * Gera preview do Android
 */
async function generateAndroidPreview() {
  console.log('📱 Gerando preview Android...');

  const canvas = createCanvas(1200, 800);
  const ctx = canvas.getContext('2d');

  // Background escuro
  ctx.fillStyle = '#0F172A';
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

  // Adaptive icon preview (círculo)
  const iconX = 200;
  const iconY = 260;
  const iconSize = 220;

  ctx.save();
  ctx.beginPath();
  ctx.arc(iconX, iconY, iconSize / 2, 0, Math.PI * 2);
  ctx.clip();

  // Background (gradiente azul)
  const bgGradient = ctx.createRadialGradient(iconX, iconY - 30, 0, iconX, iconY, iconSize / 2);
  bgGradient.addColorStop(0, '#3B82F6');
  bgGradient.addColorStop(1, '#1E40AF');
  ctx.fillStyle = bgGradient;
  ctx.beginPath();
  ctx.arc(iconX, iconY, iconSize / 2, 0, Math.PI * 2);
  ctx.fill();

  // Logo TCS
  const logoSize = iconSize * 0.75;
  const logoOffset = iconSize * 0.125;

  const tempCanvas = createCanvas(432, 432);
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.clearRect(0, 0, 432, 432);
  drawTCSLogo(tempCtx, 56, 56, 320);

  ctx.drawImage(
    tempCanvas,
    iconX - logoSize / 2,
    iconY - logoSize / 2,
    logoSize,
    logoSize
  );

  ctx.restore();

  // Label
  ctx.fillStyle = '#F1F5F9';
  ctx.font = '16px Inter, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('TCS', iconX, iconY + iconSize / 2 + 32);

  // Seção: Grid de Apps
  ctx.fillStyle = '#94A3B8';
  ctx.font = '20px Inter, Arial, sans-serif';
  ctx.fillText('Grid de Apps (tamanho real)', 750, 130);

  // Grid 3x3
  const gridStartX = 540;
  const gridStartY = 180;
  const gridSize = 92;
  const gridGap = 24;

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const x = gridStartX + col * (gridSize + gridGap);
      const y = gridStartY + row * (gridSize + gridGap);

      if (col === 1 && row === 1) {
        // Ícone TCS
        ctx.save();
        ctx.beginPath();
        ctx.arc(x + gridSize / 2, y + gridSize / 2, gridSize / 2, 0, Math.PI * 2);
        ctx.clip();

        const smallBgGradient = ctx.createRadialGradient(
          x + gridSize / 2, y + gridSize / 3, 0,
          x + gridSize / 2, y + gridSize / 2, gridSize / 2
        );
        smallBgGradient.addColorStop(0, '#3B82F6');
        smallBgGradient.addColorStop(1, '#1E40AF');
        ctx.fillStyle = smallBgGradient;
        ctx.beginPath();
        ctx.arc(x + gridSize / 2, y + gridSize / 2, gridSize / 2, 0, Math.PI * 2);
        ctx.fill();

        const smallCanvas = createCanvas(432, 432);
        const smallCtx = smallCanvas.getContext('2d');
        smallCtx.clearRect(0, 0, 432, 432);
        drawTCSLogo(smallCtx, 56, 56, 320);

        ctx.drawImage(smallCanvas, x + gridSize * 0.125, y + gridSize * 0.125, gridSize * 0.75, gridSize * 0.75);
        ctx.restore();

        ctx.fillStyle = '#F1F5F9';
        ctx.font = '12px Inter, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('TCS', x + gridSize / 2, y + gridSize + 18);
      } else {
        // Placeholder
        ctx.fillStyle = '#1E293B';
        ctx.beginPath();
        ctx.arc(x + gridSize / 2, y + gridSize / 2, gridSize / 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = '32px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('📱', x + gridSize / 2, y + gridSize / 2 + 10);

        ctx.fillStyle = '#475569';
        ctx.font = '11px Inter, Arial, sans-serif';
        ctx.fillText('App', x + gridSize / 2, y + gridSize + 18);
      }
    }
  }

  // Seção: Notificação
  ctx.fillStyle = '#94A3B8';
  ctx.font = '20px Inter, Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Notificação', 100, 520);

  // Card de notificação
  ctx.fillStyle = '#1E293B';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 6;

  ctx.beginPath();
  ctx.roundRect(100, 560, 1000, 140, 16);
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  // Ícone na notificação
  const notifIconCanvas = createCanvas(96, 96);
  const notifIconCtx = notifIconCanvas.getContext('2d');
  drawTCSLogo(notifIconCtx, 0, 0, 96);
  ctx.drawImage(notifIconCanvas, 120, 580, 100, 100);

  // Texto da notificação
  ctx.fillStyle = '#F1F5F9';
  ctx.font = 'bold 20px Inter, Arial, sans-serif';
  ctx.fillText('TCS - Relatório de Risco', 240, 605);

  ctx.fillStyle = '#CBD5E1';
  ctx.font = '16px Inter, Arial, sans-serif';
  ctx.fillText('Nova vistoria disponível', 240, 635);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '14px Inter, Arial, sans-serif';
  ctx.fillText('Toque para visualizar os detalhes', 240, 660);

  ctx.fillStyle = '#64748B';
  ctx.font = '14px Inter, Arial, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('agora', 1060, 605);

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync('preview-icon-android.png', buffer);
  console.log('✅ preview-icon-android.png');
}

async function main() {
  console.log('\n🎨 TCS Icon Generator - Logo Oficial\n');
  console.log('📦 Usando: TCS com barras coloridas\n');

  try {
    await generateMainIcon();
    await generateAdaptiveForeground();
    await generateAdaptiveBackground();
    await generateMonochrome();
    await generateFavicon();
    await generateNotification();
    await generateSplashIcon();
    await generateAndroidPreview();

    console.log('\n✨ Todos osícones foram gerados!\n');
    console.log('📂 Arquivos:');
    console.log('   • assets/icon.png (1024x1024)');
    console.log('   • assets/android-icon-*.png (432x432)');
    console.log('   • assets/favicon.png (48x48)');
    console.log('   • assets/notification-icon.png (96x96)');
    console.log('   • assets/splash-icon.png (288x288)');
    console.log('   • preview-icon-android.png\n');

  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

main();
