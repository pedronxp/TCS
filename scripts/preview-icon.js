const { createCanvas, loadImage } = require('canvas');
const sharp = require('sharp');
const path = require('path');

async function createIconPreview() {
  // Canvas grande para mostrar múltiplas views
  const width = 1200;
  const height = 800;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Fundo simulando tela do Android
  const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
  bgGradient.addColorStop(0, '#1a1a2e');
  bgGradient.addColorStop(1, '#16213e');
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, width, height);

  // Título
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Prévia do Ícone no Android', width / 2, 50);

  // Carregar o ícone gerado
  const icon = await loadImage(path.join(__dirname, '../assets/brand/tcs-icon-v5.png'));
  const adaptiveIcon = await loadImage(path.join(__dirname, '../assets/brand/tcs-adaptive-foreground-v5.png'));

  // ===== SEÇÃO 1: Ícone no launcher (grande) =====
  const section1X = 150;
  const section1Y = 120;

  // Fundo da seção
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.roundRect(section1X - 30, section1Y - 20, 340, 420, 20);
  ctx.fill();

  // Label
  ctx.fillStyle = '#aaaaaa';
  ctx.font = '18px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Tela Inicial', section1X + 140, section1Y);

  // Desenhar ícone grande (formato quadrado arredondado - padrão Android)
  const iconSize1 = 280;
  const iconX1 = section1X + (280 - iconSize1) / 2;
  const iconY1 = section1Y + 40;

  // Sombra do ícone
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 15;

  // Desenhar ícone com bordas arredondadas (adaptive icon)
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(iconX1, iconY1, iconSize1, iconSize1, iconSize1 * 0.22);
  ctx.clip();

  // Background do adaptive icon
  ctx.fillStyle = '#EDF3F0';
  ctx.fillRect(iconX1, iconY1, iconSize1, iconSize1);

  // Foreground
  ctx.drawImage(adaptiveIcon, iconX1, iconY1, iconSize1, iconSize1);
  ctx.restore();

  ctx.shadowColor = 'transparent';

  // Nome do app abaixo do ícone
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('TCS - Relatório de Risco', section1X + 140, iconY1 + iconSize1 + 35);

  // ===== SEÇÃO 2: Grid de ícones (tamanho real) =====
  const section2X = 550;
  const section2Y = 120;

  // Fundo da seção
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.roundRect(section2X - 30, section2Y - 20, 600, 280, 20);
  ctx.fill();

  // Label
  ctx.fillStyle = '#aaaaaa';
  ctx.font = '18px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Grid de Apps (tamanho real)', section2X + 270, section2Y);

  // Desenhar grid 4x2 de ícones
  const iconSize2 = 100;
  const spacing = 40;
  const gridStartX = section2X + 50;
  const gridStartY = section2Y + 40;

  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 4; col++) {
      const x = gridStartX + col * (iconSize2 + spacing);
      const y = gridStartY + row * (iconSize2 + spacing);

      // Ícones placeholder (cinza) exceto o do meio
      const isTCSIcon = (row === 0 && col === 1);

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x, y, iconSize2, iconSize2, iconSize2 * 0.22);
      ctx.clip();

      if (isTCSIcon) {
        // Nosso ícone TCS
        ctx.shadowColor = 'rgba(47, 107, 91, 0.6)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 8;

        ctx.fillStyle = '#EDF3F0';
        ctx.fillRect(x, y, iconSize2, iconSize2);
        ctx.drawImage(adaptiveIcon, x, y, iconSize2, iconSize2);
      } else {
        // Ícones placeholder
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(x, y, iconSize2, iconSize2);

        // Ícone genérico
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.font = '48px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('📱', x + iconSize2 / 2, y + iconSize2 / 2);
      }

      ctx.restore();
      ctx.shadowColor = 'transparent';

      // Nome do app
      ctx.fillStyle = isTCSIcon ? '#ffffff' : '#888888';
      ctx.font = isTCSIcon ? 'bold 11px Arial' : '11px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const appName = isTCSIcon ? 'TCS' : 'App';
      ctx.fillText(appName, x + iconSize2 / 2, y + iconSize2 + 8);
    }
  }

  // ===== SEÇÃO 3: Notificação =====
  const section3X = 150;
  const section3Y = 580;

  // Fundo da seção
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.roundRect(section3X - 30, section3Y - 60, 1000, 180, 20);
  ctx.fill();

  // Label
  ctx.fillStyle = '#aaaaaa';
  ctx.font = '18px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Notificação', section3X + 470, section3Y - 40);

  // Card de notificação
  const notifX = section3X + 20;
  const notifY = section3Y;
  const notifWidth = 880;
  const notifHeight = 100;

  // Sombra do card
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 10;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.roundRect(notifX, notifY, notifWidth, notifHeight, 15);
  ctx.fill();

  ctx.shadowColor = 'transparent';

  // Carregar ícone de notificação
  const notifIcon = await loadImage(path.join(__dirname, '../assets/brand/tcs-notification.png'));

  // Ícone da notificação (pequeno, circular)
  const notifIconSize = 60;
  const notifIconX = notifX + 20;
  const notifIconY = notifY + (notifHeight - notifIconSize) / 2;

  // Círculo de fundo para o ícone
  ctx.fillStyle = '#2F6B5B';
  ctx.beginPath();
  ctx.arc(notifIconX + notifIconSize / 2, notifIconY + notifIconSize / 2, notifIconSize / 2, 0, Math.PI * 2);
  ctx.fill();

  // Desenhar ícone de notificação
  ctx.drawImage(notifIcon, notifIconX, notifIconY, notifIconSize, notifIconSize);

  // Texto da notificação
  const textX = notifIconX + notifIconSize + 20;
  const textY = notifY + 25;

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('TCS - Relatório de Risco', textX, textY);

  ctx.fillStyle = '#cccccc';
  ctx.font = '15px Arial';
  ctx.fillText('Nova vistoria disponível', textX, textY + 28);

  ctx.fillStyle = '#999999';
  ctx.font = '13px Arial';
  ctx.fillText('Toque para visualizar os detalhes', textX, textY + 52);

  // Hora da notificação
  ctx.fillStyle = '#888888';
  ctx.font = '12px Arial';
  ctx.textAlign = 'right';
  ctx.fillText('agora', notifX + notifWidth - 20, textY);

  // Salvar preview
  const buffer = canvas.toBuffer('image/png');
  await sharp(buffer)
    .toFile(path.join(__dirname, '../preview-icon-android.png'));

  console.log('✅ Prévia criada: preview-icon-android.png');
  console.log('\nAbra o arquivo para ver como o ícone vai aparecer no Android!');
}

createIconPreview().catch(console.error);
