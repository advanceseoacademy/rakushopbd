/**
 * Perfect Corp YouCam API — Face Attribute Analysis
 * @see https://docs.perfectcorp.com/reference/ai_face_analyzer
 */

const BASE_URL = process.env.YOUCAM_API_BASE || 'https://yce-api-01.makeupar.com';

const ANALYSIS_FEATURES = [
  'faceShape',
  'eyeShape',
  'eyeSize',
  'lipShape',
  'noseWidth',
  'noseLength',
  'cheekbones',
  'age',
  'gender',
  'eyeColor',
  'lipColor',
  'eyebrowColor',
  'hairColor',
];

function getApiKey() {
  return (process.env.YOUCAM_API_KEY || process.env.PERFECTCORP_API_KEY || '').trim();
}

function isConfigured() {
  return Boolean(getApiKey());
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function youcamJson(path, options = {}) {
  const key = getApiKey();
  if (!key) {
    const err = new Error('Face analyzer is not configured on the server.');
    err.code = 'NOT_CONFIGURED';
    throw err;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      data?.error_message ||
      data?.message ||
      data?.error ||
      (typeof data?.data === 'string' ? data.data : null) ||
      `YouCam API error (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.raw = data;
    throw err;
  }
  return data;
}

async function uploadImageBuffer(buffer, fileName, mimeType) {
  const contentType = mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
  const meta = await youcamJson('/s2s/v2.0/file/face-attr-analysis', {
    method: 'POST',
    body: JSON.stringify({
      files: [
        {
          content_type: contentType,
          file_name: fileName || 'selfie.jpg',
          file_size: buffer.length,
        },
      ],
    }),
  });

  const entry = meta?.data?.files?.[0];
  const fileId = entry?.file_id;
  const upload = entry?.requests?.[0];
  if (!fileId || !upload?.url) {
    throw new Error('Could not prepare image upload.');
  }

  const putHeaders = { ...(upload.headers || {}) };
  if (!putHeaders['Content-Type'] && !putHeaders['content-type']) {
    putHeaders['Content-Type'] = contentType;
  }

  const putRes = await fetch(upload.url, {
    method: upload.method || 'PUT',
    headers: putHeaders,
    body: buffer,
  });

  if (!putRes.ok) {
    throw new Error('Failed to upload photo for analysis.');
  }

  return fileId;
}

function formatPublicResults(data) {
  const r = data?.results || {};
  const fq = r.face_quality || {};
  const cards = [];

  if (fq.has_face != null) {
    cards.push({
      label: 'Photo quality',
      value: fq.has_face
        ? `Face detected — lighting: ${fq.lighting || 'ok'}, angle: ${fq.faceangle || 'ok'}`
        : 'No face detected',
    });
  }

  if (r.faceshape) cards.push({ label: 'Face shape', value: r.faceshape });
  if (r.agegender) {
    if (r.agegender.age != null) cards.push({ label: 'Estimated age', value: String(r.agegender.age) });
    if (r.agegender.gender) cards.push({ label: 'Gender', value: r.agegender.gender });
  }
  if (r.lipshape?.length) cards.push({ label: 'Lip shape', value: r.lipshape.join(', ') });
  if (r.nose) {
    const parts = [r.nose.width, r.nose.length].filter(Boolean);
    if (parts.length) cards.push({ label: 'Nose', value: parts.join(' · ') });
  }
  if (r.cheekbone?.overrall || r.cheekbone?.overall) {
    cards.push({ label: 'Cheekbones', value: r.cheekbone.overrall || r.cheekbone.overall });
  }
  if (r.eyelid) {
    const eye = [
      r.eyelid.left_shape && `Left eye: ${r.eyelid.left_shape}`,
      r.eyelid.right_shape && `Right eye: ${r.eyelid.right_shape}`,
      r.eyelid.size && `Size: ${r.eyelid.size}`,
      r.eyelid.setting && `Spacing: ${r.eyelid.setting}`,
    ].filter(Boolean);
    if (eye.length) cards.push({ label: 'Eyes', value: eye.join(' · ') });
  }
  if (r.eyebrow) {
    const brow = [
      r.eyebrow.left_shape && `Shape: ${r.eyebrow.left_shape}`,
      r.eyebrow.gap && `Gap: ${r.eyebrow.gap}`,
    ].filter(Boolean);
    if (brow.length) cards.push({ label: 'Eyebrows', value: brow.join(' · ') });
  }
  if (r.color) {
    const c = r.color;
    if (c.skin_color) cards.push({ label: 'Skin tone', value: c.skin_color });
    if (c.eye_color_name || c.eye_color) {
      cards.push({
        label: 'Eye color',
        value: [c.eye_color_name, c.eye_color].filter(Boolean).join(' '),
      });
    }
    if (c.lip_color) cards.push({ label: 'Lip color', value: c.lip_color });
    if (c.hair_color_name || c.hair_color) {
      cards.push({
        label: 'Hair color',
        value: [c.hair_color_name, c.hair_color].filter(Boolean).join(' '),
      });
    }
  }

  const tips = [];
  if (r.faceshape === 'Oval' || r.faceshape === 'Round') {
    tips.push('Lightweight gel moisturizers and soft contour often suit your face shape.');
  }
  if (r.lipshape?.includes('Thin')) {
    tips.push('Hydrating lip balms and soft lip tints can add comfortable fullness.');
  }
  if (fq.lighting && fq.lighting !== 'good') {
    tips.push('For best results, retake your photo near a window with even lighting.');
  }
  if (!tips.length) {
    tips.push('Explore our Beauty & Personal Care section for products matched to your features.');
  }

  return { cards, tips, raw: r };
}

async function pollTask(taskId) {
  const maxAttempts = 45;
  for (let i = 0; i < maxAttempts; i++) {
    if (i > 0) await sleep(1500);
    const status = await youcamJson(
      `/s2s/v2.0/task/face-attr-analysis/${encodeURIComponent(taskId)}`,
      { method: 'GET' }
    );
    const taskStatus = status?.data?.task_status;
    if (taskStatus === 'success') {
      return formatPublicResults(status.data);
    }
    if (taskStatus === 'error') {
      const code = status?.data?.error;
      const msg = status?.data?.error_message || code || 'Face analysis failed';
      const friendly = humanizeFaceError(code, msg);
      throw new Error(friendly);
    }
  }
  throw new Error('Analysis is taking too long. Please try again.');
}

function humanizeFaceError(code, fallback) {
  const map = {
    error_face_not_forward_facing: 'Look straight at the camera and try again.',
    error_face_position_too_small: 'Move closer so your face fills more of the frame.',
    error_face_position_invalid: 'Center your face in the photo with nothing covering it.',
    error_below_min_image_size: 'Use a larger photo (at least 320×320).',
    error_face_angle_upward: 'Tilt your head slightly down.',
    error_face_angle_downward: 'Tilt your head slightly up.',
  };
  return map[code] || fallback;
}

async function analyzeFaceFromBuffer(buffer, fileName, mimeType) {
  const fileId = await uploadImageBuffer(buffer, fileName, mimeType);
  const created = await youcamJson('/s2s/v2.0/task/face-attr-analysis', {
    method: 'POST',
    body: JSON.stringify({
      src_file_id: fileId,
      face_angle_strictness_level: 'medium',
      features: ANALYSIS_FEATURES,
    }),
  });
  const taskId = created?.data?.task_id;
  if (!taskId) throw new Error('Could not start face analysis.');
  return pollTask(taskId);
}

module.exports = {
  isConfigured,
  analyzeFaceFromBuffer,
};
