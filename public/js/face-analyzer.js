/**
 * Raku Skin Scan — 3-step wizard (intro → instructions → camera → results).
 */
(function () {
  const API = (window.RAKU_API_BASE || '') + '/api/face-analyzer';

  const STEPS = ['intro', 'instructions', 'loading', 'scan', 'results'];
  const FAB_POPUPS = [
    { emoji: '👋', msg: 'ফ্রি স্কিন টেস্ট...', avatar: '/images/skin-scan-avatar-1.jpg' },
    { emoji: '✨', msg: 'AI দিয়ে ত্বক বিশ্লেষণ', avatar: '/images/skin-scan-avatar-2.jpg' },
    { emoji: '💜', msg: 'ব্যক্তিগত স্কিনকেয়ার টিপ', avatar: '/images/skin-scan-avatar-3.jpg' },
    { emoji: '📸', msg: '৩-২-১ এ অটো স্ক্যান', avatar: '/images/skin-scan-avatar-4.jpg' },
    { emoji: '🔬', msg: 'স্পট, তৈলতা ও পোর চেক', avatar: '/images/skin-scan-avatar-5.jpg' },
    { emoji: '🎁', msg: 'একদম ফ্রি — ট্যাপ করুন!', avatar: '/images/skin-scan-avatar-6.jpg' },
  ];
  const FAB_ROTATE_MS = 5000;
  const FAB_FADE_MS = 400;

  let modalOpen = false;
  let currentStep = 'intro';
  let selectedFile = null;
  let mediaStream = null;
  let loadingTimer = null;
  let countdownToken = 0;
  let fabRotateTimer = null;
  let fabPopupIdx = 0;

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function setStatus(type, html) {
    const el = $('face-analyzer-status');
    if (!el) return;
    el.className = 'fa-status-msg visible' + (type ? ' ' + type : '');
    el.innerHTML = html;
  }

  function clearStatus() {
    const el = $('face-analyzer-status');
    if (el) {
      el.className = 'fa-status-msg';
      el.innerHTML = '';
    }
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function cancelCountdown() {
    countdownToken += 1;
    const el = $('fa-scan-countdown');
    const scan = $('fa-step-scan');
    if (el) {
      el.hidden = true;
      el.className = 'fa-scan-countdown';
      el.textContent = '';
    }
    scan?.classList.remove('counting');
  }

  function showStep(step) {
    if (step !== 'scan') cancelCountdown();
    currentStep = step;
    STEPS.forEach((s) => {
      const el = $('fa-step-' + s);
      if (el) el.classList.toggle('active', s === step);
    });

    const modal = $('fa-modal');
    if (modal) {
      modal.classList.toggle('fa-modal--scan', step === 'scan');
      modal.classList.toggle('fa-modal--results', step === 'results');
    }

    if (step === 'scan') {
      $('fa-step-scan')?.classList.add('scanning');
    } else {
      $('fa-step-scan')?.classList.remove('scanning');
    }
  }

  function stopCamera() {
    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => t.stop());
      mediaStream = null;
    }
    const video = $('face-analyzer-video');
    if (video) video.srcObject = null;
  }

  async function startCamera() {
    stopCamera();
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('error', 'Camera is not supported. Use Upload photo instead.');
      showStep('results');
      return false;
    }

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
        audio: false,
      });
      const video = $('face-analyzer-video');
      if (video) {
        video.srcObject = mediaStream;
        await video.play().catch(() => {});
      }
      return true;
    } catch (err) {
      const msg =
        err?.name === 'NotAllowedError'
          ? 'Camera permission denied. Allow camera access or tap Upload photo.'
          : err?.name === 'NotFoundError'
            ? 'No camera found on this device.'
            : 'Could not start camera. Try Upload photo.';
      setStatus('error', msg);
      showStep('results');
      return false;
    }
  }

  async function waitForVideoReady(video, maxMs) {
    const start = Date.now();
    while (Date.now() - start < maxMs) {
      if (video?.readyState >= 2 && video.videoWidth > 0) return true;
      await delay(120);
    }
    return video?.readyState >= 2;
  }

  async function startAutoCaptureCountdown() {
    const token = ++countdownToken;
    const video = $('face-analyzer-video');
    const overlay = $('fa-scan-countdown');
    const badge = $('fa-scan-badge');
    const scan = $('fa-step-scan');

    await waitForVideoReady(video, 4000);
    if (token !== countdownToken || currentStep !== 'scan') return;

    scan?.classList.add('counting');
    if (badge) badge.textContent = 'HOLD STILL — AUTO CAPTURE';

    const steps = [
      { n: '3', badge: '3…' },
      { n: '2', badge: '2…' },
      { n: '1', badge: '1…' },
    ];

    if (overlay) {
      overlay.hidden = false;
      overlay.classList.add('visible');
    }

    for (const step of steps) {
      if (token !== countdownToken || currentStep !== 'scan') return;
      if (overlay) {
        overlay.textContent = step.n;
        overlay.classList.remove('flash');
        overlay.classList.add('pop');
        void overlay.offsetWidth;
        overlay.classList.remove('pop');
      }
      if (badge) badge.textContent = step.badge;
      await delay(1000);
    }

    if (token !== countdownToken || currentStep !== 'scan') return;

    if (overlay) {
      overlay.textContent = 'CAPTURE';
      overlay.classList.add('flash');
    }
    if (badge) badge.textContent = 'CAPTURE!';
    await delay(350);
    cancelCountdown();
    captureFromCamera();
  }

  function captureFromCamera() {
    cancelCountdown();
    const video = $('face-analyzer-video');
    if (!video || !mediaStream || video.readyState < 2) {
      setStatus('error', 'Wait for the camera preview, then try again.');
      showStep('results');
      return;
    }

    const w = video.videoWidth || 720;
    const h = video.videoHeight || 960;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, w, h);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setStatus('error', 'Could not capture photo. Try again.');
          showStep('results');
          return;
        }
        selectedFile = new File([blob], 'camera-selfie.jpg', { type: 'image/jpeg' });
        runAnalysis();
      },
      'image/jpeg',
      0.92
    );
  }

  function onFilePick(file) {
    if (!file) return;
    if (!/^image\/(jpeg|jpg|png)$/i.test(file.type)) {
      setStatus('error', 'Please use a JPG or PNG photo.');
      showStep('results');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setStatus('error', 'Image must be under 10 MB.');
      showStep('results');
      return;
    }
    selectedFile = file;
    runAnalysis();
  }

  function renderResults(data) {
    const box = $('face-analyzer-results');
    if (!box) return;
    const cards = (data.cards || [])
      .map(
        (c) =>
          `<div class="fa-result-card"><b>${escapeHtml(c.value)}</b><span>${escapeHtml(c.label)}</span></div>`
      )
      .join('');
    const tips = (data.tips || [])
      .map((t) => `<li>${escapeHtml(t)}</li>`)
      .join('');
    const rows = (data.details || [])
      .map(
        (r) =>
          `<div class="fa-result-row"><b>${escapeHtml(r.label)}</b>${escapeHtml(r.value)}</div>`
      )
      .join('');

    box.innerHTML = `
      ${cards ? `<div class="fa-results-grid">${cards}</div>` : ''}
      ${rows ? `<div class="fa-results-detail">${rows}</div>` : ''}
      ${
        tips
          ? `<div style="margin-top:16px;"><h4 style="font-size:14px;color:#1e3a5f;margin:0 0 8px;">Beauty tips</h4><ul style="margin:0;padding-left:18px;font-size:13px;color:#475569;">${tips}</ul></div>`
          : ''
      }
      ${!cards && !rows ? '<p style="font-size:13px;color:#64748b;">Analysis complete. Check tips below if available.</p>' : ''}`;
  }

  async function runAnalysis() {
    if (!selectedFile) {
      setStatus('error', 'No photo to analyze. Scan again.');
      showStep('results');
      return;
    }

    stopCamera();
    clearStatus();
    showStep('loading');
    $('fa-step-loading').querySelector('.fa-loading-sub').textContent = 'ANALYZING YOUR SKIN…';

    try {
      const fd = new FormData();
      fd.append('photo', selectedFile);
      const res = await fetch(API + '/analyze', {
        method: 'POST',
        body: fd,
        credentials: 'same-origin',
      });
      let data = {};
      try {
        data = await res.json();
      } catch (_) {
        data = { ok: false, error: 'Invalid server response' };
      }
      if (!res.ok && res.status === 404) {
        setStatus(
          'error',
          'Face analyzer API is not available. Restart the server (npm start) or redeploy the latest code.'
        );
        $('fa-step-loading').querySelector('.fa-loading-sub').textContent = 'AI SKIN ANALYZER';
        showStep('results');
        return;
      }
      if (!data.ok) {
        setStatus('error', escapeHtml(data.error || 'Analysis failed'));
        $('fa-step-loading').querySelector('.fa-loading-sub').textContent = 'AI SKIN ANALYZER';
        showStep('results');
        return;
      }
      $('fa-step-loading').querySelector('.fa-loading-sub').textContent = 'AI SKIN ANALYZER';
      renderResults(data);
      showStep('results');
    } catch (_) {
      setStatus('error', 'Network error. Please try again.');
      $('fa-step-loading').querySelector('.fa-loading-sub').textContent = 'AI SKIN ANALYZER';
      showStep('results');
    }
  }

  function goToLoadingThenScan() {
    cancelCountdown();
    showStep('loading');
    if (loadingTimer) clearTimeout(loadingTimer);
    loadingTimer = setTimeout(async () => {
      loadingTimer = null;
      showStep('scan');
      clearStatus();
      const badge = $('fa-scan-badge');
      if (badge) badge.textContent = 'POSITION YOUR FACE IN THE CIRCLE';
      const ok = await startCamera();
      if (ok) startAutoCaptureCountdown();
    }, 2200);
  }

  function resetWizard() {
    cancelCountdown();
    if (loadingTimer) {
      clearTimeout(loadingTimer);
      loadingTimer = null;
    }
    selectedFile = null;
    const input = $('face-analyzer-file');
    if (input) input.value = '';
    clearStatus();
    $('face-analyzer-results').innerHTML = '';
    const sub = $('fa-step-loading')?.querySelector('.fa-loading-sub');
    if (sub) sub.textContent = 'AI SKIN ANALYZER';
    stopCamera();
    showStep('intro');
  }

  function preloadFabAvatars() {
    FAB_POPUPS.forEach((item) => {
      if (!item.avatar) return;
      const img = new Image();
      img.src = item.avatar;
    });
  }

  function setFabAvatar(src, fade) {
    const img = $('fa-fab-avatar-img');
    if (!img || !src) return;
    if (!fade) {
      img.src = src;
      img.classList.remove('is-fading');
      return;
    }
    img.classList.add('is-fading');
    setTimeout(() => {
      img.src = src;
      img.classList.remove('is-fading');
    }, FAB_FADE_MS);
  }

  function setFabPopup(item, fadeAvatar) {
    const emoji = $('fa-fab-emoji');
    const msg = $('fa-fab-msg');
    const fab = $('face-analyzer-fab');
    if (emoji) emoji.textContent = item.emoji;
    if (msg) msg.textContent = item.msg;
    if (item.avatar) setFabAvatar(item.avatar, fadeAvatar);
    if (fab) {
      fab.setAttribute('aria-label', item.msg);
      fab.title = item.msg;
    }
  }

  function cycleFabPopup() {
    if (modalOpen) return;
    const popup = $('fa-fab-popup');
    const avatarImg = $('fa-fab-avatar-img');
    if (!popup) return;

    popup.classList.remove('is-visible');
    popup.classList.add('is-hiding');
    if (avatarImg) avatarImg.classList.add('is-fading');

    setTimeout(() => {
      if (modalOpen) return;
      fabPopupIdx = (fabPopupIdx + 1) % FAB_POPUPS.length;
      const item = FAB_POPUPS[fabPopupIdx];
      setFabPopup(item, false);
      popup.classList.remove('is-hiding');
      void popup.offsetWidth;
      popup.classList.add('is-visible');
      if (avatarImg) avatarImg.classList.remove('is-fading');
    }, FAB_FADE_MS);
  }

  function startFabRotation() {
    stopFabRotation();
    fabPopupIdx = 0;
    setFabPopup(FAB_POPUPS[0], false);
    const popup = $('fa-fab-popup');
    if (popup) {
      popup.classList.remove('is-hiding');
      popup.classList.add('is-visible');
    }
    fabRotateTimer = setInterval(cycleFabPopup, FAB_ROTATE_MS);
  }

  function stopFabRotation() {
    if (fabRotateTimer) {
      clearInterval(fabRotateTimer);
      fabRotateTimer = null;
    }
  }

  function openModal() {
    modalOpen = true;
    stopFabRotation();
    $('fa-modal')?.classList.add('open');
    $('face-analyzer-backdrop')?.classList.add('open');
    document.body.style.overflow = 'hidden';
    resetWizard();
  }

  function closeModal() {
    modalOpen = false;
    cancelCountdown();
    if (loadingTimer) {
      clearTimeout(loadingTimer);
      loadingTimer = null;
    }
    stopCamera();
    $('fa-modal')?.classList.remove('open');
    $('face-analyzer-backdrop')?.classList.remove('open');
    document.body.style.overflow = '';
    showStep('intro');
    startFabRotation();
  }

  function bindEvents() {
    $('face-analyzer-fab')?.addEventListener('click', openModal);
    $('face-analyzer-close')?.addEventListener('click', closeModal);
    $('face-analyzer-backdrop')?.addEventListener('click', closeModal);

    $('fa-btn-start')?.addEventListener('click', () => showStep('instructions'));
    $('fa-btn-get-started')?.addEventListener('click', goToLoadingThenScan);
    $('fa-btn-scan-again')?.addEventListener('click', () => {
      cancelCountdown();
      selectedFile = null;
      clearStatus();
      $('face-analyzer-results').innerHTML = '';
      stopCamera();
      showStep('instructions');
    });

    $('fa-btn-upload-fallback')?.addEventListener('click', () => {
      cancelCountdown();
      $('face-analyzer-file')?.click();
    });

    const input = $('face-analyzer-file');
    input?.addEventListener('change', () => {
      const f = input.files?.[0];
      if (f) onFilePick(f);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modalOpen) closeModal();
    });
  }

  function hideFab() {
    const fab = $('face-analyzer-fab');
    if (fab) fab.style.display = 'none';
    stopFabRotation();
  }

  function isAdminFeatureOn() {
    const s = window.__RAKU_BOOTSTRAP?.settings;
    if (s && Object.prototype.hasOwnProperty.call(s, 'face_analyzer_enabled')) {
      return s.face_analyzer_enabled !== '0';
    }
    return true;
  }

  async function init() {
    const fab = $('face-analyzer-fab');
    if (!fab) return;

    if (!isAdminFeatureOn()) {
      hideFab();
      return;
    }

    try {
      const res = await fetch(API + '/config');
      const cfg = await res.json();
      if (!cfg.enabled) {
        if (cfg.adminEnabled === false) {
          hideFab();
          return;
        }
        hideFab();
        return;
      }
    } catch (_) {
      hideFab();
      return;
    }

    fab.style.display = 'flex';
    bindEvents();
    preloadFabAvatars();
    startFabRotation();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleInit, { once: true });
  } else {
    scheduleInit();
  }

  function scheduleInit() {
    if (window.requestIdleCallback) {
      requestIdleCallback(() => void init(), { timeout: 6000 });
    } else {
      setTimeout(() => void init(), 3000);
    }
  }
})();
