const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { videoDir } = require('./saveVideoFile');

const MAX_REVIEW_VIDEO_BYTES = 1024 * 1024 * 1024;

const EXT_BY_MIME = {
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'video/x-msvideo': '.avi',
  'video/3gpp': '.3gp',
  'video/x-m4v': '.m4v',
};

function safeBaseName(name) {
  const base = path
    .basename(name || 'video', path.extname(name || ''))
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return base || 'video';
}

const videoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, videoDir),
    filename: (_req, file, cb) => {
      const ext = EXT_BY_MIME[String(file.mimetype || '').toLowerCase()] || '.mp4';
      const rand = crypto.randomBytes(4).toString('hex');
      cb(null, `${Date.now()}-${rand}-${safeBaseName(file.originalname)}${ext}`);
    },
  }),
  limits: { fileSize: MAX_REVIEW_VIDEO_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (EXT_BY_MIME[String(file.mimetype || '').toLowerCase()]) {
      cb(null, true);
      return;
    }
    cb(new Error('Only MP4, WebM, MOV, 3GP, M4V, or AVI videos allowed'));
  },
});

module.exports = { videoUpload, MAX_REVIEW_VIDEO_BYTES };
