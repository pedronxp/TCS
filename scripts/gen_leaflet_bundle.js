const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const base = path.join(root, 'node_modules');
const outPath = path.join(root, 'utils', 'leafletBundle.ts');

const files = {
  leafletCss: path.join(base, 'leaflet', 'dist', 'leaflet.css'),
  leafletJs: path.join(base, 'leaflet', 'dist', 'leaflet.js'),
  clusterCss: path.join(base, 'leaflet.markercluster', 'dist', 'MarkerCluster.css'),
  clusterDefaultCss: path.join(base, 'leaflet.markercluster', 'dist', 'MarkerCluster.Default.css'),
  clusterJs: path.join(base, 'leaflet.markercluster', 'dist', 'leaflet.markercluster.js'),
  heatJs: path.join(base, 'leaflet.heat', 'dist', 'leaflet-heat.js'),
};

let out = '// Auto-gerado por scripts/gen_leaflet_bundle.js — nao editar manualmente\n';
out += '// Bundle local do Leaflet para uso no iOS/Android WebView sem dependencia de CDN\n\n';

for (const [key, filePath] of Object.entries(files)) {
  const content = fs.readFileSync(filePath, 'utf8');
  // JSON.stringify escapa corretamente todos os caracteres especiais
  out += 'export const ' + key + ': string = ' + JSON.stringify(content) + ';\n\n';
}

fs.writeFileSync(outPath, out);
console.log('Gerado: ' + outPath + ' (' + Math.round(Buffer.byteLength(out) / 1024) + 'KB)');
