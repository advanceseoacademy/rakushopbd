const multer = require('multer');

const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^video\/(mp4|webm|quicktime|x-msvideo)$/i.test(String(file.mimetype || ''))) {
      cb(null, true);
      return;
    }
    cb(new Error('Only MP4, WebM, MOV, or AVI videos allowed'));
  },
});

module.exports = { videoUpload };
