// src/strip.js
// 컷 스트립(사진들 + 프레임 + 하단문구/날짜) 그리기 — 컷선택 미리보기 / 사진 합성 / 영상이 공용 사용.
import { assetUrl } from './config.js';

// 레이아웃의 스트립 프레임 이미지를 로드(없으면 null → placeholder 사용)
export function loadFrame(config, layout) {
  return new Promise((resolve) => {
    if (!layout.frameOverlay) return resolve(null);
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = assetUrl(config, layout.frameOverlay);
  });
}

// 프레임 오버레이 레이어(캐시해서 매 프레임 재생성 방지).
export function makeFrameLayer(config, layout, frameColor, frameImg) {
  if (frameImg) return frameImg;
  const { w, h } = layout.canvasSize;
  const fc = document.createElement('canvas');
  fc.width = w; fc.height = h;
  const f = fc.getContext('2d');
  f.fillStyle = frameColor || (config.theme && config.theme.primary) || '#f4a7c0';
  f.fillRect(0, 0, w, h);
  f.globalCompositeOperation = 'destination-out';
  layout.cutLayout.forEach((c) => f.fillRect(c.x, c.y, c.w, c.h));
  return fc;
}

// [흰 배경 → 컷 사진(cover) → 프레임레이어 → 하단문구/날짜]
// opts: { showNumbers, caption, captionColor, date }
export function drawStrip(ctx, layout, images, frameLayer, opts = {}) {
  const { w, h } = layout.canvasSize;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);

  layout.cutLayout.forEach((c, i) => {
    const img = images[i];
    if (img) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(c.x, c.y, c.w, c.h);
      ctx.clip();
      const s = Math.max(c.w / img.width, c.h / img.height);
      const dw = img.width * s, dh = img.height * s;
      ctx.drawImage(img, c.x + (c.w - dw) / 2, c.y + (c.h - dh) / 2, dw, dh);
      ctx.restore();
    } else if (opts.showNumbers) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.06)';
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.font = `800 ${Math.round(Math.min(c.w, c.h) * 0.5)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), c.x + c.w / 2, c.y + c.h / 2);
      ctx.restore();
    }
  });

  if (frameLayer) ctx.drawImage(frameLayer, 0, 0, w, h);
  if (opts.caption || opts.date) drawCaption(ctx, layout, opts.caption || '', opts.captionColor, opts.date);
}

// 하단 문구(작고 깔끔) + 날짜(은은하게). 폭에 맞춰 자동 축소(레이아웃 바뀌어도 안 깨짐).
export function drawCaption(ctx, layout, text, color, dateText) {
  const { w, h } = layout.canvasSize;
  let maxBottom = 0;
  layout.cutLayout.forEach((c) => { maxBottom = Math.max(maxBottom, c.y + c.h); });
  const space = h - maxBottom;
  if (space < 24) return;
  const cy = maxBottom + space / 2;
  const hasDate = !!dateText;
  const FONT = "'Playfair Display', 'Nanum Myeongjo', 'Batang', 'Malgun Gothic', Georgia, serif";

  ctx.save();
  ctx.fillStyle = color || '#333333';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const supportLS = 'letterSpacing' in ctx;

  // 메인 문구 (작게 + 살짝 자간)
  let size = Math.round(space * (hasDate ? 0.24 : 0.3));
  const maxW = w * 0.84;
  if (supportLS) ctx.letterSpacing = Math.max(1, Math.round(size * 0.08)) + 'px';
  ctx.font = `500 ${size}px ${FONT}`;
  while (text && ctx.measureText(text).width > maxW && size > 8) {
    size -= 2;
    ctx.font = `500 ${size}px ${FONT}`;
  }
  if (text) ctx.fillText(text, w / 2, hasDate ? cy - space * 0.17 : cy);

  // 날짜 (더 작고 은은하게)
  if (hasDate) {
    const ds = Math.max(12, Math.round(size * 0.66));
    if (supportLS) ctx.letterSpacing = '1px';
    ctx.font = `400 ${ds}px ${FONT}`;
    ctx.globalAlpha = 0.68;
    ctx.fillText(dateText, w / 2, cy + space * 0.2);
    ctx.globalAlpha = 1;
  }
  ctx.restore(); // letterSpacing 등 상태 원복
}

// 배경색 대비 잘 보이는 글자색(어두우면 흰색, 밝으면 진회색)
export function contrastColor(hex) {
  if (!hex || hex[0] !== '#' || hex.length < 7) return '#333333';
  const r = parseInt(hex.substr(1, 2), 16);
  const g = parseInt(hex.substr(3, 2), 16);
  const b = parseInt(hex.substr(5, 2), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? '#333333' : '#ffffff';
}

// 현재 색과 흰색의 중간(파스텔). 예: #8FB3E0 → #C7D9F0
export function pastel(hex) {
  if (!hex || hex[0] !== '#' || hex.length < 7) return hex;
  const mix = (n) => Math.round((n + 255) / 2);
  const r = mix(parseInt(hex.substr(1, 2), 16));
  const g = mix(parseInt(hex.substr(3, 2), 16));
  const b = mix(parseInt(hex.substr(5, 2), 16));
  const hh = (n) => n.toString(16).padStart(2, '0');
  return `#${hh(r)}${hh(g)}${hh(b)}`;
}

// 오늘 날짜 문자열 (2026.07.13)
export function todayStr() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}
