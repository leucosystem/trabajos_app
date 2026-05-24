// Script para generar los iconos PNG de la PWA a partir del SVG
import sharp from 'sharp';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgPath = resolve(__dirname, '../public/icon.svg');
const svgBuffer = readFileSync(svgPath);

const icons = [
  { file: 'icon-192x192.png',         size: 192 },
  { file: 'icon-512x512.png',         size: 512 },
  { file: 'icon-maskable-192x192.png', size: 192 },
  { file: 'icon-maskable-512x512.png', size: 512 },
];

for (const icon of icons) {
  const outPath = resolve(__dirname, '../public', icon.file);
  await sharp(svgBuffer)
    .resize(icon.size, icon.size)
    .png()
    .toFile(outPath);
  console.log(`✅ Generado: ${icon.file} (${icon.size}x${icon.size})`);
}

console.log('\n✨ Todos los iconos generados en /public/');
