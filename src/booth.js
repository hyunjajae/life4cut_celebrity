// src/booth.js
// config 기반 촬영 컨트롤러. 카메라 프리뷰(필터+연예인 오버레이) + 카운트다운 + 셔터.
// 촬영 중 타임랩스용 프레임을 setInterval(clipIntervalMs)로 버퍼링(rAF 저하와 무관하게 프레임 수 일정).
// ESC로 카운트다운 일시정지/재개(숫자 숨김+버퍼링 정지). shotCount만큼 찍으면
// onComplete(shots) — shots[i] = { photo, frames, captureMs(일시정지 제외 실제 촬영시간) }
import { APP, assetUrl } from './config.js';
import { filterString } from './filters.js';

export function createBooth({ config, video, canvas, els, isMirror, onComplete }) {
  const cell = config.layouts[0].cutLayout[0];
  const W = Math.round(cell.w * APP.captureScale);
  const H = Math.round(cell.h * APP.captureScale);
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const filter = filterString(config.theme && config.theme.filter);
  const shotCount = config.shotCount || 8;
  const cdSec = config.countdown || APP.defaultCountdown;

  // 컷 촬영 시 같이 찍히는 연예인 오버레이(누끼) 이미지들 — shot마다 순환 사용
  const overlayImgs = (config.overlays || []).map((file) => {
    const im = new Image();
    im.onerror = () => console.warn('[오버레이 없음]', file);
    im.src = assetUrl(config, file);
    return im;
  });

  // 오버레이가 다 로드된 뒤에야 카운트다운(=버퍼링) 시작 → 타임랩스 첫 프레임에도 오버레이가 빠짐없이 나옴
  const overlaysReady = Promise.all(overlayImgs.map((im) => new Promise((resolve) => {
    if (im.complete) return resolve();
    im.addEventListener('load', resolve, { once: true });
    im.addEventListener('error', resolve, { once: true });
  })));
  const overlaysReadyOrTimeout = Promise.race([
    overlaysReady,
    new Promise((resolve) => setTimeout(resolve, 4000)),
  ]);

  const CLIP_W = APP.clipW;
  const CLIP_H = Math.round(CLIP_W * H / W);
  const clipMaxFrames = Math.ceil((cdSec * 1000) / APP.clipIntervalMs) + 4;

  let shotIndex = 0;
  let shots = [];           // { photo, frames, captureMs }
  let clipBuffer = [];      // 현재 shot의 버퍼 프레임(작은 캔버스)
  let sampleTimer = null;
  let bufferStartT = 0;     // 현재 활성 버퍼링 구간 시작 시각
  let bufferElapsedMs = 0;  // 일시정지 제외한 누적 버퍼링 시간
  let paused = false;
  let phase = 'idle';       // idle | countdown | preview
  let countdown = cdSec;
  let timer = null;
  let raf = null;
  let previewImg = null;
  let running = false;

  function start() {
    running = true;
    paused = false;
    shotIndex = 0;
    shots = [];
    clipBuffer = [];
    loop(); // 카메라 프리뷰는 바로 시작
    overlaysReadyOrTimeout.then(() => {
      if (!running) return;
      startCountdown();
    });
  }

  function stop() {
    running = false;
    paused = false;
    clearInterval(timer);
    clearInterval(sampleTimer);
    if (raf) cancelAnimationFrame(raf);
  }

  // 현재 캔버스를 작은 크기로 버퍼에 저장(최근 것만 유지)
  function sampleClip() {
    const sc = document.createElement('canvas');
    sc.width = CLIP_W;
    sc.height = CLIP_H;
    sc.getContext('2d').drawImage(canvas, 0, 0, CLIP_W, CLIP_H);
    clipBuffer.push(sc);
    if (clipBuffer.length > clipMaxFrames) clipBuffer.shift();
  }

  // 렌더 루프(카메라 프리뷰만). 버퍼링은 setInterval이 담당. 일시정지 중에도 프리뷰는 계속.
  function loop() {
    if (!running) return;
    if (phase === 'preview' && previewImg) {
      ctx.drawImage(previewImg, 0, 0, W, H);
    } else {
      drawScene();
    }
    raf = requestAnimationFrame(loop);
  }

  function drawScene() {
    ctx.save();
    if (video && video.readyState >= 2 && video.videoWidth) {
      ctx.filter = filter;
      if (isMirror()) { ctx.translate(W, 0); ctx.scale(-1, 1); }
      const sw = video.videoWidth, sh = video.videoHeight;
      const s = Math.max(W / sw, H / sh);
      const dw = sw * s, dh = sh * s;
      ctx.drawImage(video, (W - dw) / 2, (H - dh) / 2, dw, dh);
    } else {
      ctx.fillStyle = '#141414';
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();

    if (overlayImgs.length) {
      const ov = overlayImgs[shotIndex % overlayImgs.length];
      if (ov && ov.complete && ov.naturalWidth) ctx.drawImage(ov, 0, 0, W, H);
    }

    updateProgress();
  }

  function tick() {
    countdown -= 1;
    if (countdown <= 0) {
      clearInterval(timer);
      shoot();
    } else {
      els.countdown.textContent = countdown;
    }
  }

  function startCountdown() {
    phase = 'countdown';
    paused = false;
    countdown = cdSec;
    clipBuffer = [];
    bufferElapsedMs = 0;
    bufferStartT = performance.now();
    els.countdown.textContent = countdown;
    els.countdown.classList.remove('hidden');
    clearInterval(timer);
    clearInterval(sampleTimer);
    sampleTimer = setInterval(sampleClip, APP.clipIntervalMs); // rAF와 무관한 일정 간격 버퍼링
    timer = setInterval(tick, 1000);
  }

  // ESC: 카운트다운 일시정지/재개 (숫자 숨김 + 카운트다운·버퍼링 정지)
  function togglePause() {
    if (!running || phase !== 'countdown') return;
    if (!paused) {
      paused = true;
      clearInterval(timer);
      clearInterval(sampleTimer);
      bufferElapsedMs += performance.now() - bufferStartT; // 활성 버퍼링 시간 누적
      els.countdown.classList.add('hidden');               // 숫자 숨김
    } else {
      paused = false;
      els.countdown.textContent = countdown;
      els.countdown.classList.remove('hidden');
      bufferStartT = performance.now();
      sampleTimer = setInterval(sampleClip, APP.clipIntervalMs);
      timer = setInterval(tick, 1000);
    }
  }

  // 스페이스바 등으로 남은 카운트다운 건너뛰고 즉시 촬영(일시정지 중엔 무시)
  function skip() {
    if (phase === 'countdown' && !paused) {
      clearInterval(timer);
      shoot();
    }
  }

  function shoot() {
    clearInterval(timer);
    clearInterval(sampleTimer);
    drawScene();  // 최신 프레임(카메라+오버레이) 확실히 렌더
    sampleClip(); // 셔터 순간 프레임도 버퍼에 포함
    const captureMs = bufferElapsedMs + (performance.now() - bufferStartT); // 일시정지 제외 실제 촬영시간
    const dataURL = canvas.toDataURL('image/png');
    shots.push({ photo: dataURL, frames: clipBuffer.slice(), captureMs });

    // 플래시
    els.flash.classList.add('on');
    setTimeout(() => els.flash.classList.remove('on'), APP.flashMs);

    // 미리보기용 정지 이미지
    const img = new Image();
    img.onload = () => { previewImg = img; };
    img.src = dataURL;

    phase = 'preview';
    els.countdown.classList.add('hidden');

    setTimeout(() => {
      previewImg = null;
      shotIndex += 1;
      if (shotIndex >= shotCount) {
        stop();
        onComplete(shots);
      } else {
        startCountdown();
      }
    }, APP.previewMs);
  }

  function updateProgress() {
    const n = Math.min(shotIndex + 1, shotCount);
    els.progress.textContent = `${n} / ${shotCount}`;
  }

  return { start, stop, skip, togglePause };
}
