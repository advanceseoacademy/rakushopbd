const express = require('express');
const multer = require('multer');
const { isConfigured, analyzeFaceFromBuffer } = require('../lib/youcamApi');
const { getFaceAnalyzerSettings } = require('../lib/faceAnalyzerFeature');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter(req, file, cb) {
    const ok = /^image\/(jpeg|jpg|png)$/i.test(file.mimetype);
    cb(ok ? null : new Error('Only JPG or PNG images are allowed'), ok);
  },
});

router.get('/config', async (req, res) => {
  try {
    const fa = await getFaceAnalyzerSettings();
    res.json({
      ok: true,
      enabled: fa.enabled,
      adminEnabled: fa.adminEnabled,
      apiConfigured: fa.apiConfigured,
      provider: 'YouCam / Perfect Corp',
      docsUrl: 'https://docs.perfectcorp.com/reference/ai_face_analyzer',
    });
  } catch (err) {
    console.error('face-analyzer config', err);
    res.json({
      ok: true,
      enabled: false,
      adminEnabled: false,
      apiConfigured: isConfigured(),
      provider: 'YouCam / Perfect Corp',
    });
  }
});

router.post('/analyze', (req, res, next) => {
  upload.single('photo')(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        ok: false,
        error: err.message || 'Invalid image upload',
      });
    }
    next();
  });
}, async (req, res) => {
  try {
    const fa = await getFaceAnalyzerSettings();
    if (!fa.adminEnabled) {
      return res.status(403).json({
        ok: false,
        error: 'Skin analysis is turned off in store settings.',
      });
    }
    if (!isConfigured()) {
      return res.status(503).json({
        ok: false,
        error: 'Face analyzer is not set up yet. Add YOUCAM_API_KEY to server .env.',
      });
    }

    if (!req.file?.buffer?.length) {
      return res.status(400).json({ ok: false, error: 'Please upload a clear front-facing selfie (JPG).' });
    }

    const result = await analyzeFaceFromBuffer(
      req.file.buffer,
      req.file.originalname || 'selfie.jpg',
      req.file.mimetype
    );

    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('face-analyzer', err);
    const status = err.code === 'NOT_CONFIGURED' ? 503 : 400;
    res.status(status).json({
      ok: false,
      error: err.message || 'Could not analyze face',
    });
  }
});

module.exports = router;
