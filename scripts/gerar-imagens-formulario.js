/**
 * Gerador de imagens de referência para os formulários.
 * Pure Node.js — usa apenas zlib (built-in).
 * Saída: assets/formularios/imagens/*.png
 */
const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

const W = 240, H = 120;

// ── CRC32 ─────────────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (const b of buf) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ b) & 0xFF];
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const d = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const len = Buffer.alloc(4); len.writeUInt32BE(d.length);
  const cc  = Buffer.alloc(4); cc.writeUInt32BE(crc32(Buffer.concat([t, d])));
  return Buffer.concat([len, t, d, cc]);
}

function makePNG(pixels) {
  const sig  = Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8]=8; ihdr[9]=2; // 8-bit RGB

  const rows = [];
  for (let y = 0; y < H; y++) {
    rows.push(0); // filter: None
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      rows.push(pixels[i], pixels[i+1], pixels[i+2]);
    }
  }
  const compressed = zlib.deflateSync(Buffer.from(rows), { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))]);
}

// ── Pixel generators ──────────────────────────────────────────────────────────

/** Cor sólida com vinheta sutil (mais escuro nas bordas) */
function solid(r, g, b) {
  const px = new Uint8Array(W * H * 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const cx = x / W - 0.5, cy = y / H - 0.5;
      const vignette = 1 - (cx*cx + cy*cy) * 0.6;
      const i = (y*W+x)*3;
      px[i]   = Math.min(255, Math.max(0, Math.round(r * vignette)));
      px[i+1] = Math.min(255, Math.max(0, Math.round(g * vignette)));
      px[i+2] = Math.min(255, Math.max(0, Math.round(b * vignette)));
    }
  }
  return px;
}

/** Gradiente horizontal */
function gradH(r1,g1,b1, r2,g2,b2) {
  const px = new Uint8Array(W * H * 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const t = x / (W - 1);
      const i = (y*W+x)*3;
      px[i]   = Math.round(r1 + (r2-r1)*t);
      px[i+1] = Math.round(g1 + (g2-g1)*t);
      px[i+2] = Math.round(b1 + (b2-b1)*t);
    }
  }
  return px;
}

/** Imagem de inclinação: céu azul acima, terra marrom abaixo, linha de encosta */
function slopeImg(angleDeg) {
  const angle = Math.min(angleDeg, 85) * Math.PI / 180;
  const slope = Math.tan(angle);
  const px = new Uint8Array(W * H * 3);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const lineY = H - x * slope;
      const i = (y*W+x)*3;
      if (y > lineY) {
        // Terra: gradiente marrom
        const d = (y - lineY) / H;
        px[i]   = Math.round(101 + d * 40);
        px[i+1] = Math.round(67  + d * 20);
        px[i+2] = Math.round(33);
      } else {
        // Céu: gradiente azul claro
        const t = y / H;
        px[i]   = Math.round(186 - t * 40);
        px[i+1] = Math.round(225 - t * 30);
        px[i+2] = 255;
      }
    }
  }
  // Linha de contorno (encosta)
  for (let x = 0; x < W; x++) {
    const ly = Math.round(H - x * slope);
    for (let dy = -2; dy <= 2; dy++) {
      const y = ly + dy;
      if (y >= 0 && y < H) {
        const i = (y*W+x)*3;
        px[i]=60; px[i+1]=40; px[i+2]=20;
      }
    }
  }
  return px;
}

/** Padrão de drenagem: canais azuis em fundo claro */
function drainageImg(level) { // 0=ok, 1=precaria, 2=sem
  const px = new Uint8Array(W * H * 3);
  // Fundo
  const bg = level === 0 ? [220,240,255] : level === 1 ? [255,245,200] : [255,225,210];
  for (let i = 0; i < W*H*3; i+=3) { px[i]=bg[0]; px[i+1]=bg[1]; px[i+2]=bg[2]; }
  // Canais: 3 linhas onduladas
  const numChannels = level === 0 ? 3 : level === 1 ? 1 : 0;
  const channelColor = level === 0 ? [30,100,200] : [150,120,60];
  for (let c = 0; c < numChannels; c++) {
    const baseY = H * (c + 1) / (numChannels + 1);
    for (let x = 0; x < W; x++) {
      const y = Math.round(baseY + Math.sin(x * 0.08) * 6);
      for (let dy = -3; dy <= 3; dy++) {
        const py = y + dy;
        if (py >= 0 && py < H) {
          const i = (py*W+x)*3;
          px[i]=channelColor[0]; px[i+1]=channelColor[1]; px[i+2]=channelColor[2];
        }
      }
    }
  }
  if (level === 2) {
    // Água acumulada: retângulo azul na base
    for (let y = Math.round(H*0.65); y < H; y++) {
      for (let x = 0; x < W; x++) {
        const t = (y - H*0.65) / (H*0.35);
        const i = (y*W+x)*3;
        px[i]=Math.round(100+t*50); px[i+1]=Math.round(140+t*20); px[i+2]=200;
      }
    }
  }
  return px;
}

/** Vegetação */
function vegImg(type) { // 'arvores'|'rasteira'|'desmatada'|'cultivo'
  const px = new Uint8Array(W * H * 3);
  const skyR=186, skyG=225, skyB=255;
  // Céu
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y*W+x)*3; px[i]=skyR; px[i+1]=skyG; px[i+2]=skyB;
    }
  }
  const groundY = Math.round(H * 0.65);
  // Solo
  const soilColor = type === 'desmatada' ? [150,100,50] : type === 'cultivo' ? [120,90,40] : [80,120,40];
  for (let y = groundY; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y*W+x)*3;
      px[i]=soilColor[0]; px[i+1]=soilColor[1]; px[i+2]=soilColor[2];
    }
  }
  if (type === 'arvores') {
    // 3 árvores: tronco + copa
    [40, 120, 200].forEach(tx => {
      // Tronco
      for (let y = groundY - 30; y < groundY; y++) {
        for (let x = tx - 4; x < tx + 4; x++) {
          if (x>=0&&x<W&&y>=0) { const i=(y*W+x)*3; px[i]=100;px[i+1]=60;px[i+2]=20; }
        }
      }
      // Copa (círculo verde)
      for (let y = groundY - 70; y < groundY - 20; y++) {
        for (let x = tx - 25; x < tx + 25; x++) {
          if (x>=0&&x<W&&y>=0) {
            const dx=x-tx, dy=y-(groundY-50);
            if (dx*dx + dy*dy < 600) {
              const i=(y*W+x)*3; px[i]=20;px[i+1]=120;px[i+2]=30;
            }
          }
        }
      }
    });
  } else if (type === 'rasteira') {
    // Capim: ondulações verdes baixas
    for (let x = 0; x < W; x++) {
      const h = 10 + Math.round(Math.sin(x * 0.3) * 5 + Math.sin(x * 0.7) * 3);
      for (let y = groundY - h; y < groundY; y++) {
        if (y>=0) { const i=(y*W+x)*3; px[i]=50+Math.round(Math.random()*20);px[i+1]=150;px[i+2]=40; }
      }
    }
  } else if (type === 'cultivo') {
    // Linhas de cultivo
    for (let row = 0; row < 3; row++) {
      const ry = groundY - 15 - row * 18;
      for (let x = 0; x < W; x++) {
        if (x % 20 < 8 && ry>=0) {
          const i=(ry*W+x)*3; px[i]=60;px[i+1]=160;px[i+2]=50;
          if (ry+1<H) { const j=((ry+1)*W+x)*3; px[j]=60;px[j+1]=160;px[j+2]=50; }
        }
      }
    }
  }
  // desmatada → sem vegetação (já está com solo exposto)
  return px;
}

/** Imagem sim/não — checkmark verde ou X vermelho */
function boolImg(isYes, isRisk) {
  // isYes: se é afirmativo; isRisk: se o afirmativo é RUIM (ex: trinca sim = ruim)
  const isBad = isYes && isRisk || (!isYes && !isRisk);
  const color = isBad ? [220,38,38] : [34,197,94];
  return solid(color[0], color[1], color[2]);
}

/** Terreno natural vs aterro */
function terrenoImg(type) {
  const px = new Uint8Array(W * H * 3);
  if (type === 'natural') {
    // Gradiente verde-marrom (encosta natural)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const t = y / H;
        const i = (y*W+x)*3;
        px[i]   = Math.round(186 + (101-186)*t);
        px[i+1] = Math.round(225 + (67-225)*t);
        px[i+2] = Math.round(255 + (33-255)*t);
      }
    }
    // Ondulação verde (encosta suave)
    for (let x = 0; x < W; x++) {
      const lineY = Math.round(H*0.5 + Math.sin(x*0.03)*10);
      for (let y = lineY; y < lineY+6; y++) {
        if (y<H) { const i=(y*W+x)*3; px[i]=40;px[i+1]=150;px[i+2]=50; }
      }
    }
  } else {
    // Aterro: camadas de terra empilhadas
    const layers = [[220,180,120],[200,150,90],[180,120,60],[160,100,40]];
    layers.forEach((c, li) => {
      const y0=Math.round(H*li/layers.length), y1=Math.round(H*(li+1)/layers.length);
      for (let y=y0;y<y1;y++) {
        for (let x=0;x<W;x++) {
          const i=(y*W+x)*3; px[i]=c[0];px[i+1]=c[1];px[i+2]=c[2];
        }
      }
    });
    // Seta para cima (empilhamento)
    for (let y=H*0.1;y<H*0.9;y++) {
      const x=W/2, hw=8;
      for (let dx=-hw;dx<=hw;dx++) {
        const xi=Math.round(x+dx);
        if (xi>=0&&xi<W&&y>=0&&y<H) { const i=(Math.round(y)*W+xi)*3; px[i]=255;px[i+1]=255;px[i+2]=255; }
      }
    }
  }
  return px;
}

/** Estado de conservacao: fundo cinza-claro com fissuras progressivas */
function estImg(nivel) {
  // nivel: 'bom' | 'regular' | 'ruim' | 'pessimo'
  const px = new Uint8Array(W * H * 3);
  // Fundo: cinza claro (230,230,230)
  for (let i = 0; i < W * H * 3; i += 3) {
    px[i] = 230; px[i+1] = 230; px[i+2] = 230;
  }
  if (nivel === 'bom') {
    // Borda verde suave (4px) nas bordas
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (x < 4 || x >= W-4 || y < 4 || y >= H-4) {
          const i = (y*W+x)*3;
          px[i]=34; px[i+1]=197; px[i+2]=94;
        }
      }
    }
    return px;
  }
  // Fissura diagonal principal: de (W*0.2, H*0.15) ate (W*0.8, H*0.85)
  const x0=Math.round(W*0.2), y0=Math.round(H*0.15);
  const x1=Math.round(W*0.8), y1=Math.round(H*0.85);
  const steps = Math.max(Math.abs(x1-x0), Math.abs(y1-y0));
  const lineW = nivel === 'regular' ? 1 : nivel === 'ruim' ? 2 : 4;
  const lineColor = nivel === 'pessimo' ? [180,40,40] : [90,90,90];
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const cx = Math.round(x0 + (x1-x0)*t);
    const cy = Math.round(y0 + (y1-y0)*t);
    for (let dy = -lineW; dy <= lineW; dy++) {
      for (let dx = -Math.floor(lineW/2); dx <= Math.floor(lineW/2); dx++) {
        const px2 = cx+dx, py2 = cy+dy;
        if (px2>=0 && px2<W && py2>=0 && py2<H) {
          const i=(py2*W+px2)*3;
          px[i]=lineColor[0]; px[i+1]=lineColor[1]; px[i+2]=lineColor[2];
        }
      }
    }
  }
  if (nivel === 'ruim' || nivel === 'pessimo') {
    // Ramificacao secundaria a partir do meio da fissura
    const mx=Math.round((x0+x1)/2), my=Math.round((y0+y1)/2);
    for (let s = 0; s < 30; s++) {
      const px2=mx+s, py2=my-s;
      if (px2<W && py2>=0) {
        const i=(py2*W+px2)*3; px[i]=lineColor[0];px[i+1]=lineColor[1];px[i+2]=lineColor[2];
      }
    }
  }
  if (nivel === 'pessimo') {
    // Segunda fissura paralela deslocada
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const cx = Math.round(x0+20 + (x1+20-x0-20)*t);
      const cy = Math.round(y0 + (y1-y0)*t);
      if (cx>=0&&cx<W&&cy>=0&&cy<H) {
        const i=(cy*W+cx)*3; px[i]=180;px[i+1]=40;px[i+2]=40;
      }
    }
  }
  return px;
}

/** Gravidade: linha horizontal com espessura e cor progressivas */
function gravImg(nivel) {
  // nivel: 'nenhuma' | 'leve' | 'moderada' | 'severa'
  const px = new Uint8Array(W * H * 3);
  // Fundo branco
  for (let i = 0; i < W*H*3; i+=3) { px[i]=245; px[i+1]=245; px[i+2]=245; }
  if (nivel === 'nenhuma') {
    // Check verde centralizado (circulo + tracos)
    const cx=W/2, cy=H/2, r=20;
    for (let y=0;y<H;y++) { for (let x=0;x<W;x++) {
      const dx=x-cx, dy=y-cy;
      if (dx*dx+dy*dy < r*r) {
        const i=(y*W+x)*3; px[i]=34;px[i+1]=197;px[i+2]=94;
      }
    }}
    // Tracos do check (simplificado como linha branca interna)
    for (let s=0;s<12;s++) {
      const xi=Math.round(cx-8+s*0.8), yi=Math.round(cy+4-Math.abs(s-6)*0.8);
      if (xi>=0&&xi<W&&yi>=0&&yi<H) {
        const i=(yi*W+xi)*3; px[i]=255;px[i+1]=255;px[i+2]=255;
      }
    }
    return px;
  }
  const lineW = nivel === 'leve' ? 1 : nivel === 'moderada' ? 3 : 6;
  const color = nivel === 'leve' ? [150,150,150] : nivel === 'moderada' ? [230,110,20] : [200,30,30];
  const cy = Math.round(H/2);
  for (let x=20; x<W-20; x++) {
    for (let dy=-lineW; dy<=lineW; dy++) {
      const y=cy+dy;
      if (y>=0&&y<H) {
        const i=(y*W+x)*3; px[i]=color[0];px[i+1]=color[1];px[i+2]=color[2];
      }
    }
  }
  if (nivel === 'severa') {
    // Deslocamento lateral: metade direita deslocada 4px para baixo
    for (let x=W/2; x<W-20; x++) {
      const i=(Math.round(cy+6)*W+Math.round(x))*3;
      if (Math.round(cy+6)<H) { px[i]=200;px[i+1]=30;px[i+2]=30; }
      // Apagar deslocamento original
      const j=(cy*W+Math.round(x))*3;
      px[j]=245;px[j+1]=245;px[j+2]=245;
    }
  }
  return px;
}

/** Extensao: grade 3x2 de celulas, marcando proporcao afetada */
function extImg(nivel) {
  // nivel: 'pontual' | 'setorial' | 'generalizada'
  const px = new Uint8Array(W * H * 3);
  // Fundo cinza claro
  for (let i=0;i<W*H*3;i+=3) { px[i]=235;px[i+1]=235;px[i+2]=235; }
  // Grade 3 colunas x 2 linhas
  const cols=3, rows=2;
  const padX=20, padY=15;
  const cellW=Math.round((W-padX*2)/cols), cellH=Math.round((H-padY*2)/rows);
  // Celulas a marcar por nivel
  const marcadas = nivel === 'pontual'
    ? [[1,0]]                                    // so celula central superior
    : nivel === 'setorial'
    ? [[0,0],[1,0],[1,1]]                        // ~50%
    : [[0,0],[1,0],[2,0],[0,1],[1,1],[2,1]];    // todas (generalizada)
  const marcadasSet = new Set(marcadas.map(([c,r])=>`${c},${r}`));
  const colorMarca = nivel === 'pontual' ? [220,38,38]
    : nivel === 'setorial' ? [230,110,20]
    : [200,30,30];
  for (let r=0;r<rows;r++) {
    for (let c=0;c<cols;c++) {
      const x0=padX+c*cellW+2, y0=padY+r*cellH+2;
      const x1=x0+cellW-4, y1=y0+cellH-4;
      const isMarcada = marcadasSet.has(`${c},${r}`);
      const fill = isMarcada ? colorMarca : [210,210,210];
      for (let y=y0;y<y1&&y<H;y++) {
        for (let x=x0;x<x1&&x<W;x++) {
          const i=(y*W+x)*3; px[i]=fill[0];px[i+1]=fill[1];px[i+2]=fill[2];
        }
      }
      // Borda da celula
      for (let x=x0;x<x1&&x<W;x++) {
        if (y0>=0&&y0<H) { const i=(y0*W+x)*3;px[i]=160;px[i+1]=160;px[i+2]=160; }
        const ye=y1-1; if(ye>=0&&ye<H) { const i=(ye*W+x)*3;px[i]=160;px[i+1]=160;px[i+2]=160; }
      }
      for (let y=y0;y<y1&&y<H;y++) {
        if (x0>=0&&x0<W) { const i=(y*W+x0)*3;px[i]=160;px[i+1]=160;px[i+2]=160; }
        const xe=x1-1; if(xe>=0&&xe<W) { const i=(y*W+xe)*3;px[i]=160;px[i+1]=160;px[i+2]=160; }
      }
    }
  }
  return px;
}

// ── Gerar e salvar ────────────────────────────────────────────────────────────
const OUT = path.join(__dirname, '..', 'assets', 'formularios', 'imagens');
fs.mkdirSync(OUT, { recursive: true });

function save(name, pixels) {
  fs.writeFileSync(path.join(OUT, name + '.png'), makePNG(pixels));
  process.stdout.write(`  ✓ ${name}.png\n`);
}

console.log('\n=== Gerando imagens de severidade ===');
save('nv0', solid(34, 197, 94));     // verde — sem risco
save('nv1', solid(132, 204, 22));    // lima
save('nv2', solid(234, 179, 8));     // amarelo
save('nv3', solid(249, 115, 22));    // laranja
save('nv4', solid(239, 68, 68));     // vermelho claro
save('nv5', solid(220, 38, 38));     // vermelho
save('nv6', solid(153, 27, 27));     // vermelho escuro

console.log('\n=== Gerando imagens de inclinação ===');
save('inclinacao_10', slopeImg(10));
save('inclinacao_17', slopeImg(17));
save('inclinacao_30', slopeImg(30));
save('inclinacao_60', slopeImg(60));
save('inclinacao_90', slopeImg(85));

console.log('\n=== Gerando imagens de drenagem ===');
save('drenagem_ok',       drainageImg(0));
save('drenagem_precaria', drainageImg(1));
save('drenagem_sem',      drainageImg(2));

console.log('\n=== Gerando imagens de vegetação ===');
save('veg_arvores',   vegImg('arvores'));
save('veg_rasteira',  vegImg('rasteira'));
save('veg_desmatada', vegImg('desmatada'));
save('veg_cultivo',   vegImg('cultivo'));

console.log('\n=== Gerando imagens de terreno ===');
save('terreno_natural', terrenoImg('natural'));
save('terreno_aterro',  terrenoImg('aterro'));

console.log('\n=== Gerando imagens sim/não ===');
save('opcao_nao', solid(34, 197, 94));    // verde = ok / sem problema
save('opcao_sim', solid(220, 38, 38));    // vermelho = atenção

console.log('\n=== Gerando imagens estruturais v2 ===');
save('est_bom',          estImg('bom'));
save('est_regular',      estImg('regular'));
save('est_ruim',         estImg('ruim'));
save('est_pessimo',      estImg('pessimo'));
save('grav_nenhuma',     gravImg('nenhuma'));
save('grav_leve',        gravImg('leve'));
save('grav_moderada',    gravImg('moderada'));
save('grav_severa',      gravImg('severa'));
save('ext_pontual',      extImg('pontual'));
save('ext_setorial',     extImg('setorial'));
save('ext_generalizada', extImg('generalizada'));

console.log('\n✅ Todas as imagens geradas em:', OUT, '\n');
