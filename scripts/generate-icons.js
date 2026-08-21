const { createCanvas, loadImage } = require('canvas');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Cores do branding TCS
const COLORS = {
  primary: '#2F6B5B',
  primaryLight: '#3D8A76',
  background: '#EDF3F0',
  white: '#FFFFFF',
  dark: '#0F1411',
};

// Criar ícone de notificação monocromático (silhueta branca)
async function createNotificationIcon() {
  const size = 192;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Fundo transparente
  ctx.clearRect(0, 0, size, size);

  // Desenhar pin de localização simplificado (silhueta branca)
  const centerX = size / 2;
  const centerY = size / 2;
  const pinWidth = size * 0.6;
  const pinHeight = size * 0.75;

  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();

  // Círculo superior do pin
  const circleRadius = pinWidth / 2.5;
  ctx.arc(centerX, centerY - pinHeight * 0.15, circleRadius, 0, Math.PI * 2);
  ctx.fill();

  // Base triangular do pin
  ctx.beginPath();
  ctx.moveTo(centerX - pinWidth * 0.35, centerY - pinHeight * 0.15);
  ctx.lineTo(centerX + pinWidth * 0.35, centerY - pinHeight * 0.15);
  ctx.lineTo(centerX, centerY + pinHeight * 0.25);
  ctx.closePath();
  ctx.fill();

  // Checkmark no centro
  ctx.strokeStyle = COLORS.primary;
  ctx.lineWidth = size * 0.08;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(centerX - circleRadius * 0.35, centerY - pinHeight * 0.15);
  ctx.lineTo(centerX - circleRadius * 0.1, centerY - pinHeight * 0.15 + circleRadius * 0.25);
  ctx.lineTo(centerX + circleRadius * 0.4, centerY - pinHeight * 0.15 - circleRadius * 0.3);
  ctx.stroke();

  const buffer = canvas.toBuffer('image/png');
  await sharp(buffer)
    .resize(96, 96)
    .toFile(path.join(__dirname, '../assets/brand/tcs-notification.png'));

  console.log('✓ Ícone de notificação criado');
}

// Criar ícone do app com efeito glass
async function createGlassIcon() {
  const size = 1024;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Fundo com gradiente suave
  const bgGradient = ctx.createLinearGradient(0, 0, size, size);
  bgGradient.addColorStop(0, COLORS.background);
  bgGradient.addColorStop(1, '#D5E5DE');
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, size, size);

  // Camada de glass com blur (simulado)
  const glassRadius = size * 0.42;
  const centerX = size / 2;
  const centerY = size / 2;

  // Shadow externa suave
  ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
  ctx.shadowBlur = size * 0.08;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = size * 0.02;

  // Camada de vidro fosco
  const glassGradient = ctx.createRadialGradient(
    centerX, centerY - size * 0.1, 0,
    centerX, centerY, glassRadius
  );
  glassGradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  glassGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.85)');
  glassGradient.addColorStop(1, 'rgba(255, 255, 255, 0.75)');

  ctx.beginPath();
  ctx.arc(centerX, centerY, glassRadius, 0, Math.PI * 2);
  ctx.fillStyle = glassGradient;
  ctx.fill();

  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Borda sutil do glass
  ctx.beginPath();
  ctx.arc(centerX, centerY, glassRadius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = size * 0.005;
  ctx.stroke();

  // Reflexo de vidro (highlight no topo)
  const highlightGradient = ctx.createLinearGradient(
    centerX, centerY - glassRadius * 0.8,
    centerX, centerY - glassRadius * 0.2
  );
  highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
  highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

  ctx.beginPath();
  ctx.ellipse(
    centerX,
    centerY - glassRadius * 0.4,
    glassRadius * 0.7,
    glassRadius * 0.35,
    0, 0, Math.PI * 2
  );
  ctx.fillStyle = highlightGradient;
  ctx.fill();

  // Ícone do pin com gradiente
  const pinScale = 0.5;
  const pinCenterY = centerY + size * 0.03;

  const iconGradient = ctx.createLinearGradient(
    centerX, pinCenterY - size * 0.25,
    centerX, pinCenterY + size * 0.25
  );
  iconGradient.addColorStop(0, COLORS.primaryLight);
  iconGradient.addColorStop(1, COLORS.primary);

  // Círculo do pin
  const pinCircleRadius = size * 0.18 * pinScale;
  ctx.beginPath();
  ctx.arc(centerX, pinCenterY - size * 0.08, pinCircleRadius, 0, Math.PI * 2);
  ctx.fillStyle = iconGradient;
  ctx.fill();

  // Base do pin
  ctx.beginPath();
  ctx.moveTo(centerX - size * 0.15 * pinScale, pinCenterY - size * 0.08);
  ctx.lineTo(centerX + size * 0.15 * pinScale, pinCenterY - size * 0.08);
  ctx.lineTo(centerX, pinCenterY + size * 0.15 * pinScale);
  ctx.closePath();
  ctx.fillStyle = iconGradient;
  ctx.fill();

  // Shadow interna no pin
  ctx.globalCompositeOperation = 'multiply';
  const shadowGradient = ctx.createLinearGradient(
    centerX, pinCenterY - size * 0.08,
    centerX, pinCenterY + size * 0.15 * pinScale
  );
  shadowGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  shadowGradient.addColorStop(1, 'rgba(0, 0, 0, 0.15)');

  ctx.beginPath();
  ctx.moveTo(centerX - size * 0.15 * pinScale, pinCenterY - size * 0.08);
  ctx.lineTo(centerX + size * 0.15 * pinScale, pinCenterY - size * 0.08);
  ctx.lineTo(centerX, pinCenterY + size * 0.15 * pinScale);
  ctx.closePath();
  ctx.fillStyle = shadowGradient;
  ctx.fill();

  ctx.globalCompositeOperation = 'source-over';

  // Checkmark branco no centro do pin
  ctx.strokeStyle = COLORS.white;
  ctx.lineWidth = size * 0.025;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(centerX - pinCircleRadius * 0.35, pinCenterY - size * 0.08);
  ctx.lineTo(centerX - pinCircleRadius * 0.1, pinCenterY - size * 0.08 + pinCircleRadius * 0.3);
  ctx.lineTo(centerX + pinCircleRadius * 0.45, pinCenterY - size * 0.08 - pinCircleRadius * 0.35);
  ctx.stroke();

  const buffer = canvas.toBuffer('image/png');

  // Ícone principal (1024x1024)
  await sharp(buffer)
    .toFile(path.join(__dirname, '../assets/brand/tcs-icon-v5.png'));

  console.log('✓ Ícone principal com efeito glass criado');
}

// Criar adaptive icon com efeito glass para Android
async function createAdaptiveIcon() {
  const size = 1024;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Fundo transparente para adaptive icon
  ctx.clearRect(0, 0, size, size);

  // Área segura do adaptive icon (círculo central com raio de 66% do tamanho)
  const centerX = size / 2;
  const centerY = size / 2;
  const safeRadius = size * 0.33;

  // Camada de glass translúcida
  const glassGradient = ctx.createRadialGradient(
    centerX, centerY - size * 0.05, 0,
    centerX, centerY, safeRadius * 1.2
  );
  glassGradient.addColorStop(0, 'rgba(237, 243, 240, 0.95)');
  glassGradient.addColorStop(0.7, 'rgba(237, 243, 240, 0.85)');
  glassGradient.addColorStop(1, 'rgba(237, 243, 240, 0)');

  ctx.beginPath();
  ctx.arc(centerX, centerY, safeRadius * 1.3, 0, Math.PI * 2);
  ctx.fillStyle = glassGradient;
  ctx.fill();

  // Ícone do pin (maior para adaptive)
  const pinScale = 0.7;

  const iconGradient = ctx.createLinearGradient(
    centerX, centerY - size * 0.2,
    centerX, centerY + size * 0.2
  );
  iconGradient.addColorStop(0, COLORS.primaryLight);
  iconGradient.addColorStop(1, COLORS.primary);

  // Círculo do pin
  const pinCircleRadius = size * 0.15 * pinScale;
  ctx.beginPath();
  ctx.arc(centerX, centerY - size * 0.06, pinCircleRadius, 0, Math.PI * 2);
  ctx.fillStyle = iconGradient;
  ctx.fill();

  // Base do pin
  ctx.beginPath();
  ctx.moveTo(centerX - size * 0.12 * pinScale, centerY - size * 0.06);
  ctx.lineTo(centerX + size * 0.12 * pinScale, centerY - size * 0.06);
  ctx.lineTo(centerX, centerY + size * 0.12 * pinScale);
  ctx.closePath();
  ctx.fillStyle = iconGradient;
  ctx.fill();

  // Checkmark
  ctx.strokeStyle = COLORS.white;
  ctx.lineWidth = size * 0.02;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(centerX - pinCircleRadius * 0.35, centerY - size * 0.06);
  ctx.lineTo(centerX - pinCircleRadius * 0.1, centerY - size * 0.06 + pinCircleRadius * 0.3);
  ctx.lineTo(centerX + pinCircleRadius * 0.45, centerY - size * 0.06 - pinCircleRadius * 0.35);
  ctx.stroke();

  const buffer = canvas.toBuffer('image/png');

  await sharp(buffer)
    .toFile(path.join(__dirname, '../assets/brand/tcs-adaptive-foreground-v5.png'));

  console.log('✓ Adaptive icon com efeito glass criado');
}

// Criar favicon
async function createFavicon() {
  const size = 512;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Fundo com cor do branding
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, size, size);

  const centerX = size / 2;
  const centerY = size / 2;

  // Ícone do pin
  const iconGradient = ctx.createLinearGradient(
    centerX, centerY - size * 0.3,
    centerX, centerY + size * 0.3
  );
  iconGradient.addColorStop(0, COLORS.primaryLight);
  iconGradient.addColorStop(1, COLORS.primary);

  // Círculo do pin
  const pinCircleRadius = size * 0.25;
  ctx.beginPath();
  ctx.arc(centerX, centerY - size * 0.08, pinCircleRadius, 0, Math.PI * 2);
  ctx.fillStyle = iconGradient;
  ctx.fill();

  // Base do pin
  ctx.beginPath();
  ctx.moveTo(centerX - size * 0.2, centerY - size * 0.08);
  ctx.lineTo(centerX + size * 0.2, centerY - size * 0.08);
  ctx.lineTo(centerX, centerY + size * 0.25);
  ctx.closePath();
  ctx.fillStyle = iconGradient;
  ctx.fill();

  // Checkmark
  ctx.strokeStyle = COLORS.white;
  ctx.lineWidth = size * 0.04;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(centerX - pinCircleRadius * 0.35, centerY - size * 0.08);
  ctx.lineTo(centerX - pinCircleRadius * 0.1, centerY - size * 0.08 + pinCircleRadius * 0.3);
  ctx.lineTo(centerX + pinCircleRadius * 0.45, centerY - size * 0.08 - pinCircleRadius * 0.35);
  ctx.stroke();

  const buffer = canvas.toBuffer('image/png');

  await sharp(buffer)
    .resize(32, 32)
    .toFile(path.join(__dirname, '../assets/brand/tcs-favicon.png'));

  console.log('✓ Favicon criado');
}

async function main() {
  console.log('🎨 Gerando ícones com efeito glass...\n');

  await createNotificationIcon();
  await createGlassIcon();
  await createAdaptiveIcon();
  await createFavicon();

  console.log('\n✅ Todos os ícones foram gerados com sucesso!');
  console.log('\nPróximos passos:');
  console.log('1. Gerar novo APK com: eas build --platform android --profile preview');
  console.log('2. Instalar e testar as notificações');
}

main().catch(console.error);
