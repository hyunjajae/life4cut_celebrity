// src/main.js
// 진입점 + 화면 라우터. 흐름: 랜딩 → 프레임(연예인) 선택 → 촬영 → 컷선택(레이아웃+미리보기) → 꾸미기/저장
import { APP } from './config.js';
import { loadManifest, renderGrid, preloadThumbs } from './manifest.js';
import { createBooth } from './booth.js';
import { createComposer } from './compose.js';
import { drawStrip, loadFrame, makeFrameLayer, contrastColor, pastel, todayStr } from './strip.js';

const el = (id) => document.getElementById(id);
const video = el('camera');

const state = {
  manifest: null,
  config: null,
  layout: null,
  facingMode: 'user',
  stream: null,
  shots: [],             // { photo, frames }
  photos: [],            // dataURL[]
  photoImgs: [],         // Image[]
  picks: [],             // 선택한 컷의 인덱스(슬롯 순서)
  booth: null,
  composer: null,
};

const SCREENS = ['landing', 'select', 'booth', 'cuts', 'compose'];
function show(name) {
  SCREENS.forEach((s) => el('screen-' + s).classList.toggle('active', s === name));
}

// 컷선택 미리보기
let cutsCanvas = null, cutsCtx = null;
const frameCache = {}; // layout.id -> Image|null

async function init() {
  state.manifest = await loadManifest().catch((e) => {
    console.error(e);
    return { celebrities: [] };
  });
  preloadThumbs(state.manifest); // 첫 화면에서 미리 썸네일 받아둠 → 선택화면 즉시 표시

  el('startBtn').addEventListener('click', onStart);
  el('facingBtn').addEventListener('click', toggleFacing);
  el('toComposeBtn').addEventListener('click', goCompose);
  el('retakeBtn').addEventListener('click', () => location.reload());
  el('downloadBtn').addEventListener('click', () => state.composer && state.composer.download());
  window.addEventListener('keydown', (e) => {
  // 입력창에서는 스페이스 허용
  if (
    e.target.tagName === 'INPUT' ||
    e.target.tagName === 'TEXTAREA' ||
    e.target.isContentEditable
  ) {
    return;
  }

  if (e.code === 'Space') {
    e.preventDefault();
    state.booth && state.booth.skip();
  } else if (e.code === 'Escape') {
    e.preventDefault();
    state.booth && state.booth.togglePause();
  }
});
}

async function onStart() {
  el('landingError').textContent = '';
  try {
    await startCamera();
  } catch (e) {
    console.error(e);
    el('landingError').textContent = '카메라를 열 수 없어요: ' + e.message;
    return;
  }
  renderGrid(el('celebGrid'), state.manifest, selectCeleb);
  show('select');
}

async function startCamera() {
  if (state.stream) state.stream.getTracks().forEach((t) => t.stop());
  state.stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: state.facingMode, width: { ideal: 1280 }, height: { ideal: 960 } },
  });
  video.srcObject = state.stream;
  await video.play();
}

async function toggleFacing() {
  state.facingMode = state.facingMode === 'user' ? 'environment' : 'user';
  el('facingBtn').textContent = state.facingMode === 'user' ? '📷 전면' : '📷 후면';
  if (state.stream) {
    try { await startCamera(); } catch (e) { console.error(e); }
  }
}

// 프레임(연예인) 선택 → 바로 촬영
function selectCeleb(config) {
  state.config = config;
  show('booth');
  if (state.booth) state.booth.stop();
  state.booth = createBooth({
    config,
    video,
    canvas: el('boothCanvas'),
    els: { progress: el('boothProgress'), countdown: el('boothCountdown'), flash: el('boothFlash') },
    isMirror: () => state.facingMode === 'user',
    onComplete: onShotsDone,
  });
  state.booth.start();
}

// 촬영 끝 → 컷선택 화면
async function onShotsDone(shots) {
  state.shots = shots;
  state.photos = shots.map((s) => s.photo);
  state.photoImgs = await Promise.all(state.photos.map(loadImg));
  state.picks = [];
  state.layout = state.config.layouts[0];
  buildLayoutPicker();
  buildGallery();
  buildCutsPreview();
  refreshCuts();
  show('cuts');
}

function buildLayoutPicker() {
  const p = el('layoutPicker');
  p.innerHTML = '';
  const layouts = state.config.layouts || [];
  if (layouts.length < 2) { p.style.display = 'none'; return; }
  p.style.display = '';
  layouts.forEach((lay) => {
    const b = document.createElement('button');
    b.className = 'layout-btn' + (state.layout && lay.id === state.layout.id ? ' active' : '');
    b.textContent = lay.name || lay.id;
    b.addEventListener('click', () => {
      state.layout = lay;
      const need = lay.cutLayout.length;
      if (state.picks.length > need) state.picks = state.picks.slice(0, need);
      buildLayoutPicker();
      buildCutsPreview();
      refreshCuts();
    });
    p.appendChild(b);
  });
}

function buildGallery() {
  const gal = el('shotGallery');
  gal.innerHTML = '';
  state.photos.forEach((d, idx) => {
    const wrap = document.createElement('div');
    wrap.className = 'shot-wrap';
    wrap.dataset.idx = idx;
    const im = document.createElement('img');
    im.src = d;
    im.className = 'shot';
    const badge = document.createElement('span');
    badge.className = 'shot-badge';
    wrap.append(im, badge);
    wrap.addEventListener('click', () => pickShot(idx));
    gal.appendChild(wrap);
  });
}

function buildCutsPreview() {
  const wrap = el('cutsPreview');
  wrap.innerHTML = '';
  const lay = state.layout;
  cutsCanvas = document.createElement('canvas');
  cutsCanvas.width = lay.canvasSize.w;
  cutsCanvas.height = lay.canvasSize.h;
  cutsCanvas.className = 'cuts-canvas';
  wrap.appendChild(cutsCanvas);
  cutsCtx = cutsCanvas.getContext('2d');

  if (!(lay.id in frameCache)) {
    loadFrame(state.config, lay).then((img) => {
      frameCache[lay.id] = img;
      if (state.layout && state.layout.id === lay.id) drawCutsPreview();
    });
  }
  drawCutsPreview();
  if (document.fonts && document.fonts.load) { // 웹폰트(Playfair) 로드 후 다시 그림
    Promise.all([
      document.fonts.load("500 40px 'Playfair Display'"),
      document.fonts.load("400 40px 'Playfair Display'"),
    ]).then(drawCutsPreview).catch(() => {});
  }
}

function drawCutsPreview() {
  if (!cutsCtx) return;
  const lay = state.layout;
  const arr = lay.cutLayout.map((_, i) => {
    const idx = state.picks[i];
    return idx != null ? state.photoImgs[idx] : null;
  });
  const color = pastel((state.config.theme && state.config.theme.primary) || '#f4a7c0');
  const frameImg = frameCache[lay.id] || null;
  const frameLayer = makeFrameLayer(state.config, lay, color, frameImg);
  drawStrip(cutsCtx, lay, arr, frameLayer, {
    showNumbers: true,
    caption: state.config.caption || APP.defaultCaption,
    captionColor: frameImg ? '#ffffff' : contrastColor(color),
    date: todayStr(),
  });
}

function pickShot(idx) {
  const need = state.layout.cutLayout.length;
  if (state.picks.includes(idx)) {
    state.picks = state.picks.filter((x) => x !== idx);
  } else if (state.picks.length < need) {
    state.picks.push(idx);
  }
  refreshCuts();
}

function refreshCuts() {
  const need = state.layout.cutLayout.length;
  [...el('shotGallery').children].forEach((wrap) => {
    const idx = Number(wrap.dataset.idx);
    const order = state.picks.indexOf(idx);
    wrap.classList.toggle('selected', order >= 0);
    wrap.querySelector('.shot-badge').textContent = order >= 0 ? String(order + 1) : '';
  });
  el('cutHint').textContent = `사진을 순서대로 ${need}장 선택 (${state.picks.length}/${need}) · 다시 누르면 해제`;
  el('toComposeBtn').disabled = state.picks.length !== need;
  drawCutsPreview();
}

async function goCompose() {
  const imgs = state.picks.map((idx) => state.photoImgs[idx]);
  const cutFrames = state.picks.map((idx) => state.shots[idx].frames);
  const cutDurations = state.picks.map((idx) => state.shots[idx].captureMs || 1000);
  show('compose');
  state.composer = createComposer({
    config: state.config,
    layout: state.layout,
    images: imgs,
    cutFrames,
    cutDurations,
    els: {
      stage: el('composeStage'),
      palette: el('stickerPalette'),
      frameColor: el('frameColor'),
      swatches: el('frameSwatches'),
      caption: el('captionInput'),
      videoSaveBtn: el('videoSaveBtn'),
      videoStatus: el('videoStatus'),
    },
  });
}

function loadImg(src) {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
}

init();
