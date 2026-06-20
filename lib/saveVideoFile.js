const path = require('path');
const fs = require('fs');
const { uploadDir } = require('./imageOptimize');

const videoDir = path.join(uploadDir, 'review-videos');

if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });

function safeBaseName(name) {
  const base = path
    .basename(name || 'video', path.extname(name || ''))
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return base || 'video';
}

function extForMime(mimetype) {
  const m = String(mimetype || '').toLowerCase();
  if (m === 'video/mp4') return '.mp4';
  if (m === 'video/webm') return '.webm';
  if (m === 'video/quicktime') return '.mov';
  if (m === 'video/x-msvideo') return '.avi';
  return '.mp4';
}

async function saveVideoFile(file) {
  if (!file?.buffer?.length) throw new Error('Empty video file');

  const ext = extForMime(file.mimetype);
  const filename = `${Date.now()}-${safeBaseName(file.originalname)}${ext}`;
  const outPath = path.join(videoDir, filename);
  await fs.promises.writeFile(outPath, file.buffer);

  return {
    url: `/uploads/review-videos/${filename}`,
    filename,
    bytes: file.buffer.length,
  };
}

module.exports = { saveVideoFile, videoDir };
