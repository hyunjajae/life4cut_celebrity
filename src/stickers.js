// src/stickers.js
// 스티커 소스 정의.
//  - 기본 스티커: 이모지를 캔버스에 그려 이미지로 사용(에셋 파일 없이도 동작)
//  - 커스텀 스티커: config.stickers[]에 파일명 넣으면 연예인 폴더에서 로드
import { assetUrl } from './config.js';

// 인생네컷에 어울리는 귀여운 스티커들(카메라/선글라스 등 안 어울리는 건 제외)
export const DEFAULT_EMOJI = [
  '⭐', '🌟', '✨', '💫', '💖', '💗', '💕', '💓',
  '❤️', '💜', '🎀', '👑', '🌸', '🌷', '🌼', '🌈',
  '☁️', '🍓', '🍒', '🐰', '🐻', '🧸', '🦋', '💐',
];

// 이모지 하나를 정사각 캔버스에 렌더해서 반환
export function emojiToCanvas(emoji, size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.font = `${Math.floor(size * 0.78)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // 이모지 베이스라인 보정
  ctx.fillText(emoji, size / 2, size * 0.54);
  return c;
}

// 팔레트에 보여줄 항목 목록 만들기
// 반환: [{ type:'emoji', key:'⭐' } | { type:'image', src:'celebrities/<id>/stickers/x.png' }]
export function buildPalette(config) {
  const items = DEFAULT_EMOJI.map((e) => ({ type: 'emoji', key: e }));
  (config.stickers || []).forEach((file) => {
    items.push({ type: 'image', src: assetUrl(config, `stickers/${file}`) });
  });
  return items;
}
