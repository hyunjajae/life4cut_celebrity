// src/compose.js
// 꾸미기 화면: 사진 합성(프레임 색/하단 문구+날짜/스티커) + PNG 저장 + 타임랩스 영상(mp4) 저장.
import { APP } from './config.js';
import { buildPalette, emojiToCanvas } from './stickers.js';
import { drawStrip, makeFrameLayer, loadFrame, contrastColor, pastel, todayStr } from './strip.js';
import { createVideoMaker } from './video.js';

// 파스텔(흰색에 가까운) 프레임 색 + 흰/검
const SWATCHES = [
  '#FAD3E0', // 핑크
  '#FAD9D2', // 코랄
  '#FDEBD2', // 피치
  '#FBF3CE', // 옐로
  '#DBF2E3', // 민트
  '#D6EEF7', // 스카이
  '#C7D9F0', // 블루
  '#E4D6F2', // 라벤더
  '#FFFFFF', // 화이트
  '#2B2B33', // 다크
];

export function createComposer({ config, layout, images, cutFrames, cutDurations, els }) {
  const CW = layout.canvasSize.w;
  const CH = layout.canvasSize.h;
  const dateText = todayStr();

  // ── 상태 ──
  let frameColor = pastel((config.theme && config.theme.primary) || '#f4a7c0');
  let caption = config.caption || APP.defaultCaption;
  let frameImg = null;
  let frameLayer = makeFrameLayer(config, layout, frameColor, null);
  const stickers = [];

  const captionColor = () => (frameImg ? '#ffffff' : contrastColor(frameColor));

  // ── 스테이지 ──
  els.stage.innerHTML = '';
  const baseCanvas = document.createElement('canvas');
  baseCanvas.width = CW;
  baseCanvas.height = CH;
  baseCanvas.className = 'base-canvas';
  const stickerLayer = document.createElement('div');
  stickerLayer.className = 'sticker-layer';
  els.stage.append(baseCanvas, stickerLayer);
  const bctx = baseCanvas.getContext('2d');

  loadFrame(config, layout).then((img) => {
    frameImg = img;
    frameLayer = makeFrameLayer(config, layout, frameColor, frameImg);
    redrawBase();
  });

  const displayScale = () => baseCanvas.clientWidth / CW;
  function rebuildFrameLayer() { frameLayer = makeFrameLayer(config, layout, frameColor, frameImg); }
  function redrawBase() {
    drawStrip(bctx, layout, images, frameLayer, { caption, captionColor: captionColor(), date: dateText });
  }

  // ── 컨트롤: 프레임 색 / 문구 ──
  els.frameColor.value = frameColor;
  els.caption.value = caption;
  els.frameColor.addEventListener('input', () => {
    frameColor = els.frameColor.value;
    rebuildFrameLayer();
    redrawBase();
  });
  els.caption.addEventListener('input', () => {
    caption = els.caption.value;
    redrawBase();
  });
  if (els.swatches) {
    els.swatches.innerHTML = '';
    SWATCHES.forEach((col) => {
      const b = document.createElement('button');
      b.className = 'frame-swatch';
      b.style.background = col;
      b.addEventListener('click', () => {
        frameColor = col;
        els.frameColor.value = col;
        rebuildFrameLayer();
        redrawBase();
      });
      els.swatches.appendChild(b);
    });
  }

  // ── 스티커 ──
  function addSticker(source) {
    const targetW = Math.round(CW * 0.28);
    const targetH = Math.round((targetW * source.height) / source.width);
    const st = { source, x: (CW - targetW) / 2, y: (CH - targetH) / 2, w: targetW, h: targetH, el: null };

    const el = document.createElement('div');
    el.className = 'sticker-item';
    const im = document.createElement('img');
    im.src = source.toDataURL ? source.toDataURL() : source.src;
    im.draggable = false;
    const del = document.createElement('button');
    del.className = 'st-del';
    del.textContent = '×';
    const handle = document.createElement('div');
    handle.className = 'st-handle';
    el.append(im, del, handle);
    stickerLayer.appendChild(el);

    st.el = el;
    stickers.push(st);
    layoutSticker(st);
    wireSticker(st, del, handle);
  }

  function layoutSticker(st) {
    const sc = displayScale();
    st.el.style.left = st.x * sc + 'px';
    st.el.style.top = st.y * sc + 'px';
    st.el.style.width = st.w * sc + 'px';
    st.el.style.height = st.h * sc + 'px';
  }

  function bringToFront(st) {
    stickerLayer.appendChild(st.el);
    const i = stickers.indexOf(st);
    if (i >= 0) { stickers.splice(i, 1); stickers.push(st); }
  }

  function wireSticker(st, del, handle) {
    del.addEventListener('pointerdown', (e) => e.stopPropagation());
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      st.el.remove();
      const i = stickers.indexOf(st);
      if (i >= 0) stickers.splice(i, 1);
    });

    st.el.addEventListener('pointerdown', (e) => {
      if (e.target === handle || e.target === del) return;
      e.preventDefault();
      bringToFront(st);
      st.el.setPointerCapture(e.pointerId);
      const sc = displayScale();
      const sx = e.clientX, sy = e.clientY, ox = st.x, oy = st.y;
      const move = (ev) => {
        st.x = ox + (ev.clientX - sx) / sc;
        st.y = oy + (ev.clientY - sy) / sc;
        layoutSticker(st);
      };
      const up = () => {
        st.el.removeEventListener('pointermove', move);
        st.el.removeEventListener('pointerup', up);
      };
      st.el.addEventListener('pointermove', move);
      st.el.addEventListener('pointerup', up);
    });

    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handle.setPointerCapture(e.pointerId);
      const sc = displayScale();
      const sx = e.clientX, ow = st.w, ratio = st.h / st.w;
      const move = (ev) => {
        const nw = Math.max(40, ow + (ev.clientX - sx) / sc);
        st.w = nw;
        st.h = nw * ratio;
        layoutSticker(st);
      };
      const up = () => {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', up);
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up);
    });
  }

  function buildPaletteUI() {
    els.palette.innerHTML = '';
    buildPalette(config).forEach((item) => {
      const b = document.createElement('button');
      b.className = 'palette-item';
      const im = document.createElement('img');
      if (item.type === 'emoji') {
        im.src = emojiToCanvas(item.key, 96).toDataURL();
        b.addEventListener('click', () => addSticker(emojiToCanvas(item.key, 256)));
      } else {
        im.src = item.src;
        im.onerror = () => b.remove();
        b.addEventListener('click', () => {
          const full = new Image();
          full.onload = () => addSticker(full);
          full.src = item.src;
        });
      }
      b.appendChild(im);
      els.palette.appendChild(b);
    });
  }

  // ── 사진 저장(PNG) ──
  function exportCanvas() {
    const out = document.createElement('canvas');
    out.width = CW;
    out.height = CH;
    const octx = out.getContext('2d');
    drawStrip(octx, layout, images, frameLayer, { caption, captionColor: captionColor(), date: dateText });
    stickers.forEach((st) => octx.drawImage(st.source, st.x, st.y, st.w, st.h));
    return out;
  }

  function download() {
    const url = exportCanvas().toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `life4cut_${config.id}_${layout.id}_${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // ── 영상(타임랩스) 저장만 ──
  const video = createVideoMaker({
    layout,
    cutFrames,
    cutDurations,
    getFrameLayer: () => frameLayer,
    getCaption: () => caption,
    getCaptionColor: () => captionColor(),
    getDate: () => dateText,
    getStickers: () => stickers,
  });

  function saveVideo() {
    els.videoStatus.textContent = '영상 만드는 중… (몇 초 걸려요)';
    els.videoSaveBtn.disabled = true;
    video.record((blob, ext) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `life4cut_${config.id}_${layout.id}_${Date.now()}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      els.videoStatus.textContent = `영상 저장 완료! (${ext}) 🎬`;
      els.videoSaveBtn.disabled = false;
    }, (err) => {
      els.videoStatus.textContent = err;
      els.videoSaveBtn.disabled = false;
    });
  }
  els.videoSaveBtn.addEventListener('click', saveVideo);

  // 초기 렌더
  redrawBase();
  buildPaletteUI();
  if (document.fonts && document.fonts.load) { // 웹폰트(Playfair) 로드 후 다시 그림
    Promise.all([
      document.fonts.load("500 40px 'Playfair Display'"),
      document.fonts.load("400 40px 'Playfair Display'"),
    ]).then(redrawBase).catch(() => {});
  }
  window.addEventListener('resize', () => stickers.forEach(layoutSticker));

  return { download };
}
