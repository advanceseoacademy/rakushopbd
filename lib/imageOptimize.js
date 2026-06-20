const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const uploadDir = path.join(__dirname, '../public/uploads');
const MAX_WIDTH = Number(process.env.IMAGE_MAX_WIDTH) || 1920;
const WEBP_QUALITY = Number(process.env.IMAGE_WEBP_QUALITY) || 80;

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

function safeBaseName(name) {
  const base = path
    .basename(name || 'image', path.extname(name || ''))
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice( 0, 60);
  return base || 'image';
}

function isRasterUploadExt(ext) {
  return ['.jpg', '.jpeg', '.png', '.gif'].includes(String(ext || '').toLowerCase());
}

function webpUrlForUploadUrl(url) {
  if (!url || typeof url !== 'string') return null;
  if (!url.startsWith('/uploads/')) return null;
  if (/\.webp$/i.test(url)) return null;
  if (!/\.(jpe?g|png|gif)$/i.test(url)) return null;
  return url.replace(/\.(jpe?g|png|gif)$/i, '.webp');
}

async function optimizeBufferToWebp(buffer) {
  let pipeline = sharp(buffer, { failOn: 'none' });
  const meta = await pipeline.metadata();
  if (meta.width && meta.width > MAX_WIDTH) {
    pipeline = pipeline.resize({ width: MAX_WIDTH, withoutEnlargement: true });
  }
  return pipeline.webp({ quality: WEBP_QUALITY, effort: 4 }).toBuffer();
}

/**
 * Convert an existing file on disk to WebP (same folder, .webp extension).
 */
async function convertFileToWebp(absInputPath, absOutputPath) {
  const inputBuf = await fs.promises.readFile(absInputPath);
  const output = await optimizeBufferToWebp(inputBuf);
  await fs.promises.writeFile(absOutputPath, output);
  const meta = await sharp(output).metadata();
  if (meta.format !== 'webp') {
    throw new Error(`Output is not WebP: ${absOutputPath}`);
  }
  return {
    bytesBefore: inputBuf.length,
    bytesAfter: output.length,
  };
}

/**
 * Compress uploaded image and save as WebP.
 * @param {{ buffer: Buffer, originalname?: string, size?: number }} file
 */
async function optimizeAndSaveImage(file) {
  if (!file?.buffer?.length) {
    throw new Error('Empty image file');
  }

  const bytesBefore = file.buffer.length;
  const filename = `${Date.now()}-${safeBaseName(file.originalname)}.webp`;
  const outPath = path.join(uploadDir, filename);

  const output = await optimizeBufferToWebp(file.buffer);
  await fs.promises.writeFile(outPath, output);

  return {
    url: '/uploads/' + filename,
    filename,
    bytesBefore,
    bytesAfter: output.length,
    format: 'webp',
  };
}

module.exports = {
  optimizeAndSaveImage,
  convertFileToWebp,
  optimizeBufferToWebp,
  webpUrlForUploadUrl,
  isRasterUploadExt,
  uploadDir,
};
